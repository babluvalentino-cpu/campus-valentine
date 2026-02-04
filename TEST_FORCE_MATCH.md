# Test Force Match/Unmatch Features

## Prerequisites
- Admin user logged in
- Get your session cookie (check browser DevTools → Application → Cookies)
- Replace `$SESSION_COOKIE` with actual value

## Test Suite

### Test 1: Simple Force Match
```powershell
$sessionCookie = "session=YOUR_SESSION_HERE"
$headers = @{
    "Content-Type" = "application/json"
    "Cookie" = $sessionCookie
}

$body = @{
    user_a_id = "user-uuid-1"
    user_b_id = "user-uuid-2"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "https://campus-valentine-backend.campusvalentine.workers.dev/api/admin/match" `
    -Method POST `
    -Headers $headers `
    -Body $body

$response.Content | ConvertFrom-Json | Format-Table
```

**Expected Output:**
```json
{
  "success": true,
  "match_id": "uuid-here"
}
```

---

### Test 2: Attempt to Match Non-Existent User
```powershell
$body = @{
    user_a_id = "fake-uuid"
    user_b_id = "user-uuid-2"
} | ConvertTo-Json

# Should return 404 with "User A not found"
```

---

### Test 3: Attempt to Match User to Self
```powershell
$body = @{
    user_a_id = "same-uuid"
    user_b_id = "same-uuid"
} | ConvertTo-Json

# Should return 400 with "Cannot match a user with themselves"
```

---

### Test 4: Unmatch Single User
```powershell
$body = @{
    user_id = "user-uuid-1"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "https://campus-valentine-backend.campusvalentine.workers.dev/api/admin/unmatch" `
    -Method POST `
    -Headers $headers `
    -Body $body

$response.Content | ConvertFrom-Json | Format-Table
```

**Expected Output:**
```json
{
  "success": true,
  "unmatched_count": 1
}
```

---

### Test 5: Create Multiple Matches for Whitelisted User
```powershell
# Step 1: Add User A to whitelist
$whitelistBody = @{
    user_id = "user-uuid-a"
    is_whitelisted = 1
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://campus-valentine-backend.campusvalentine.workers.dev/api/admin/whitelist" `
    -Method POST `
    -Headers $headers `
    -Body $whitelistBody

# Step 2: Create first match (A ↔ B1)
$match1Body = @{
    user_a_id = "user-uuid-a"
    user_b_id = "user-uuid-b1"
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://campus-valentine-backend.campusvalentine.workers.dev/api/admin/match" `
    -Method POST `
    -Headers $headers `
    -Body $match1Body

# Step 3: Create second match (A ↔ B2)
$match2Body = @{
    user_a_id = "user-uuid-a"
    user_b_id = "user-uuid-b2"
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://campus-valentine-backend.campusvalentine.workers.dev/api/admin/match" `
    -Method POST `
    -Headers $headers `
    -Body $match2Body

# Step 4: Unmatch all
$unmatchBody = @{
    user_id = "user-uuid-a"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "https://campus-valentine-backend.campusvalentine.workers.dev/api/admin/unmatch" `
    -Method POST `
    -Headers $headers `
    -Body $unmatchBody

$response.Content | ConvertFrom-Json | Format-Table
```

**Expected Output:**
```json
{
  "success": true,
  "unmatched_count": 2
}
```

---

### Test 6: UI Testing - Force Match via Admin Panel
1. Navigate to Admin Dashboard
2. Search for User A in the table
3. Click "Force Match" button
4. A modal appears with User A's details
5. Type or select User B's ID
6. Click "Confirm Match"
7. Success message appears: "Match Created Successfully! (ID: match-uuid)"
8. Table refreshes showing both users as "matched"

---

### Test 7: UI Testing - Unmatch via Admin Panel
1. Navigate to Admin Dashboard
2. Find a matched user
3. Click "Unmatch" button (red button)
4. Confirm in dialog
5. Success message: "Match broken successfully."
6. Table refreshes, user status changes to "requeuing"

---

### Test 8: Error Handling - Missing Required Fields
```powershell
# Missing user_b_id
$body = @{
    user_a_id = "user-uuid-1"
} | ConvertTo-Json

# Should return 400 with "user_a_id and user_b_id are required"
```

---

### Test 9: Error Handling - User Already Matched (non-whitelisted)
```powershell
# Assume User A is already matched to User C
# Try to match User A to User B (without whitelisting)

$body = @{
    user_a_id = "user-a"  # Already matched to User C
    user_b_id = "user-b"
} | ConvertTo-Json

# Should return 409 with "User A already has an active match (not whitelisted)"
```

---

### Test 10: Integration - Check Database State After Match
```sql
-- After successful force match
SELECT * FROM Matches WHERE status = 'active' ORDER BY created_at DESC LIMIT 5;

-- Should show the newly created match

-- Check user statuses
SELECT id, username, status FROM Users WHERE id IN ('user-a', 'user-b');

-- Both should show status = 'matched'
```

---

## Debugging Checklist

If tests fail:

1. **Check Admin Session**
   ```powershell
   Invoke-WebRequest -Uri "https://campus-valentine-backend.campusvalentine.workers.dev/api/me" `
       -Headers @{ "Cookie" = "session=YOUR_SESSION" }
   ```
   Should return: `{ "isAdmin": true }`

2. **Check User Exists**
   ```sql
   SELECT id, username, status, is_whitelisted FROM Users WHERE id = 'test-user-id';
   ```

3. **Check Match Status**
   ```sql
   SELECT * FROM Matches WHERE user_a_id = 'test-user-id' OR user_b_id = 'test-user-id';
   ```

4. **Check Logs**
   ```
   Cloudflare Workers dashboard → campus-valentine-backend → Logs
   Look for "Admin match error" or "Admin unmatch error"
   ```

---

## Success Indicators

All tests pass when:
- ✅ Force match creates match instantly
- ✅ Specific error messages for each failure case
- ✅ Whitelisted users can have multiple matches
- ✅ Unmatch breaks all matches for whitelisted users
- ✅ User statuses update correctly
- ✅ Frontend shows success/error messages clearly
- ✅ No "Error creating match" generic errors

---

**Last Updated:** February 4, 2026  
**Worker Version:** 856f5846-71e1-4c1e-8bad-5aeb6145484e
