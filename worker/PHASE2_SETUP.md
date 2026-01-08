# Phase 2 Backend Setup - Status Report

## ✅ Completed Steps

### 1. Cleanup & Configuration
- ✅ Verified `wrangler.toml` is correct with database ID `7d550493-b752-4470-94bc-9f19517677de`
- ✅ Created and deployed temporary worker to establish clean deployment
- ✅ Deleted temporary worker file

### 2. Code Implementation
- ✅ Created `src/auth.ts` - Password hashing (PBKDF2), JWT creation/verification, session management
- ✅ Created `src/geofence.ts` - Location verification using polygon check
- ✅ Created `src/turnstile.ts` - Cloudflare Turnstile CAPTCHA verification
- ✅ Updated `src/worker.ts` - Real signup/login/me endpoints with validation
- ✅ Fixed TypeScript errors (changed `.get()` to `.first()` for D1 queries)
- ✅ Updated `tsconfig.json` with correct compiler options
- ✅ Updated `package.json` with dependencies (jose, @cloudflare/workers-types)

### 3. Git Setup
- ✅ Created branch `feat/backend-auth-signup-login`
- ✅ Committed all Phase-2 changes

## ⚠️ Manual Steps Required

### Step 6: Install Dependencies
**Run from `/worker` directory:**
```bash
cd C:\Users\starfish\Downloads\campus-valentine\worker
npm install
```

This will install:
- `jose` (JWT library)
- `@cloudflare/workers-types` (TypeScript definitions)

### Step 8: Set Required Secrets
**Run these commands from `/worker` directory:**

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
# Enter your Cloudflare Turnstile secret key from dashboard

npx wrangler secret put JWT_SECRET
# Enter a random 32+ character string (e.g., use: openssl rand -hex 32)

npx wrangler secret put ADMIN_SECRET
# Enter any secure random string (for future admin routes)
```

**Note:** For local development, you may want to temporarily modify `src/turnstile.ts` to bypass verification:
```typescript
export async function verifyTurnstileToken(...): Promise<boolean> {
  // Temporary: always return true for local dev
  return true;
  // ... rest of code
}
```

### Step 9: Deploy Real Worker
**After secrets are set:**
```bash
cd C:\Users\starfish\Downloads\campus-valentine\worker
npx wrangler deploy
```

### Step 10: Test Endpoints Locally
**Start dev server:**
```bash
cd C:\Users\starfish\Downloads\campus-valentine\worker
npx wrangler dev
```

**Test endpoints:**

1. **Health Check:**
   ```bash
   curl http://127.0.0.1:8787/api/health
   ```
   Expected: `{"ok":true}`

2. **Signup:**
   ```bash
   curl -X POST http://127.0.0.1:8787/api/signup \
     -H "Content-Type: application/json" \
     -d '{
       "username": "testuser",
       "password": "testpass123",
       "fingerprintHash": "test_fp_hash",
       "clientCoords": null,
       "turnstileToken": "dummy"
     }'
   ```
   **Note:** If Turnstile verification is enabled, use a real token or temporarily bypass it.

3. **Login:**
   ```bash
   curl -X POST http://127.0.0.1:8787/api/login \
     -H "Content-Type: application/json" \
     -d '{
       "username": "testuser",
       "password": "testpass123"
     }'
   ```
   **Note:** Save the cookie from the response for the `/api/me` test.

4. **Me (requires auth cookie):**
   ```bash
   curl http://127.0.0.1:8787/api/me \
     -H "Cookie: auth_token=YOUR_TOKEN_HERE"
   ```

### Step 11: Push and Create PR
**After all tests pass:**
```bash
cd C:\Users\starfish\Downloads\campus-valentine\worker
git push origin feat/backend-auth-signup-login
```

Then create a PR from `feat/backend-auth-signup-login` to `main` on GitHub.

## 📋 File Summary

- ✅ `worker/wrangler.toml` - Correct configuration
- ✅ `worker/package.json` - Dependencies added
- ✅ `worker/tsconfig.json` - Updated compiler options
- ✅ `worker/src/auth.ts` - Authentication utilities
- ✅ `worker/src/geofence.ts` - Location verification
- ✅ `worker/src/turnstile.ts` - CAPTCHA verification
- ✅ `worker/src/worker.ts` - Main worker with endpoints

## 🎯 Next Steps

1. Run `npm install` in the worker directory
2. Set the three secrets using `wrangler secret put`
3. Deploy with `npx wrangler deploy`
4. Test locally with `npx wrangler dev`
5. Push branch and create PR

All code is ready and committed to the `feat/backend-auth-signup-login` branch!


