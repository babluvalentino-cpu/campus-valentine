// src/worker.ts
import {
  Env,
  hashPassword,
  verifyPassword,
  createSessionToken,
  createAuthCookie,
  clearAuthCookie,
  verifySession,
} from "./auth";
import { computeGeoVerified } from "./geofence";
import { runMatchingAlgorithm } from "./matchingAlgorithm";
// Allow any Cloudflare Pages origin (*.pages.dev) so production and previews work
function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigin =
    origin && origin.startsWith("https://") && origin.endsWith(".pages.dev")
      ? origin
      : "https://campus-valentine.pages.dev";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  };
}

function getCorsHeadersFallback(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "https://campus-valentine.pages.dev",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  };
}


// Helper function for JSON responses
function jsonResponse(data: any, status = 200, request?: Request): Response {
  const headers = request ? getCorsHeaders(request) : getCorsHeadersFallback();
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

// Environment variable validation
function validateEnv(env: Env): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  if (!env.JWT_SECRET || env.JWT_SECRET.trim() === "") {
    missing.push("JWT_SECRET");
  }
  if (!env.ADMIN_SECRET || env.ADMIN_SECRET.trim() === "") {
    missing.push("ADMIN_SECRET");
  }
  if (!env.DB) {
    missing.push("DB (D1 Database binding)");
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

interface SignupBody {
  username: string;
  password: string;
  fingerprintHash: string;
  clientCoords: { lat: number; lon: number } | null;
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
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request),
      });
    }



    // Validate environment variables on first request
    const envCheck = validateEnv(env);
    if (!envCheck.valid) {
      console.error("Missing environment variables:", envCheck.missing);
      // Don't fail health check, but log error
      if (request.url.endsWith("/api/health")) {
        return jsonResponse({ 
          ok: true, 
          warning: "Some environment variables are missing",
          missing: envCheck.missing 
        });
      }
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", ...getCorsHeadersFallback() },
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

    // Chat endpoints - check /end first to avoid conflicts
    if (url.pathname.startsWith("/api/chat/") && url.pathname.endsWith("/end") && request.method === "POST") {
      const matchId = url.pathname.split("/")[3];
      return handleEndChat(request, env, matchId);
    }

    // Chat: Get Messages
    if (url.pathname.startsWith("/api/chat/") && request.method === "GET" && !url.pathname.endsWith("/end")) {
      const matchId = url.pathname.split("/")[3];
      return handleGetMessages(request, env, matchId);
    }

    // Chat: Send Message
    if (url.pathname.startsWith("/api/chat/") && request.method === "POST" && !url.pathname.endsWith("/end")) {
      const matchId = url.pathname.split("/")[3];
      return handleSendMessage(request, env, matchId);
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

    if (url.pathname === "/api/logout" && request.method === "POST") {
      return handleLogout(request, env);
    }

    return jsonResponse({ error: "Not found" }, 404);
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
    return jsonResponse({ error: "Invalid JSON" }, 400, request);
  }

  const username = (body.username || "").trim();
  const password = body.password || "";
  const fingerprintHash = (body.fingerprintHash || "").trim();
  const clientCoords = body.clientCoords ?? null;

  if (!username || !password || !fingerprintHash) {
    return jsonResponse({ error: "Missing required fields" }, 400, request);
  }

  if (username.length < 3 || username.length > 32) {
    return jsonResponse({ error: "Username must be 3–32 characters" }, 400, request);
  }
  if (password.length < 6 || password.length > 128) {
    return jsonResponse({ error: "Password length invalid" }, 400, request);
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
      return jsonResponse({ error: "Username or device already registered" }, 409, request);
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
    const corsHeadersDynamic = getCorsHeaders(request);
    const headers = new Headers({
      "Content-Type": "application/json",
      "Set-Cookie": createAuthCookie(token),
      ...corsHeadersDynamic,
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
    return jsonResponse({ error: "Error creating account" }, 500, request);
  }
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400, request);
  }

  const username = (body.username || "").trim();
  const password = body.password || "";

  if (!username || !password) {
    return jsonResponse({ error: "Missing username or password" }, 400, request);
  }

  try {
    const result = await env.DB.prepare(
      "SELECT id, password_hash, is_admin FROM Users WHERE username = ?"
    )
      .bind(username)
      .first<{ id: string; password_hash: string; is_admin: number }>();

    if (!result) {
      return jsonResponse({ error: "Invalid credentials" }, 401, request);
    }

    const ok = await verifyPassword(password, result.password_hash);
    if (!ok) {
      return jsonResponse({ error: "Invalid credentials" }, 401, request);
    }

    const token = await createSessionToken(env, {
      id: result.id,
      isAdmin: result.is_admin === 1,
    });
    const corsHeadersDynamic = getCorsHeaders(request);
    const headers = new Headers({
      "Content-Type": "application/json",
      "Set-Cookie": createAuthCookie(token),
      ...corsHeadersDynamic,
    });

    return new Response(JSON.stringify({ id: result.id, username }), {
      status: 200,
      headers,
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return jsonResponse({ error: "Error logging in" }, 500, request);
  }
}

async function handleMe(request: Request, env: Env): Promise<Response> {
  const session = await verifySession(request, env);
  if (!session) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const result = await env.DB.prepare(
    "SELECT id, username, is_admin, geo_verified, status FROM Users WHERE id = ?"
  )
    .bind(session.id)
    .first<{ id: string; username: string; is_admin: number; geo_verified: number; status: string }>();

  if (!result) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  return jsonResponse({
    id: result.id,
    username: result.username,
    isAdmin: result.is_admin === 1,
    geo_verified: result.geo_verified,
    status: result.status,
  });
}

async function handleProfileUpdate(request: Request, env: Env): Promise<Response> {
  const session = await verifySession(request, env);
  if (!session) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: any;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
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
    return jsonResponse({ error: "Bio too long" }, 400);
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
      return jsonResponse({ error: "Profile cannot be updated in current state" }, 409);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("Profile update error:", err);
    return jsonResponse({ error: "Error updating profile" }, 500);
  }
}

async function handleRunMatching(request: Request, env: Env): Promise<Response> {
  const session = await verifySession(request, env);
  if (!session || !session.isAdmin) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const result = await runMatchingAlgorithm(env.DB);
  return jsonResponse({ result });
}

async function runMidnightMatcher(env: Env) {
  try {
    const result = await runMatchingAlgorithm(env.DB);
    console.log("[CRON MATCHER]", result);
  } catch (err) {
    console.error("[CRON MATCHER ERROR]", err);
  }
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Set-Cookie": clearAuthCookie(),
    ...getCorsHeaders(request),
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers,
  });
}

