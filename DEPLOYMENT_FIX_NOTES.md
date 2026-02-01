# 🚨 Critical Deployment Fix Notes

## Issue: 405 Method Not Allowed on Signup

### Root Cause
The error `POST https://92aec95a.campus-valentine-frontend.pages.dev/api/signup 405` indicates that:
1. **API_BASE is not set correctly** - Requests are going to Pages deployment instead of Worker
2. **Response body read error** - Fixed by checking content-type before parsing

### ✅ Fixes Applied

1. **Fixed Response Body Reading**
   - Frontend now checks `content-type` header before parsing JSON
   - Prevents "body stream already read" error

2. **Dynamic CORS Headers**
   - Worker now supports preview deployments (e.g., `92aec95a.campus-valentine-frontend.pages.dev`)
   - Automatically allows any preview deployment URL pattern

3. **Updated Error Handling**
   - All signup/login errors now use `jsonResponse()` with proper CORS
   - Consistent error format: `{ error: "message" }`

### 🔧 Required Configuration

**CRITICAL: Set VITE_API_BASE in frontend**

The frontend MUST have `VITE_API_BASE` set to point to your Worker, NOT the Pages deployment.

1. **Create/Update `.env` file in `frontend/` directory:**
   ```env
   VITE_API_BASE=https://campus-valentine-backend.workers.dev
   ```
   
   Replace with your actual Worker URL from Cloudflare Dashboard.

2. **For local development:**
   ```env
   VITE_API_BASE=http://localhost:8787
   ```

3. **Rebuild frontend after setting:**
   ```bash
   cd frontend
   npm run build
   ```

### ✅ Verification Steps

1. **Check API_BASE is set:**
   - Open browser console on signup page
   - Check if `API_BASE` is logged (if you add console.log)
   - Should NOT be empty string

2. **Test signup:**
   - Should reach Worker (check Network tab - URL should be Worker domain)
   - Should get proper CORS headers
   - Should parse errors correctly

3. **Check Worker logs:**
   - Cloudflare Dashboard → Workers → Your Worker → Logs
   - Should see signup requests coming through

### 🐛 If Still Getting 405

1. **Verify Worker is deployed:**
   ```bash
   cd worker
   npx wrangler deploy
   ```

2. **Check Worker URL:**
   - Cloudflare Dashboard → Workers → Your Worker
   - Copy the URL (should be `*.workers.dev`)

3. **Verify .env file:**
   - Must be in `frontend/` directory
   - Must be named `.env` (not `.env.local` unless using Vite's env loading)
   - Must have `VITE_API_BASE=...` (no quotes)

4. **Clear build cache:**
   ```bash
   cd frontend
   rm -rf dist node_modules/.vite
   npm run build
   ```

### 📝 Notes

- The 405 error happens when requests go to Pages (which doesn't have API routes)
- Worker handles all `/api/*` routes
- Pages only serves the frontend static files
- CORS now supports both production and preview deployments automatically

