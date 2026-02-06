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
import { sanitizeMessage } from "./wordFilter";
import { generateSmartIcebreaker } from "./icebreaker";
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
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

function getCorsHeadersFallback(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "https://campus-valentine.pages.dev",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

    // Simple root response for tests and quick sanity checks
    if (url.pathname === "/") {
      return new Response("Hello World!", { headers: { "Content-Type": "text/plain" } });
    }

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

    // Debug endpoint: check if cookies are being received
    if (url.pathname === "/api/debug/cookies" && request.method === "GET") {
      const cookies = request.headers.get("Cookie") || "(no cookies received)";
      const origin = request.headers.get("Origin") || "(no origin)";
      console.log("📋 DEBUG: Cookies received:", cookies);
      console.log("📋 DEBUG: Origin:", origin);
      return jsonResponse({
        message: "Debug cookies endpoint",
        cookiesReceived: cookies,
        originHeader: origin,
        timestamp: new Date().toISOString(),
      }, 200, request);
    }

    if (url.pathname === "/api/profile" && request.method === "POST") {
      return handleProfileUpdate(request, env);
    }

    if (url.pathname === "/api/matches" && request.method === "GET") {
      return handleGetMatches(request, env);
    }

    // Chat: Report & Unmatch (must be before /end)
    if (url.pathname.startsWith("/api/chat/") && url.pathname.endsWith("/report") && request.method === "POST") {
      const matchId = url.pathname.split("/")[3];
      return handleReportChat(request, env, matchId);
    }

    // Chat: End (unmatch by choice)
    if (url.pathname.startsWith("/api/chat/") && url.pathname.endsWith("/end") && request.method === "POST") {
      const matchId = url.pathname.split("/")[3];
      return handleEndChat(request, env, matchId);
    }

    // Chat: Get Messages (path is /api/chat/:id only, not /end or /report)
    if (url.pathname.startsWith("/api/chat/") && request.method === "GET") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 4 && parts[3] !== "end" && parts[3] !== "report") {
        return handleGetMessages(request, env, parts[2]);
      }
      if (parts.length === 3) {
        return handleGetMessages(request, env, parts[2]);
      }
    }

    // Chat: Send Message (path is /api/chat/:id only)
    if (url.pathname.startsWith("/api/chat/") && request.method === "POST") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 3) {
        return handleSendMessage(request, env, parts[2]);
      }
    }

    if (url.pathname === "/api/admin/reports" && request.method === "GET") {
      return handleAdminReports(request, env);
    }

    if (url.pathname === "/api/admin/users" && request.method === "GET") {
      return handleAdminUsers(request, env);
    }

    if (url.pathname === "/api/admin/couples" && request.method === "GET") {
      return handleAdminCouples(request, env);
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

    return jsonResponse({ error: "Not found" }, 404, request);
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
        intent, year, residence, dietary_preference, profile_data, bio,
        status, geo_verified, is_whitelisted, is_admin
      )
      VALUES (?, ?, ?, ?, 'relationship', 1, NULL, NULL, '{}', '',
              'pending_profile', ?, 0, 0)`
    )
      .bind(userId, username, passwordHash, fingerprintHash, geoVerified)
      .run();

    // Create session cookie
    const token = await createSessionToken(env, { id: userId, isAdmin: false });
    console.log("Token created successfully for user:", userId);
    const corsHeadersDynamic = getCorsHeaders(request);
    const authCookie = createAuthCookie(token);
    console.log("Auth cookie created:", { cookieLength: authCookie.length });
    const headers = new Headers({
      "Content-Type": "application/json",
      "Set-Cookie": authCookie,
      ...corsHeadersDynamic,
    });

    return new Response(
      JSON.stringify({
        id: userId,
        username,
        geo_verified: geoVerified,
        token, // Include token in response body so frontend can store it
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

    return new Response(JSON.stringify({ 
      id: result.id, 
      username, 
      status: "logged_in",
      token, // Include token in response body
    }), {
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
    return jsonResponse({ error: "Unauthorized" }, 401, request);
  }

  const result = await env.DB.prepare(
    "SELECT id, username, is_admin, geo_verified, status, gender, seeking, year FROM Users WHERE id = ?"
  )
    .bind(session.id)
    .first<{ id: string; username: string; is_admin: number; geo_verified: number; status: string; gender: string | null; seeking: string | null; year: number | null }>();

  if (!result) {
    return jsonResponse({ error: "Not found" }, 404, request);
  }

  return jsonResponse({
    id: result.id,
    username: result.username,
    isAdmin: result.is_admin === 1,
    geo_verified: result.geo_verified,
    status: result.status,
    gender: result.gender,
    seeking: result.seeking,
    year: result.year,
  });
}

async function handleProfileUpdate(request: Request, env: Env): Promise<Response> {
  console.log("🔍 Profile update request received");
  const cookieHeader = request.headers.get("Cookie") || "(no cookies)";
  console.log("📋 Cookies in request:", cookieHeader);
  
  const session = await verifySession(request, env);
  
  if (!session) {
    console.error("❌ Profile update: No session found. Cookie might not be sent or JWT verification failed.");
    console.error("   Cookies received:", cookieHeader);
    return jsonResponse({ 
      error: "Unauthorized - session not found",
      debugInfo: "No auth_token cookie received or JWT verification failed"
    }, 401, request);
  }

  console.log("✓ Session verified for user:", session.id);

  let body: any;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400, request);
  }

  // Extract fields from wizard data (support both direct fields and profileData wrapper)
  const wizardData = body.profileData || body;
  const intent = wizardData.intent || "relationship";
  const year = wizardData.year ? Number(wizardData.year) : null;
  const bio = typeof wizardData.bio === "string" ? wizardData.bio.trim() : "";
  const gender = wizardData.gender || null;
  const seeking = wizardData.seeking || null;
  const residence = wizardData.residence || null;
  const dietary = wizardData.dietary || null;

  // Validate bio length
  if (bio.length > 200) {
    return jsonResponse({ error: "Bio too long" }, 400, request);
  }

  // Store full wizard data in profile_data JSON
  const profileDataJson = JSON.stringify(wizardData);

  try {
    // First, check user's current status
    const userCheck = await env.DB.prepare(
      "SELECT id, status FROM Users WHERE id = ?"
    )
      .bind(session.id)
      .first<{ id: string; status: string }>();

    console.log("User status check:", { userId: session.id, userStatus: userCheck?.status });

    if (!userCheck) {
      return jsonResponse({ error: "User not found" }, 404, request);
    }

    // Allow update from pending_profile or pending_match (retry case)
    if (userCheck.status !== "pending_profile" && userCheck.status !== "pending_match") {
      return jsonResponse({ 
        error: `Profile cannot be updated in current state: ${userCheck.status}` 
      }, 409, request);
    }

    const result = await env.DB.prepare(
      `UPDATE Users
       SET intent = ?,
           year = ?,
           bio = ?,
           gender = ?,
           seeking = ?,
           residence = ?,
           dietary_preference = ?,
           profile_data = ?,
           status = 'pending_match'
       WHERE id = ?`
    )
      .bind(
        intent,
        year,
        bio,
        gender,
        seeking,
        residence,
        dietary,
        profileDataJson,
        session.id
      )
      .run();

    const updated =
      result.meta && "changes" in result.meta ? result.meta.changes : 0;

    console.log("Profile update result:", { updated, changes: result.meta });

    if (!updated) {
      return jsonResponse({ error: "Failed to update profile" }, 500, request);
    }

    return jsonResponse({ success: true }, 200, request);
  } catch (err: any) {
    console.error("Profile update error:", { userId: session.id, error: err, message: err?.message });

    const msg = err && err.message ? String(err.message) : "";
    // If the DB schema is missing the dietary_preference column, attempt a safe migration and retry once
    if (msg.includes("no such column: dietary_preference") || msg.includes("has no column named dietary_preference")) {
      try {
        console.warn("Attempting to add missing column dietary_preference to Users table");
        await env.DB.prepare(`ALTER TABLE Users ADD COLUMN dietary_preference TEXT`).run();

        // Retry the update after migration
        const retry = await env.DB.prepare(
          `UPDATE Users
           SET intent = ?,
               year = ?,
               bio = ?,
               gender = ?,
               seeking = ?,
               residence = ?,
               dietary_preference = ?,
               profile_data = ?,
               status = 'pending_match'
           WHERE id = ?`
        )
          .bind(intent, year, bio, gender, seeking, residence, dietary, profileDataJson, session.id)
          .run();

        const updatedRetry = retry.meta && "changes" in retry.meta ? retry.meta.changes : 0;
        if (!updatedRetry) {
          return jsonResponse({ error: "Profile cannot be updated in current state" }, 409, request);
        }

        return jsonResponse({ success: true }, 200, request);
      } catch (merr) {
        console.error("Migration attempt failed:", merr);
        // fall through to return generic 500 below
      }
    }

    return jsonResponse({ error: "Error updating profile: " + msg }, 500, request);
  }
}

async function handleRunMatching(request: Request, env: Env): Promise<Response> {
  const session = await verifySession(request, env);
  if (!session || !session.isAdmin) {
    return jsonResponse({ error: "Unauthorized" }, 401, request);
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
    return jsonResponse({ error: "Unauthorized" }, 401, request);
  }

  try {
    // Verify user belongs to this match
    const match = await env.DB.prepare(
      "SELECT id FROM Matches WHERE id = ? AND (user_a_id = ? OR user_b_id = ?) AND status = 'active'"
    )
      .bind(matchId, session.id, session.id)
      .first<{ id: string }>();

    if (!match) {
      return jsonResponse({ error: "Match not found or unauthorized" }, 404, request);
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

    return jsonResponse(messages.results || [], 200, request);
  } catch (err) {
    console.error("Get messages error:", err);
    return jsonResponse({ error: "Error fetching messages" }, 500, request);
  }
}

async function handleSendMessage(request: Request, env: Env, matchId: string): Promise<Response> {
  const session = await verifySession(request, env);
  if (!session) {
    return jsonResponse({ error: "Unauthorized" }, 401, request);
  }

  let body: { content: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400, request);
  }

  const content = (body.content || "").trim();
  if (!content || content.length === 0) {
    return jsonResponse({ error: "Message cannot be empty" }, 400, request);
  }

  if (content.length > 1000) {
    return jsonResponse({ error: "Message too long (max 1000 characters)" }, 400, request);
  }

  try {
    // Verify match is ACTIVE and user belongs to it
    const match = await env.DB.prepare(
      "SELECT id FROM Matches WHERE id = ? AND status = 'active' AND (user_a_id = ? OR user_b_id = ?)"
    )
      .bind(matchId, session.id, session.id)
      .first<{ id: string }>();

    if (!match) {
      return jsonResponse({ error: "Cannot send message (Match ended or not found)" }, 403, request);
    }

    // Get sender's username and gender
    const sender = await env.DB.prepare(
      "SELECT username, gender FROM Users WHERE id = ?"
    )
      .bind(session.id)
      .first<{ username: string; gender: string | null }>();

    // Sanitize message content (remove URLs and profanity)
    const sanitizedContent = sanitizeMessage(content);

    // Insert Message with username and gender
    const msgId = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO Messages (id, match_id, sender_id, sender_username, sender_gender, content) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(msgId, matchId, session.id, sender?.username || null, sender?.gender || null, sanitizedContent)
      .run();

    return jsonResponse({
      id: msgId,
      sender_id: session.id,
      sender_username: sender?.username,
      sender_gender: sender?.gender,
      content: sanitizedContent,
      created_at: new Date().toISOString(),
    }, 201, request);
  } catch (err) {
    console.error("Send message error:", err);
    return jsonResponse({ error: "Error sending message" }, 500, request);
  }
}

async function handleGetMatches(request: Request, env: Env): Promise<Response> {
  const session = await verifySession(request, env);
  if (!session) {
    return jsonResponse({ error: "Unauthorized" }, 401, request);
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
      return jsonResponse([], 200, request);
    }

    // Get partner info and last message for each match
    const matchData = await Promise.all(
      matches.results.map(async (match) => {
        const partner = await env.DB.prepare(
          "SELECT id, username, profile_data, dietary_preference FROM Users WHERE id = ?"
        )
          .bind(match.partner_id)
          .first<{ id: string; username: string; profile_data: string | null; dietary_preference: string | null }>();

        const currentUser = await env.DB.prepare(
          "SELECT profile_data, dietary_preference FROM Users WHERE id = ?"
        )
          .bind(session.id)
          .first<{ profile_data: string | null; dietary_preference: string | null }>();

        const lastMessage = await env.DB.prepare(
          `SELECT content, created_at
           FROM Messages
           WHERE match_id = ?
           ORDER BY created_at DESC
           LIMIT 1`
        )
          .bind(match.id)
          .first<{ content: string; created_at: string } | null>();

        // Generate smart icebreaker
        let icebreaker = "";
        if (!lastMessage && partner && currentUser) {
          const partnerProfile = partner.profile_data ? JSON.parse(partner.profile_data) : {};
          const currentProfile = currentUser.profile_data ? JSON.parse(currentUser.profile_data) : {};
          
          const sportsA = new Set(currentProfile.sports || []);
          const sportsB = new Set(partnerProfile.sports || []);
          const sportIntersection = Array.from(sportsA).filter(s => sportsB.has(s)) as string[];

          icebreaker = generateSmartIcebreaker({
            username_a: "You",
            username_b: partner.username,
            sports_intersection: sportIntersection.length > 0 ? sportIntersection : undefined,
            dietary_pref_a: currentUser.dietary_preference || undefined,
            dietary_pref_b: partner.dietary_preference || undefined,
          });
        }

        return {
          id: match.id,
          partner: partner || { id: match.partner_id, username: "Unknown" },
          last_message: lastMessage?.content || "No messages yet.",
          last_message_at: lastMessage?.created_at || null,
          unread_count: 0, // TODO: Implement unread tracking
          icebreaker,
        };
      })
    );

    return jsonResponse(matchData, 200, request);
  } catch (err) {
    console.error("Get matches error:", err);
    return jsonResponse({ error: "Error fetching matches" }, 500, request);
  }
}

async function handleReportChat(request: Request, env: Env, matchId: string): Promise<Response> {
  const session = await verifySession(request, env);
  if (!session) {
    return jsonResponse({ error: "Unauthorized" }, 401, request);
  }

  let body: { reason?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400, request);
  }
  const reason = (body.reason || "Inappropriate behavior").trim().slice(0, 500);

  try {
    const match = await env.DB.prepare(
      "SELECT user_a_id, user_b_id FROM Matches WHERE id = ? AND status = 'active'"
    )
      .bind(matchId)
      .first<{ user_a_id: string; user_b_id: string }>();

    if (!match || (match.user_a_id !== session.id && match.user_b_id !== session.id)) {
      return jsonResponse({ error: "Match not found or unauthorized" }, 404, request);
    }

    const reportedUserId = match.user_a_id === session.id ? match.user_b_id : match.user_a_id;

    await env.DB.prepare(
      "UPDATE Matches SET status = 'ended_by_report' WHERE id = ?"
    )
      .bind(matchId)
      .run();

    const reportId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO Reports (id, match_id, reporter_id, reported_user_id, reason)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(reportId, matchId, session.id, reportedUserId, reason || "Reported by user")
      .run();

    await env.DB.prepare(
      "UPDATE Users SET status = 'requeuing' WHERE id IN (?, ?) AND status = 'matched'"
    )
      .bind(match.user_a_id, match.user_b_id)
      .run();

    return jsonResponse({ success: true }, 200, request);
  } catch (err) {
    console.error("Report chat error:", err);
    return jsonResponse({ error: "Error reporting" }, 500, request);
  }
}

async function handleEndChat(request: Request, env: Env, matchId: string): Promise<Response> {
  const session = await verifySession(request, env);
  if (!session) {
    return jsonResponse({ error: "Unauthorized" }, 401, request);
  }

  try {
    // Verify user is part of this match
    const match = await env.DB.prepare(
      "SELECT user_a_id, user_b_id FROM Matches WHERE id = ? AND status = 'active'"
    )
      .bind(matchId)
      .first<{ user_a_id: string; user_b_id: string }>();

    if (!match || (match.user_a_id !== session.id && match.user_b_id !== session.id)) {
      return jsonResponse({ error: "Match not found or unauthorized" }, 404, request);
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

    return jsonResponse({ success: true }, 200, request);
  } catch (err) {
    console.error("End chat error:", err);
    return jsonResponse({ error: "Error ending chat" }, 500, request);
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

async function handleAdminReports(request: Request, env: Env): Promise<Response> {
  const result = await requireAdminSession(request, env);
  if ("status" in result) {
    return jsonResponse(
      { error: result.status === 401 ? "Unauthorized" : "Forbidden" },
      result.status,
      request
    );
  }
  try {
    const reports = await env.DB.prepare(
      `SELECT r.id, r.match_id, r.reporter_id, r.reported_user_id, r.reason, r.created_at,
              u1.username as reporter_username, u2.username as reported_username
       FROM Reports r
       JOIN Users u1 ON u1.id = r.reporter_id
       JOIN Users u2 ON u2.id = r.reported_user_id
       ORDER BY r.created_at DESC
       LIMIT 100`
    ).all<{
      id: string;
      match_id: string;
      reporter_id: string;
      reported_user_id: string;
      reason: string;
      created_at: string;
      reporter_username: string;
      reported_username: string;
    }>();
    return jsonResponse(reports.results || [], 200, request);
  } catch (err) {
    console.error("Admin reports error:", err);
    return jsonResponse({ error: "Error fetching reports" }, 500, request);
  }
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

async function handleAdminCouples(request: Request, env: Env): Promise<Response> {
  const result = await requireAdminSession(request, env);
  if ("status" in result) {
    return jsonResponse(
      { error: result.status === 401 ? "Unauthorized" : "Forbidden" },
      result.status,
      request
    );
  }

  try {
    const couples = await env.DB.prepare(
      `SELECT 
        m.id as match_id,
        m.created_at as match_created_at,
        u1.id as user_a_id,
        u1.username as user_a_username,
        u1.gender as user_a_gender,
        u2.id as user_b_id,
        u2.username as user_b_username,
        u2.gender as user_b_gender
       FROM Matches m
       JOIN Users u1 ON m.user_a_id = u1.id
       JOIN Users u2 ON m.user_b_id = u2.id
       WHERE m.status = 'active'
       ORDER BY m.created_at DESC`
    )
      .all<{
        match_id: string;
        match_created_at: string;
        user_a_id: string;
        user_a_username: string;
        user_a_gender: string | null;
        user_b_id: string;
        user_b_username: string;
        user_b_gender: string | null;
      }>();

    return jsonResponse(couples.results || [], 200, request);
  } catch (err) {
    console.error("Admin couples error:", err);
    return jsonResponse({ error: "Error fetching couples" }, 500, request);
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

  if (!body.user_id) {
    return jsonResponse({ error: "user_id is required" }, 400, request);
  }

  try {
    // Find ALL active matches for this user (handles whitelisted users with multiple matches)
    const result = await env.DB.prepare(
      `SELECT id, user_a_id, user_b_id
       FROM Matches
       WHERE (user_a_id = ? OR user_b_id = ?) AND status = 'active'`
    )
      .bind(body.user_id, body.user_id)
      .all<{ id: string; user_a_id: string; user_b_id: string }>();

    const matches = result.results || [];

    if (matches.length === 0) {
      return jsonResponse({ error: "No active matches found" }, 404, request);
    }

    // End all active matches for this user
    for (const match of matches) {
      await env.DB.prepare(
        "UPDATE Matches SET status = 'ended_by_admin' WHERE id = ?"
      )
        .bind(match.id)
        .run();

      // Requeue the other user (if they exist and aren't already in another match)
      const otherUserId = match.user_a_id === body.user_id ? match.user_b_id : match.user_a_id;
      await env.DB.prepare(
        "UPDATE Users SET status = 'requeuing' WHERE id = ?"
      )
        .bind(otherUserId)
        .run();
    }

    // Requeue the target user
    await env.DB.prepare(
      "UPDATE Users SET status = 'requeuing' WHERE id = ?"
    )
      .bind(body.user_id)
      .run();

    return jsonResponse({ success: true, unmatched_count: matches.length }, 200, request);
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

  // Validate both users exist
  if (!body.user_a_id || !body.user_b_id) {
    return jsonResponse({ error: "user_a_id and user_b_id are required" }, 400, request);
  }

  if (body.user_a_id === body.user_b_id) {
    return jsonResponse({ error: "Cannot match a user with themselves" }, 400, request);
  }

  try {
    // Fetch both users and their whitelist status
    const userA = await env.DB.prepare(
      "SELECT id, is_whitelisted FROM Users WHERE id = ?"
    )
      .bind(body.user_a_id)
      .first<{ id: string; is_whitelisted: number }>();

    const userB = await env.DB.prepare(
      "SELECT id, is_whitelisted FROM Users WHERE id = ?"
    )
      .bind(body.user_b_id)
      .first<{ id: string; is_whitelisted: number }>();

    if (!userA) {
      return jsonResponse({ error: "User A not found" }, 404, request);
    }
    if (!userB) {
      return jsonResponse({ error: "User B not found" }, 404, request);
    }

    // Check if User A already has an active match (unless whitelisted)
    const existingA = await env.DB.prepare(
      `SELECT id FROM Matches
       WHERE (user_a_id = ? OR user_b_id = ?) AND status = 'active'
       LIMIT 1`
    )
      .bind(body.user_a_id, body.user_a_id)
      .first<{ id: string }>();

    if (existingA && !userA.is_whitelisted) {
      return jsonResponse({ error: "User A already has an active match (not whitelisted)" }, 409, request);
    }

    // Check if User B already has an active match (unless whitelisted)
    const existingB = await env.DB.prepare(
      `SELECT id FROM Matches
       WHERE (user_a_id = ? OR user_b_id = ?) AND status = 'active'
       LIMIT 1`
    )
      .bind(body.user_b_id, body.user_b_id)
      .first<{ id: string }>();

    if (existingB && !userB.is_whitelisted) {
      return jsonResponse({ error: "User B already has an active match (not whitelisted)" }, 409, request);
    }

    // Create match
    const matchId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO Matches (id, user_a_id, user_b_id)
       VALUES (?, ?, ?)`
    )
      .bind(matchId, body.user_a_id, body.user_b_id)
      .run();

    // Update user statuses to 'matched' if they're not already
    await env.DB.prepare(
      "UPDATE Users SET status = 'matched' WHERE id IN (?, ?) AND status != 'matched'"
    )
      .bind(body.user_a_id, body.user_b_id)
      .run();

    return jsonResponse({ success: true, match_id: matchId }, 200, request);
  } catch (err) {
    console.error("Admin match error:", err);
    return jsonResponse({ error: "Error creating match" }, 500, request);
  }
}