async function handleGetMessages(request: Request, env: Env, matchId: string): Promise<Response> {
  const session = await verifySession(request, env);
  if (!session) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    // Verify user belongs to this match
    const match = await env.DB.prepare(
      "SELECT id FROM Matches WHERE id = ? AND (user_a_id = ? OR user_b_id = ?) AND status = 'active'"
    )
      .bind(matchId, session.id, session.id)
      .first<{ id: string }>();

    if (!match) {
      return jsonResponse({ error: "Match not found or unauthorized" }, 404);
    }

    // Fetch messages (Limit 50 for performance)
    const messages = await env.DB.prepare(
      `SELECT id, sender_id, content, created_at 
       FROM Messages 
       WHERE match_id = ? 
       ORDER BY created_at ASC
       LIMIT 50`
    )
      .bind(matchId)
      .all<{ id: string; sender_id: string; content: string; created_at: string }>();

    return jsonResponse(messages.results || []);
  } catch (err) {
    console.error("Get messages error:", err);
    return jsonResponse({ error: "Error fetching messages" }, 500);
  }
}

async function handleSendMessage(request: Request, env: Env, matchId: string): Promise<Response> {
  const session = await verifySession(request, env);
  if (!session) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: { content: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const content = (body.content || "").trim();
  if (!content || content.length === 0) {
    return jsonResponse({ error: "Message cannot be empty" }, 400);
  }

  if (content.length > 1000) {
    return jsonResponse({ error: "Message too long (max 1000 characters)" }, 400);
  }

  try {
    // Verify match is ACTIVE and user belongs to it
    const match = await env.DB.prepare(
      "SELECT id FROM Matches WHERE id = ? AND status = 'active' AND (user_a_id = ? OR user_b_id = ?)"
    )
      .bind(matchId, session.id, session.id)
      .first<{ id: string }>();

    if (!match) {
      return jsonResponse({ error: "Cannot send message (Match ended or not found)" }, 403);
    }

    // Insert Message
    const msgId = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO Messages (id, match_id, sender_id, content) VALUES (?, ?, ?, ?)"
    )
      .bind(msgId, matchId, session.id, content)
      .run();

    return jsonResponse({
      id: msgId,
      sender_id: session.id,
      content,
      created_at: new Date().toISOString(),
    }, 201);
  } catch (err) {
    console.error("Send message error:", err);
    return jsonResponse({ error: "Error sending message" }, 500);
  }
}

