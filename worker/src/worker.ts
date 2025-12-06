// src/worker.ts
import { Env, hashPassword, verifyPassword, createSessionToken, createAuthCookie, verifySession } from "./auth";
import { verifyTurnstileToken } from "./turnstile";
import { computeGeoVerified } from "./geofence";

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

    return new Response("Not found", { status: 404 });
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

  const isHuman = await verifyTurnstileToken(turnstileToken, env, ip);
  if (!isHuman) {
    return new Response("CAPTCHA verification failed.", { status: 403 });
  }

  const geoVerified = computeGeoVerified(request, clientCoords);

  const passwordHash = await hashPassword(password);
  const userId = crypto.randomUUID();

  try {
    // Enforce unique username and fingerprint
    const existing = await env.DB.prepare(
      "SELECT id FROM Users WHERE username = ? OR fingerprint_hash = ?"
    )
      .bind(username, fingerprintHash)
      .all<{ id: string }>();

    if (existing.results && existing.results.length > 0) {
      return new Response("Username or device already registered.", { status: 409 });
    }

    await env.DB.prepare(
      `INSERT INTO Users (id, username, password_hash, fingerprint_hash, geo_verified)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(userId, username, passwordHash, fingerprintHash, geoVerified)
      .run();

    const token = await createSessionToken(env, { id: userId, isAdmin: false });
    const headers = new Headers({
      "Content-Type": "application/json",
      "Set-Cookie": createAuthCookie(token),
    });

    return new Response(JSON.stringify({ id: userId, username, geo_verified: geoVerified }), {
      status: 201,
      headers,
    });
  } catch (err: any) {
    // Note: D1 error message varies; we already manually checked uniqueness.
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
