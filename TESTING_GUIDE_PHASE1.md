# Quick Testing Guide - Phase 1 Features

## Test Scenario 1: Dietary Preferences in Matching

### Setup
1. Create **User A** (Vegetarian):
   - Username: `alice_veg`
   - In Profile Setup, Step 1: Select "Veg"
   - Complete profile and go to Dashboard

2. Create **User B** (Vegetarian):
   - Username: `bob_veg`
   - In Profile Setup, Step 1: Select "Veg"
   - Complete profile and go to Dashboard

3. Create **User C** (Non-Veg):
   - Username: `charlie_nonveg`
   - In Profile Setup, Step 1: Select "Non-Veg"
   - Complete profile and go to Dashboard

### Expected Results
- When matching runs, **Alice** and **Bob** should be prioritized (same diet = +50 points)
- **Charlie** will be matched with one of them if no other options, but with lower score
- In Admin Dashboard: Look at match scores to confirm dietary bonus applied

---

## Test Scenario 2: Smart Icebreaker Display

### Setup
1. Create **User D** (Plays Table Tennis & Basketball):
   - Step 3 (Hobbies): Select "Table Tennis" and "Basketball"

2. Create **User E** (Plays Table Tennis & Badminton):
   - Step 3 (Hobbies): Select "Table Tennis" and "Badminton"

### Force Match in Admin
- Use Admin Dashboard: "Force Match" D with E
- Both should share "Table Tennis" interest

### Test Icebreaker
1. **User D** opens chat with **User E**
2. Should see pink gradient card:
   - 💡 "Conversation Starter"
   - "You both love Table Tennis!..."
3. After sending first message, card disappears
4. **User E** opens same chat: No icebreaker (messages exist)

### Expected Results
- Icebreaker shows for User D (no messages yet)
- Icebreaker matches shared sports
- Disappears after message sent
- Generic fallback if no sports match

---

## Test Scenario 3: Word Filter - Links

### Setup
1. Create **User F** and **User G**, match them

### Test in Chat
1. **User F** sends: `Check this out https://example.com/spam`
2. **Before sending:**
   - Warning appears: ⚠️ "Links are not allowed in messages"
3. **After sending:**
   - **User G** receives: `Check this out [LINK REMOVED]`
4. Try sending: `Visit my site: http://phishing.evil.com`
   - Same result: URL sanitized to `[LINK REMOVED]`

### Expected Results
- Client-side warning shows immediately
- Backend sanitizes URLs before storage
- Other user sees sanitized version
- Links cannot be used for phishing/spam

---

## Test Scenario 4: Word Filter - Profanity

### Setup
1. Users F and G already matched

### Test in Chat
1. **User F** sends a message with offensive language
2. **User G** receives the message with words replaced by `***`

### Expected Results
- Offensive words are censored
- Message is still readable
- Other user stays protected

---

## Test Scenario 5: Dietary Compatibility Conversation

### Setup
1. Create **User H** (Veg):
   - Step 1: Select "Veg"
   - Dietary preference saved

2. Create **User I** (Non-Veg):
   - Step 1: Select "Non-Veg"
   - Dietary preference saved

### Force Match H with I in Admin

### Test Icebreaker
1. **User H** opens chat
2. Should see icebreaker like:
   - "Veg and Non-Veg – can we make this work? 😄 Let's find a restaurant both of us will love!"
3. **User I** opens chat
4. Should see same icebreaker

### Expected Results
- Icebreaker acknowledges dietary difference
- Suggests finding compatible restaurant
- Sets tone for date planning discussion

---

## Admin Testing Checklist

### Admin Dashboard
1. Go to **Admin Panel** (/admin)
2. Look at **Users Table:**
   - New users should have dietary preference visible in profile
3. Create a **manual match**:
   - Check if icebreaker is generated in match response
   - ✅ Verify API returns `icebreaker` field

### Database Check (via D1 Dashboard)
```sql
SELECT id, username, dietary_preference 
FROM Users 
LIMIT 5;
```
Should show dietary preferences for newly created users.

---

## API Testing (curl/Postman)

### Get Matches with Icebreaker
```bash
curl -X GET https://campus-valentine-backend.campusvalentine.workers.dev/api/matches \
  -H "Cookie: auth_token=YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

Response should include:
```json
{
  "id": "match-id",
  "partner": { "id": "...", "username": "..." },
  "last_message": "...",
  "last_message_at": "...",
  "icebreaker": "You both love Table Tennis!..."
}
```

### Send Message with URL Filter
```bash
curl -X POST https://campus-valentine-backend.campusvalentine.workers.dev/api/chat/MATCH_ID \
  -H "Cookie: auth_token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Check this https://example.com/spam"}'
```

Response should show:
```json
{
  "content": "Check this [LINK REMOVED]",
  "created_at": "...",
  ...
}
```

---

## Debugging

### If Icebreaker Doesn't Show
1. Check browser console for errors
2. Verify API response includes `icebreaker` field
3. Check if messages exist (icebreaker only shows on first open)
4. Verify sports intersection calculation in backend logs

### If Word Filter Doesn't Work
1. Check if URL pattern matches
2. Verify message reaches database in sanitized form
3. Check browser console for warnings
4. Test with exact pattern: `https://` (case matters)

### If Dietary Preference Not Saved
1. Check Profile Setup Step 1 submission
2. Verify profile_data JSON includes `dietary` field
3. Check if dietary_preference column in Users table has value
4. Run: `SELECT dietary_preference FROM Users WHERE id=?`

---

## Quick Test Commands

### Test New User Signup & Profile
```bash
# 1. Signup
curl -X POST https://campus-valentine-backend.campusvalentine.workers.dev/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser123",
    "password": "Test@1234",
    "fingerprintHash": "test-hash-123",
    "clientCoords": null
  }' \
  -c cookies.txt

# 2. Set Profile with Dietary
curl -X POST https://campus-valentine-backend.campusvalentine.workers.dev/api/profile \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "gender": "male",
    "seeking": "female",
    "intent": "relationship",
    "year": 2,
    "residence": "hosteller",
    "dietary": "veg",
    "profileData": {
      "sports": ["table_tennis"],
      "dietary": "veg"
    }
  }'
```

---

## Expected Timeline

- **Dietary Preference:** ✅ Live (no migration needed)
- **Word Filter:** ✅ Live (client + server)
- **Smart Icebreaker:** ✅ Live (generation on /api/matches)

All features should be immediately testable after deployment!

---

*Last Updated: February 4, 2026*
