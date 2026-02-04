# 🎯 Force Match/Unmatch Quick Reference

## The Problem
Some users were getting `{"error":"Error creating match"}` when admins tried to force match them.

## Root Causes (5 bugs)
1. **Whitelist check applied to wrong user** - Checked User B's whitelist for User A's match conflict
2. **Status lock** - Only allowed matching users in `pending_match` or `requeuing` state
3. **Missing validation** - Didn't check if users existed or if matching self
4. **Multiple match limit** - handleAdminUnmatch only handled first match, ignoring whitelisted users' other matches
5. **Bad error parsing** - Frontend converted error JSON to text, losing specific error info

## All Fixes Applied ✅

### Backend (worker/src/worker.ts)
- ✅ Check **each user's whitelist individually**
- ✅ Allow matching users in **any status** (except already matched to same user)
- ✅ Validate **user existence and uniqueness**
- ✅ Handle **all active matches** for whitelisted users
- ✅ Return **clear, descriptive error messages**

### Frontend (frontend/src/pages/Admin.jsx)
- ✅ Parse JSON error responses
- ✅ Display specific error messages to admins
- ✅ Show match ID on success

## How to Use

### Force Match Two Users
1. Go to Admin Dashboard
2. Find User A in the list
3. Click "Force Match" button
4. Select User B from dropdown
5. Click "Confirm Match"
6. **Result:** Match created instantly, celebration popup shows

### Unmatch Users
1. Go to Admin Dashboard
2. Find matched user
3. Click "Unmatch" button (red)
4. Confirm in dialog
5. **Result:** Match ended, users back to `requeuing` state

### Whitelist a User (allows multiple matches)
1. Go to Admin Dashboard
2. Find user
3. Click "Add WL" button
4. **Result:** User can now have multiple active matches

## Key Differences Now

| Feature | Before | After |
|---------|--------|-------|
| Whitelist check | Checked User B for both users | Checks each user individually |
| User status | Must be `pending_match` or `requeuing` | Can be any status |
| Input validation | None | Full validation of user existence |
| Multiple matches | Only first match unmatched | All matches unmatched |
| Error clarity | Generic "Error creating match" | Specific error messages |

## Testing Commands

### Check if force match works
```bash
curl -X POST https://campus-valentine-backend.campusvalentine.workers.dev/api/admin/match \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<your_admin_session>" \
  -d '{"user_a_id":"uuid1","user_b_id":"uuid2"}'
```

### Check if unmatch works
```bash
curl -X POST https://campus-valentine-backend.campusvalentine.workers.dev/api/admin/unmatch \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<your_admin_session>" \
  -d '{"user_id":"uuid"}'
```

## Success Indicators ✅
- Admin can match **any users** regardless of status
- Whitelisted users can have **2+ active matches**
- Admin can **unmatch all matches** for a user at once
- **Specific error messages** shown when something fails
- Match IDs returned on success
- Users properly transitioned to `matched` status

---
**Deployed:** February 4, 2026  
**Version:** 856f5846-71e1-4c1e-8bad-5aeb6145484e
