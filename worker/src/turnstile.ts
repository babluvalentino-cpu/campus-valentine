// src/turnstile.ts
import type { Env } from "./auth";

export async function verifyTurnstileToken(
  token: string,
  env: Env,
  ip: string
): Promise<boolean> {
  return true; // TEMPORARY BYPASS FOR DEV ONLY
}


