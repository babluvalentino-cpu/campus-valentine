# 🚀 Deployment Checklist

Complete checklist for deploying Campus Valentine to production.

---

## ✅ Pre-Deployment Checklist

### Backend (Cloudflare Workers)

- [x] All API endpoints implemented
- [x] Environment variables configured in Cloudflare Dashboard:
  - [ ] `TURNSTILE_SECRET` (Secret)
  - [ ] `JWT_SECRET` (Secret)
  - [ ] `ADMIN_SECRET` (Secret)
- [x] Database schema applied to D1 database
- [x] Cron trigger configured (`wrangler.toml`)
- [x] Type checking passes: `cd worker && npx wrangler types`
- [ ] Test all endpoints locally: `npx wrangler dev`
- [ ] Create admin user in database

### Frontend

- [x] All components implemented
- [x] Environment variable configured:
  - [ ] `VITE_API_BASE` in `.env` file
- [x] Routing configured
- [x] Error handling implemented
- [ ] Build test: `npm run build`
- [ ] Test locally: `npm run dev`

---

## 🔧 Deployment Steps

### 1. Backend Deployment

```bash
cd worker

# 1. Verify types
npx wrangler types

# 2. Test locally (optional)
npx wrangler dev

# 3. Deploy to production
npx wrangler deploy
```

**After deployment:**
- [ ] Verify worker is running: Check Cloudflare Dashboard
- [ ] Test health endpoint: `curl https://your-worker.workers.dev/api/health`
- [ ] Create admin user (see below)

### 2. Create Admin User

```bash
# Set a user as admin
npx wrangler d1 execute campus-valentine-db --remote --command "
UPDATE Users SET is_admin = 1 WHERE username='your-admin-username';
"

# Verify
npx wrangler d1 execute campus-valentine-db --remote --command "
SELECT username, is_admin FROM Users WHERE username='your-admin-username';
"
```

### 3. Frontend Deployment

**Option A: Deploy to Cloudflare Pages**

```bash
cd frontend

# 1. Build
npm run build

# 2. Deploy (if using Wrangler)
npx wrangler pages deploy dist

# OR use Cloudflare Dashboard:
# - Go to Pages
# - Connect repository or upload dist folder
# - Set build command: npm run build
# - Set output directory: dist
# - Add environment variable: VITE_API_BASE
```

**Option B: Deploy to other hosting**

1. Build: `npm run build`
2. Upload `dist/` folder to your hosting provider
3. Configure environment variable `VITE_API_BASE`

---

## 🧪 Post-Deployment Testing

### Authentication Flow
- [ ] Sign up new user
- [ ] Verify redirect to profile setup
- [ ] Complete profile wizard
- [ ] Verify redirect to dashboard
- [ ] Login with existing user
- [ ] Logout works

### Profile Management
- [ ] Profile wizard collects all fields (including gender/seeking)
- [ ] Profile saves successfully
- [ ] Status updates to `pending_match`

### Matching
- [ ] Admin can trigger matching manually
- [ ] Cron job runs automatically (check logs)
- [ ] Matches are created correctly
- [ ] Users see matches on dashboard

### Chat
- [ ] Users can open chat from dashboard
- [ ] Messages send successfully
- [ ] Messages display correctly
- [ ] End chat functionality works

### Admin Panel
- [ ] Admin can access with secret key
- [ ] Admin can view all users
- [ ] Admin can toggle whitelist
- [ ] Admin can force match
- [ ] Admin can unmatch users

---

## 🔍 Verification Commands

### Test Backend Health
```bash
curl https://your-worker.workers.dev/api/health
```

### Test Signup (with dummy Turnstile token)
```bash
curl -X POST https://your-worker.workers.dev/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpass123",
    "fingerprintHash": "test-fp",
    "clientCoords": null,
    "turnstileToken": "dummy"
  }'
```

### Test Admin Endpoint
```bash
curl https://your-worker.workers.dev/api/admin/users \
  -H "x-admin-secret: YOUR_ADMIN_SECRET"
```

---

## ⚠️ Important Notes

1. **Turnstile Token**: In production, ensure Turnstile is properly configured and not bypassed
2. **CORS**: If frontend is on different domain, configure CORS in worker
3. **Database**: Ensure D1 database is in production mode (not preview)
4. **Secrets**: Never commit secrets to Git
5. **Admin Secret**: Keep admin secret secure and rotate periodically

---

## 🐛 Troubleshooting

### Backend Issues

**Worker not deploying:**
- Check `wrangler.toml` configuration
- Verify environment variables are set
- Check Cloudflare account limits

**Database errors:**
- Verify D1 database binding in `wrangler.toml`
- Check database ID matches
- Ensure schema is applied

### Frontend Issues

**API calls failing:**
- Verify `VITE_API_BASE` is set correctly
- Check CORS configuration
- Verify worker is deployed and accessible

**Build errors:**
- Run `npm install` to ensure dependencies
- Check Node.js version (should be 18+)
- Clear build cache: `rm -rf dist node_modules/.vite`

---

## 📊 Monitoring

After deployment, monitor:
- Cloudflare Worker logs
- D1 database usage
- API response times
- Error rates
- User signups and matches

---

**Last Updated:** December 8, 2025
