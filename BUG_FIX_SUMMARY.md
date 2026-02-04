# Bug Fix Summary: 401 Unauthorized CORS Issue

## Problem
New users were getting "Unauthorized" errors during signup/profile setup and login, while old users could access the system normally. The errors manifested as:
- During signup: "Profile setup error: Error: Unauthorized"
- During login: Page blinking/loading indefinitely for new users
- Backend: HTTP 401 responses from `/api/profile`, `/api/me` endpoints

## Root Cause
The issue was **CORS-related**, not an authentication logic problem. Several API endpoints were returning error responses without properly including the `request` parameter when calling `jsonResponse()`.

When `request` is not passed to `jsonResponse()`, it uses `getCorsHeadersFallback()` instead of `getCorsHeaders(request)`. This causes the response to have:
- Incorrect `Access-Control-Allow-Origin` header
- Missing or incorrect CORS credentials headers

When the frontend makes requests with `credentials: "include"`, and the response doesn't have matching CORS headers, the browser **blocks JavaScript from reading the response body**, even though the HTTP response is sent. The frontend sees the 401 error but cannot access the error details.

## Solution
Fixed all API error responses in protected endpoints to include the `request` parameter when calling `jsonResponse()`. This ensures:
1. Dynamic CORS headers are used based on the actual request origin
2. `Access-Control-Allow-Credentials: true` is properly set
3. The frontend can read error responses when credentials are included

## Files Modified
- `worker/src/worker.ts`

## Changes Made

### Protected Endpoints Fixed (8 functions):
1. **handleMe** (line 365): `/api/me` - Returns user info after auth
2. **handleProfileUpdate** (line 390): `/api/profile` POST - Updates profile for new users
3. **handleRunMatching** (line 460): `/api/admin/run-matching` - Admin endpoint
4. **handleGetMessages** (line 492): `/api/chat/:id` GET - Fetch messages
5. **handleSendMessage** (line 528): `/api/chat/:id` POST - Send message
6. **handleGetMatches** (line 582): `/api/matches` - Get user's matches
7. **handleReportChat** (line 643): `/api/chat/:id/report` - Report user
8. **handleEndChat** (line 697): `/api/chat/:id/end` - End match

### Detailed Changes
Added `request` parameter to all `jsonResponse()` calls in:
- Unauthorized (401) error responses
- Not Found (404) error responses
- Bad Request (400) error responses
- Other error responses in protected endpoints
- Success responses in protected endpoints for consistency

### Example
**Before:**
```typescript
async function handleMe(request: Request, env: Env): Promise<Response> {
  const session = await verifySession(request, env);
  if (!session) {
    return jsonResponse({ error: "Unauthorized" }, 401);  // ❌ Missing request
  }
  // ...
}
```

**After:**
```typescript
async function handleMe(request: Request, env: Env): Promise<Response> {
  const session = await verifySession(request, env);
  if (!session) {
    return jsonResponse({ error: "Unauthorized" }, 401, request);  // ✅ Includes request
  }
  // ...
}
```

## Testing
✅ TypeScript compilation: No errors (`npx tsc --noEmit`)

## Deployment Instructions
1. Deploy the worker with the fixed CORS headers:
   ```bash
   cd worker
   npm run deploy
   ```
2. Test signup for a new user
3. Test login for the new user
4. Verify profile setup completes without "Unauthorized" error

## Why This Happened
The code was written with the intention to use dynamic CORS headers, but some error response paths were overlooked and didn't pass the `request` parameter. This worked for old users because:
- Their sessions were already established (possibly with different browser/timing)
- Or they bypassed the affected error paths during their flow

New users hit the error paths immediately after signup/login when trying to access `/api/profile` and `/api/me`, which exposed the CORS issue.
