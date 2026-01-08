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

  let body: ProfileBody & {
    intent?: string;
    year?: number;
    residence?: string;
  };

  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const gender = (body.gender || "").trim();
  const seeking = (body.seeking || "").trim();
  const interests = Array.isArray(body.interests) ? body.interests : [];
  const bio = (body.bio || "").trim();

  // Additional Phase-3 fields
  const intent = (body.intent || "relationship").trim();
  const year = Number(body.year || 1);
  const residence = body.residence || null;

  // Validate gender
  if (!GENDER_OPTIONS.includes(gender as any)) {
    return new Response("Invalid gender.", { status: 400 });
  }

  // Validate seeking
  if (!SEEKING_OPTIONS.includes(seeking as any)) {
    return new Response("Invalid seeking preference.", { status: 400 });
  }

  // Validate interests
  if (interests.length === 0) {
    return new Response("At least one interest is required.", { status: 400 });
  }

  const normalizedInterests: string[] = [];
  for (const raw of interests) {
    const val = String(raw).trim();
    if (!INTEREST_SET.has(val as any)) {
      return new Response("Invalid interest value.", { status: 400 });
    }
    if (!normalizedInterests.includes(val)) {
      normalizedInterests.push(val);
    }
  }

  if (bio.length > 200) {
    return new Response("Bio too long.", { status: 400 });
  }

  // Build profile_data JSON
  const profileDataJson = JSON.stringify({
    interests: normalizedInterests,
    bio,
  });

  try {
    const result = await env.DB.prepare(
      `UPDATE Users
       SET gender = ?, seeking = ?, intent = ?, year = ?, residence = ?,
           profile_data = ?, bio = ?, status = 'pending_match'
       WHERE id = ? AND status = 'pending_profile'`
    )
      .bind(
        gender,
        seeking,
        intent,
        year,
        residence,
        profileDataJson,
        bio,
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