async function handleGetMatches(request: Request, env: Env): Promise<Response> {
  const session = await verifySession(request, env);
  if (!session) {
    return jsonResponse({ error: "Unauthorized" }, 401);
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
      return jsonResponse([]);
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

    return jsonResponse(matchData);
  } catch (err) {
    console.error("Get matches error:", err);
    return jsonResponse({ error: "Error fetching matches" }, 500);
  }
}

async function handleEndChat(request: Request, env: Env, matchId: string): Promise<Response> {
  const session = await verifySession(request, env);
  if (!session) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    // Verify user is part of this match
    const match = await env.DB.prepare(
      "SELECT user_a_id, user_b_id FROM Matches WHERE id = ? AND status = 'active'"
    )
      .bind(matchId)
      .first<{ user_a_id: string; user_b_id: string }>();

    if (!match || (match.user_a_id !== session.id && match.user_b_id !== session.id)) {
      return jsonResponse({ error: "Match not found or unauthorized" }, 404);
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

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("End chat error:", err);
    return jsonResponse({ error: "Error ending chat" }, 500);
  }
}

/** Requires a valid session with isAdmin. Returns session or { status: 401|403 }. */
async function requireAdminSession(
  request: Request,
  env: Env
): Promise<{ id: string; isAdmin: true } | { status: 401 | 403 }> {
  const session = await verifySession(request, env);
  if (!session) return { status: 401 };
  if (!session.isAdmin) return { status: 403 };
  return session as { id: string; isAdmin: true };
}

async function handleAdminUsers(request: Request, env: Env): Promise<Response> {
  const result = await requireAdminSession(request, env);
  if ("status" in result) {
    return jsonResponse(
      { error: result.status === 401 ? "Unauthorized" : "Forbidden" },
      result.status,
      request
    );
  }

  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "100", 10)));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

  try {
    const users = await env.DB.prepare(
      `SELECT id, username, gender, year, status, is_whitelisted, created_at
       FROM Users
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
      .bind(limit, offset)
      .all<{
      id: string;
      username: string;
      gender: string | null;
      year: number | null;
      status: string;
      is_whitelisted: number;
      created_at: string;
    }>();

    return jsonResponse(users.results || [], 200, request);
  } catch (err) {
    console.error("Admin users error:", err);
    return jsonResponse({ error: "Error fetching users" }, 500, request);
  }
}

async function handleAdminWhitelist(request: Request, env: Env): Promise<Response> {
  const result = await requireAdminSession(request, env);
  if ("status" in result) {
    return jsonResponse(
      { error: result.status === 401 ? "Unauthorized" : "Forbidden" },
      result.status,
      request
    );
  }

  let body: { user_id: string; status: boolean };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400, request);
  }

  try {
    await env.DB.prepare(
      "UPDATE Users SET is_whitelisted = ? WHERE id = ?"
    )
      .bind(body.status ? 1 : 0, body.user_id)
      .run();

    return jsonResponse({ success: true }, 200, request);
  } catch (err) {
    console.error("Admin whitelist error:", err);
    return jsonResponse({ error: "Error updating whitelist" }, 500, request);
  }
}

async function handleAdminUnmatch(request: Request, env: Env): Promise<Response> {
  const result = await requireAdminSession(request, env);
  if ("status" in result) {
    return jsonResponse(
      { error: result.status === 401 ? "Unauthorized" : "Forbidden" },
      result.status,
      request
    );
  }

  let body: { user_id: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400, request);
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
      return jsonResponse({ error: "No active match found" }, 404, request);
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

    return jsonResponse({ success: true }, 200, request);
  } catch (err) {
    console.error("Admin unmatch error:", err);
    return jsonResponse({ error: "Error unmatching users" }, 500, request);
  }
}

async function handleAdminMatch(request: Request, env: Env): Promise<Response> {
  const result = await requireAdminSession(request, env);
  if ("status" in result) {
    return jsonResponse(
      { error: result.status === 401 ? "Unauthorized" : "Forbidden" },
      result.status,
      request
    );
  }

  let body: { user_a_id: string; user_b_id: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400, request);
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
      return jsonResponse({ error: "User A already has an active match" }, 409, request);
    }
    if (existingB && !userB?.is_whitelisted) {
      return jsonResponse({ error: "User B already has an active match" }, 409, request);
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

    return jsonResponse({ success: true, match_id: matchId }, 200, request);
  } catch (err) {
    console.error("Admin match error:", err);
    return jsonResponse({ error: "Error creating match" }, 500, request);
  }
}
