// src/worker.ts
import {
  Env,
  hashPassword,
  verifyPassword,
  createSessionToken,
  createAuthCookie,
  verifySession,
} from "./auth";
import { verifyTurnstileToken } from "./turnstile";
import { computeGeoVerified } from "./geofence";
import { runMatchingAlgorithm } from "./matchingAlgorithm";

interface SignupBody {
  username: string;
  password: string;
  fingerprintHash: string;
  clientCoords: { lat: number; lon: number } | null;
  turnstileToken: string;
}

interface LoginBody {
  username: string;
  password: string;
}

interface ProfileBody {
  gender: string;
  seeking: string;
  interests: string[];
  bio?: string;
}

const GENDER_OPTIONS = ["male", "female", "other"] as const;
const SEEKING_OPTIONS = ["male", "female", "other", "all"] as const;

// Must match frontend INTEREST_OPTIONS
const INTEREST_OPTIONS = [
  "music",
  "movies",
  "coding",
  "gaming",
  "sports",
  "art",
  "books",
  "travel",
  "fitness",
  "food",
] as const;

const INTEREST_SET = new Set(INTEREST_OPTIONS);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/api/signup" && request.method === "POST") {
      return handleSignup(request, env);
    }

    if (url.pathname === "/api/login" && request.method === "POST") {
      return handleLogin(request, env);
    }

    if (url.pathname === "/api/me" && request.method === "GET") {
      return handleMe(request, env);
    }

    if (url.pathname === "/api/profile" && request.method === "POST") {
      return handleProfileUpdate(request, env);
    }

    if (url.pathname === "/api/matches" && request.method === "GET") {
      return handleGetMatches(request, env);
    }

    if (url.pathname.startsWith("/api/chat/") && url.pathname.endsWith("/end") && request.method === "POST") {
      const matchId = url.pathname.split("/")[3];
      return handleEndChat(request, env, matchId);
    }

    if (url.pathname === "/api/admin/users" && request.method === "GET") {
      return handleAdminUsers(request, env);
    }

    if (url.pathname === "/api/admin/whitelist" && request.method === "POST") {
      return handleAdminWhitelist(request, env);
    }

    if (url.pathname === "/api/admin/unmatch" && request.method === "POST") {
      return handleAdminUnmatch(request, env);
    }

    if (url.pathname === "/api/admin/match" && request.method === "POST") {
      return handleAdminMatch(request, env);
    }

    if (url.pathname === "/api/admin/run-matching" && request.method === "POST") {
      return handleRunMatching(request, env);
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runMidnightMatcher(env));
  },
};

