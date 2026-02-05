// src/auth.ts
import { SignJWT, jwtVerify } from "jose";

export interface SessionUser {
  id: string;
  isAdmin: boolean;
}

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  ADMIN_SECRET: string;
}

function getJwtSecretKey(env: Env): Uint8Array {
  // Fallback to a development secret if not configured
  const secret = env.JWT_SECRET || "dev_secret_change_me_in_production_please_12345";
  
  if (!secret || secret.trim() === "") {
    throw new Error("JWT_SECRET is not configured");
  }
  
  // Log to console if using fallback (development only)
  if (!env.JWT_SECRET) {
    console.warn("⚠️ WARNING: JWT_SECRET not configured, using fallback. This is insecure in production!");
  }
  
  return new TextEncoder().encode(secret);
}

const ISSUER = "urn:campus-match:issuer";
const AUDIENCE = "urn:campus-match:audience";

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 100_000;
  const hashBits = 256;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    key,
    hashBits
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  const saltArray = Array.from(salt);
  const saltHex = saltArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return `${iterations}:${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [iterationsStr, saltHex, hashHex] = stored.split(":");
    const iterations = parseInt(iterationsStr, 10);

    const saltBytes = new Uint8Array(
      (saltHex.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16))
    );
    const hashBytes = new Uint8Array(
      (hashHex.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16))
    );

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltBytes,
        iterations,
        hash: "SHA-256",
      },
      key,
      hashBytes.length * 8
    );

    const derived = new Uint8Array(derivedBits);
    if (derived.length !== hashBytes.length) return false;

    let diff = 0;
    for (let i = 0; i < derived.length; i++) {
      diff |= derived[i] ^ hashBytes[i];
    }
    return diff === 0;
  } catch {
    return false;
  }
}

export async function createSessionToken(env: Env, user: SessionUser): Promise<string> {
  try {
  const secret = getJwtSecretKey(env);
  return await new SignJWT({ sub: user.id, isAdmin: user.isAdmin })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime("7d")
    .sign(secret);
  } catch (err) {
    console.error("Failed to create session token:", err);
    throw new Error("Server configuration error: JWT_SECRET not set");
  }
}

export function createAuthCookie(token: string): string {
  // 7 days. SameSite=None + Secure required for cross-origin (frontend on Pages, backend on Workers)
  const maxAge = 7 * 24 * 60 * 60;
  return `auth_token=${token}; HttpOnly; Secure; Path=/; SameSite=None; Max-Age=${maxAge}`;
}

export function clearAuthCookie(): string {
  return `auth_token=; HttpOnly; Secure; Path=/; SameSite=None; Max-Age=0`;
}

export async function verifySession(request: Request, env: Env): Promise<SessionUser | null> {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/auth_token=([^;]+)/);
  if (!match) {
    // Log if no cookie found - this helps debug CORS/cookie issues
    console.log("⚠️ No auth_token cookie found in request");
    return null;
  }

  const token = match[1];
  try {
    const secret = getJwtSecretKey(env);
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    console.log("✓ Session verified for user:", payload.sub);
    return {
      id: payload.sub as string,
      isAdmin: Boolean(payload.isAdmin),
    };
  } catch (err) {
    // Log error for debugging
    if (err instanceof Error) {
      console.warn("⚠️ Session verification failed:", err.message);
      if (err.message.includes("JWT_SECRET")) {
        console.error("❌ JWT_SECRET not configured");
      }
    }
    return null;
  }
}


