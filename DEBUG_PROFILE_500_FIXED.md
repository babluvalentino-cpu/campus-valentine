# Test Profile Update Error Fix

## Root Cause Analysis

The 500 error on profile update was caused by:
1. **Signup INSERT missing dietary_preference column** - New users didn't have this column in their INSERT, causing schema mismatch
2. **Profile update handler only checked for 'pending_profile' status** - But the condition was too strict with WHERE clause

## Fixes Applied

### Fix 1: Updated Signup Handler
```typescript
INSERT INTO Users (
  id, username, password_hash, fingerprint_hash,
  intent, year, residence, dietary_preference, profile_data, bio,
  status, geo_verified, is_whitelisted, is_admin
)
```
- **What changed**: Added `dietary_preference` to the column list and value list (NULL)
- **Why**: Ensures all users have the dietary_preference column properly initialized
- **Impact**: New users won't encounter missing column errors

### Fix 2: Improved Profile Update Handler
```typescript
// First check user's current status
const userCheck = await env.DB.prepare(
  "SELECT id, status FROM Users WHERE id = ?"
).bind(session.id).first();

// Allow update from pending_profile OR pending_match (retry case)
if (userCheck.status !== "pending_profile" && userCheck.status !== "pending_match") {
  return jsonResponse({ 
    error: `Profile cannot be updated in current state: ${userCheck.status}` 
  }, 409, request);
}

// Remove status condition from UPDATE - just use id
UPDATE Users SET ... WHERE id = ?
```
- **What changed**: 
  - Added pre-flight check to show exact status user is in
  - Allow update from both pending_profile and pending_match
  - Removed status condition from UPDATE (was preventing retry)
  - Added detailed error logging and messages
- **Why**: Provides visibility and allows retry logic to work
- **Impact**: Users get clear error messages, can retry safely

### Fix 3: Added Auto-Migration Fallback
```typescript
if (msg.includes("no such column: dietary_preference")) {
  await env.DB.prepare(`ALTER TABLE Users ADD COLUMN dietary_preference TEXT`).run();
  // Retry update
}
```
- **What changed**: Catches missing column error and auto-adds it
- **Why**: Safety net for any legacy databases missing the column
- **Impact**: Prevents 500 errors even if column is somehow missing

## Testing Checklist

- [ ] **New user signup** - Create account with username/password
- [ ] **Profile wizard completion** - Fill all 5 steps including dietary preference
- [ ] **Profile update request** - Should POST successfully to /api/profile
- [ ] **Check Cloudflare logs** - Verify debug logs show user status
- [ ] **Repeat with same user** - Verify retry logic doesn't break
- [ ] **Test login after profile** - Ensure /api/me works correctly

## Deployment Status

- ✅ TypeScript: PASS (no errors)
- ✅ Wrangler Deploy: SUCCESS (Version ID: 32825d6f-68fc-4e9a-9421-2b1c27bc72fa)
- ✅ Backend: LIVE at https://campus-valentine-backend.campusvalentine.workers.dev

## How to Debug Further

1. **Monitor Cloudflare Worker Logs**:
   ```bash
   npx wrangler tail campus-valentine-backend
   ```
   This will show real-time debug logs from the worker

2. **Check Database Status**:
   ```bash
   npx wrangler d1 execute campus-valentine-db --remote --command="PRAGMA table_info(Users);"
   ```
   This shows all columns in the Users table

3. **Manual Test with curl**:
   ```bash
   # After getting auth token from login
   curl -X POST https://campus-valentine-backend.campusvalentine.workers.dev/api/profile \
     -H "Content-Type: application/json" \
     -H "Cookie: auth_token=YOUR_TOKEN_HERE" \
     -d '{"dietary":"veg","gender":"male","seeking":"female",...}'
   ```

## Next Steps

1. Test signup → profile setup flow in browser
2. Monitor logs for any remaining errors
3. If still seeing 500s, share the exact error message from logs

---

**Deployed**: February 4, 2026
**Status**: READY FOR TESTING