async function handleSignup(request: Request, env: Env): Promise<Response> {
  let body: SignupBody;
  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const username = (body.username || "").trim();
  const password = body.password || "";
  const fingerprintHash = (body.fingerprintHash || "").trim();
  const clientCoords = body.clientCoords ?? null;
  const turnstileToken = body.turnstileToken || "";

  if (!username || !password || !fingerprintHash || !turnstileToken) {
    return new Response("Missing required fields.", { status: 400 });
  }

  if (username.length < 3 || username.length > 32) {
    return new Response("Username must be 3–32 characters.", { status: 400 });
  }
  if (password.length < 6 || password.length > 128) {
    return new Response("Password length invalid.", { status: 400 });
  }

  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for") ||
    "";

  // CAPTCHA check
  const isHuman = await verifyTurnstileToken(turnstileToken, env, ip);
  if (!isHuman) {
    return new Response("CAPTCHA verification failed.", { status: 403 });
  }

  // Geo verification
  const geoVerified = computeGeoVerified(request, clientCoords);

  const passwordHash = await hashPassword(password);
  const userId = crypto.randomUUID();

  try {
    // Prevent duplicate device or username
    const existing = await env.DB.prepare(
      "SELECT id FROM Users WHERE username = ? OR fingerprint_hash = ?"
    )
      .bind(username, fingerprintHash)
      .all<{ id: string }>();

    if (existing.results && existing.results.length > 0) {
      return new Response("Username or device already registered.", { status: 409 });
    }

    // ✅ PHASE-3 INSERT (all required fields)
    await env.DB.prepare(
      `INSERT INTO Users (
        id, username, password_hash, fingerprint_hash,
        intent, year, residence, profile_data, bio,
        status, geo_verified, is_whitelisted, is_admin
      )
      VALUES (?, ?, ?, ?, 'relationship', 1, NULL, '{}', '',
              'pending_profile', ?, 0, 0)`
    )
      .bind(userId, username, passwordHash, fingerprintHash, geoVerified)
      .run();

    // Create session cookie
    const token = await createSessionToken(env, { id: userId, isAdmin: false });
    const headers = new Headers({
      "Content-Type": "application/json",
      "Set-Cookie": createAuthCookie(token),
    });

    return new Response(
      JSON.stringify({
        id: userId,
        username,
        geo_verified: geoVerified,
      }),
      {
      status: 201,
      headers,
      }
    );
  } catch (err: any) {
    console.error("Signup error:", err);
    return new Response("Error creating account.", { status: 500 });
  }
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const username = (body.username || "").trim();
  const password = body.password || "";

  if (!username || !password) {
    return new Response("Missing username or password.", { status: 400 });
  }

  try {
    const result = await env.DB.prepare(
      "SELECT id, password_hash, is_admin FROM Users WHERE username = ?"
    )
      .bind(username)
      .first<{ id: string; password_hash: string; is_admin: number }>();

    if (!result) {
      return new Response("Invalid credentials.", { status: 401 });
    }

    const ok = await verifyPassword(password, result.password_hash);
    if (!ok) {
      return new Response("Invalid credentials.", { status: 401 });
    }

    const token = await createSessionToken(env, {
      id: result.id,
      isAdmin: result.is_admin === 1,
    });
    const headers = new Headers({
      "Content-Type": "application/json",
      "Set-Cookie": createAuthCookie(token),
    });

    return new Response(JSON.stringify({ id: result.id, username }), {
      status: 200,
      headers,
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return new Response("Error logging in.", { status: 500 });
  }
}

async function handleMe(request: Request, env: Env): Promise<Response> {
  const session = await verifySession(request, env);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await env.DB.prepare(
    "SELECT id, username, is_admin, geo_verified, status FROM Users WHERE id = ?"
  )
    .bind(session.id)
    .first<{ id: string; username: string; is_admin: number; geo_verified: number; status: string }>();

  if (!result) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(
    JSON.stringify({
      id: result.id,
      username: result.username,
      isAdmin: result.is_admin === 1,
      geo_verified: result.geo_verified,
      status: result.status,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}

async function handleProfileUpdate(request: Request, env: Env): Promise<Response> {
  const session = await verifySession(request, env);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: any;

  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Extract fields from wizard data (support both direct fields and profileData wrapper)
  const wizardData = body.profileData || body;
  const intent = wizardData.intent || "relationship";
  const year = wizardData.year ? Number(wizardData.year) : null;
  const bio = typeof wizardData.bio === "string" ? wizardData.bio.trim() : "";
  const gender = wizardData.gender || null;
  const seeking = wizardData.seeking || null;
  const residence = wizardData.residence || null;

  // Validate bio length
  if (bio.length > 200) {
    return new Response("Bio too long.", { status: 400 });
  }

  // Store full wizard data in profile_data JSON
  const profileDataJson = JSON.stringify(wizardData);

  try {
    const result = await env.DB.prepare(
      `UPDATE Users
       SET intent = ?,
           year = ?,
           bio = ?,
           gender = ?,
           seeking = ?,
           residence = ?,
           profile_data = ?,
           status = 'pending_match'
       WHERE id = ? AND status = 'pending_profile'`
    )
      .bind(
        intent,
        year,
        bio,
        gender,
        seeking,
        residence,
        profileDataJson,
        session.id
      )
      .run();

    const updated =
      result.meta && "changes" in result.meta ? result.meta.changes : 0;

    if (!updated) {
      return new Response("Profile cannot be updated in current state.", {
        status: 409,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Profile update error:", err);
    return new Response("Error updating profile.", { status: 500 });
  }
}

async function handleRunMatching(request: Request, env: Env): Promise<Response> {
  const session = await verifySession(request, env);
  if (!session || !session.isAdmin) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await runMatchingAlgorithm(env.DB);
  return new Response(JSON.stringify({ result }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function runMidnightMatcher(env: Env) {
  try {
    const result = await runMatchingAlgorithm(env.DB);
    console.log("[CRON MATCHER]", result);
  } catch (err) {
    console.error("[CRON MATCHER ERROR]", err);
  }
}

async function handleGetMatches(request: Request, env: Env): Promise<Response> {
  const session = await verifySession(request, env);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Get all matches for this user
    const matches = await env.DB.prepare(
      `SELECT m.id, m.created_at,
              CASE 
                WHEN m.user_a_id = ? THEN m.user_b_id
                ELSE m.user_a_id
              END as partner_id
       FROM Matches m
       WHERE (m.user_a_id = ? OR m.user_b_id = ?)
         AND m.status = 'active'`
    )
      .bind(session.id, session.id, session.id)
      .all<{ id: string; created_at: string; partner_id: string }>();

    if (!matches.results || matches.results.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get partner info and last message for each match
    const matchData = await Promise.all(
      matches.results.map(async (match) => {
        const partner = await env.DB.prepare(
          "SELECT id, username FROM Users WHERE id = ?"
        )
          .bind(match.partner_id)
          .first<{ id: string; username: string }>();

        const lastMessage = await env.DB.prepare(
          `SELECT content, created_at
           FROM Messages
           WHERE match_id = ?
           ORDER BY created_at DESC
           LIMIT 1`
        )
          .bind(match.id)
          .first<{ content: string; created_at: string } | null>();

        return {
          id: match.id,
          partner: partner || { id: match.partner_id, username: "Unknown" },
          last_message: lastMessage?.content || "No messages yet.",
          last_message_at: lastMessage?.created_at || null,
          unread_count: 0, // TODO: Implement unread tracking
        };
      })
    );

    return new Response(JSON.stringify(matchData), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Get matches error:", err);
    return new Response("Error fetching matches.", { status: 500 });
  }
}

async function handleEndChat(request: Request, env: Env, matchId: string): Promise<Response> {
  const session = await verifySession(request, env);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Verify user is part of this match
    const match = await env.DB.prepare(
      "SELECT user_a_id, user_b_id FROM Matches WHERE id = ? AND status = 'active'"
    )
      .bind(matchId)
      .first<{ user_a_id: string; user_b_id: string }>();

    if (!match || (match.user_a_id !== session.id && match.user_b_id !== session.id)) {
      return new Response("Match not found or unauthorized", { status: 404 });
    }

    // End the match
    await env.DB.prepare(
      "UPDATE Matches SET status = 'ended_by_user' WHERE id = ?"
    )
      .bind(matchId)
      .run();

    // Requeue both users
    await env.DB.prepare(
      "UPDATE Users SET status = 'requeuing' WHERE id IN (?, ?) AND status = 'matched'"
    )
      .bind(match.user_a_id, match.user_b_id)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("End chat error:", err);
    return new Response("Error ending chat.", { status: 500 });
  }
}

function verifyAdminSecret(request: Request, env: Env): boolean {
  const secret = request.headers.get("x-admin-secret");
  return secret === env.ADMIN_SECRET;
}

async function handleAdminUsers(request: Request, env: Env): Promise<Response> {
  if (!verifyAdminSecret(request, env)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const users = await env.DB.prepare(
      `SELECT id, username, gender, year, status, is_whitelisted, created_at
       FROM Users
       ORDER BY created_at DESC`
    ).all<{
      id: string;
      username: string;
      gender: string | null;
      year: number | null;
      status: string;
      is_whitelisted: number;
      created_at: string;
    }>();

    return new Response(JSON.stringify(users.results || []), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Admin users error:", err);
    return new Response("Error fetching users.", { status: 500 });
  }
}

async function handleAdminWhitelist(request: Request, env: Env): Promise<Response> {
  if (!verifyAdminSecret(request, env)) {
    return new Response("Forbidden", { status: 403 });
  }

  let body: { user_id: string; status: boolean };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  try {
    await env.DB.prepare(
      "UPDATE Users SET is_whitelisted = ? WHERE id = ?"
    )
      .bind(body.status ? 1 : 0, body.user_id)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Admin whitelist error:", err);
    return new Response("Error updating whitelist.", { status: 500 });
  }
}

async function handleAdminUnmatch(request: Request, env: Env): Promise<Response> {
  if (!verifyAdminSecret(request, env)) {
    return new Response("Forbidden", { status: 403 });
  }

  let body: { user_id: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  try {
    // Find active match for this user
    const match = await env.DB.prepare(
      `SELECT id, user_a_id, user_b_id
       FROM Matches
       WHERE (user_a_id = ? OR user_b_id = ?) AND status = 'active'
       LIMIT 1`
    )
      .bind(body.user_id, body.user_id)
      .first<{ id: string; user_a_id: string; user_b_id: string }>();

    if (!match) {
      return new Response("No active match found", { status: 404 });
    }

    // End the match
    await env.DB.prepare(
      "UPDATE Matches SET status = 'ended_by_admin' WHERE id = ?"
    )
      .bind(match.id)
      .run();

    // Requeue both users
    await env.DB.prepare(
      "UPDATE Users SET status = 'requeuing' WHERE id IN (?, ?) AND status = 'matched'"
    )
      .bind(match.user_a_id, match.user_b_id)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Admin unmatch error:", err);
    return new Response("Error unmatching users.", { status: 500 });
  }
}

async function handleAdminMatch(request: Request, env: Env): Promise<Response> {
  if (!verifyAdminSecret(request, env)) {
    return new Response("Forbidden", { status: 403 });
  }

  let body: { user_a_id: string; user_b_id: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  try {
    // Check if either user already has an active match
    const existingA = await env.DB.prepare(
      `SELECT id FROM Matches
       WHERE (user_a_id = ? OR user_b_id = ?) AND status = 'active'
       LIMIT 1`
    )
      .bind(body.user_a_id, body.user_a_id)
      .first<{ id: string }>();

    const existingB = await env.DB.prepare(
      `SELECT id FROM Matches
       WHERE (user_a_id = ? OR user_b_id = ?) AND status = 'active'
       LIMIT 1`
    )
      .bind(body.user_b_id, body.user_b_id)
      .first<{ id: string }>();

    // Check if user B is whitelisted (can have multiple matches)
    const userB = await env.DB.prepare(
      "SELECT is_whitelisted FROM Users WHERE id = ?"
    )
      .bind(body.user_b_id)
      .first<{ is_whitelisted: number }>();

    if (existingA && !userB?.is_whitelisted) {
      return new Response("User A already has an active match", { status: 409 });
    }
    if (existingB && !userB?.is_whitelisted) {
      return new Response("User B already has an active match", { status: 409 });
    }

    // Create match
    const matchId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO Matches (id, user_a_id, user_b_id)
       VALUES (?, ?, ?)`
    )
      .bind(matchId, body.user_a_id, body.user_b_id)
      .run();

    // Update user statuses
    await env.DB.prepare(
      "UPDATE Users SET status = 'matched' WHERE id IN (?, ?) AND status IN ('pending_match', 'requeuing')"
    )
      .bind(body.user_a_id, body.user_b_id)
      .run();

    return new Response(JSON.stringify({ success: true, match_id: matchId }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Admin match error:", err);
    return new Response("Error creating match.", { status: 500 });
  }
}
