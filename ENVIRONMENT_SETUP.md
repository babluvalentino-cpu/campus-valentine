# Environment Variables Setup Guide

This document describes all environment variables required for the Campus Valentine application.

---

## 🔧 Backend Environment Variables (Cloudflare Workers)

These are set in the Cloudflare Dashboard under your Worker's Settings → Variables and Secrets.

### Required Variables

1. **`TURNSTILE_SECRET`**
   - **Type:** Secret
   - **Description:** Cloudflare Turnstile secret key for CAPTCHA verification
   - **How to get:** 
     - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
     - Navigate to Turnstile
     - Create a site or use existing site
     - Copy the **Secret Key**
   - **Example:** `0x4AAAAAAABkMYinukE8v5YFgQ5K1Q1X2Y3Z4A5B6C7D8E9F0G1H2I3J4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9Z0`

2. **`JWT_SECRET`**
   - **Type:** Secret
   - **Description:** Secret key for signing JWT session tokens
   - **How to generate:** Use a strong random string (at least 32 characters)
   - **Example:** `your-super-secret-jwt-key-change-this-in-production-12345678901234567890`
   - **⚠️ Important:** Use a different value in production!

3. **`ADMIN_SECRET`**
   - **Type:** Secret
   - **Description:** Secret key for admin panel authentication (used in `x-admin-secret` header)
   - **How to generate:** Use a strong random string (at least 32 characters)
   - **Example:** `your-admin-secret-key-change-this-in-production-98765432109876543210`
   - **⚠️ Important:** Keep this secure! Anyone with this key can access admin panel.

### Setting Variables in Cloudflare

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your account
3. Go to **Workers & Pages**
4. Select your worker: `campus-valentine-backend`
5. Go to **Settings** → **Variables and Secrets**
6. Add each variable:
   - Click **Add variable**
   - Enter variable name
   - Enter value (or use **Encrypt** for secrets)
   - Click **Save**

---

## 🎨 Frontend Environment Variables

These are set in a `.env` file in the `frontend/` directory.

### Required Variables

1. **`VITE_API_BASE`**
   - **Type:** String
   - **Description:** Base URL for the backend API
   - **Production Example:** `https://campus-valentine-backend.campusvalentine.workers.dev`
   - **Development Example:** `http://localhost:8787` (if using `wrangler dev`)

### Setting Up Frontend Environment

1. Create a `.env` file in the `frontend/` directory:
   ```bash
   cd frontend
   touch .env
   ```

2. Add the variable:
   ```env
   VITE_API_BASE=https://campus-valentine-backend.campusvalentine.workers.dev
   ```

3. For local development:
   ```env
   VITE_API_BASE=http://localhost:8787
   ```

4. **Important:** Add `.env` to `.gitignore` if it contains secrets:
   ```gitignore
   # .gitignore
   frontend/.env
   frontend/.env.local
   frontend/.env.production
   ```

### Environment File Examples

**`.env.development`** (for local dev):
```env
VITE_API_BASE=http://localhost:8787
```

**`.env.production`** (for production build):
```env
VITE_API_BASE=https://campus-valentine-backend.campusvalentine.workers.dev
```

---

## 🚀 Quick Setup Commands

### Backend (Cloudflare Dashboard)
1. Navigate to Workers & Pages → Your Worker → Settings → Variables
2. Add all three secrets: `TURNSTILE_SECRET`, `JWT_SECRET`, `ADMIN_SECRET`

### Frontend (Local)
```bash
cd frontend
echo "VITE_API_BASE=https://campus-valentine-backend.campusvalentine.workers.dev" > .env
```

---

## ✅ Verification

### Backend
After setting variables, test with:
```bash
cd worker
npx wrangler dev
```
Check console for any missing variable errors.

### Frontend
After setting `.env`, test with:
```bash
cd frontend
npm run dev
```
Check browser console for API connection errors.

---

## 🔒 Security Notes

1. **Never commit secrets to Git**
   - Use Cloudflare's encrypted secrets for backend
   - Add `.env` files to `.gitignore` for frontend

2. **Use different secrets for production**
   - Never reuse development secrets in production
   - Rotate secrets periodically

3. **Admin Secret**
   - Keep `ADMIN_SECRET` extremely secure
   - Only share with trusted administrators
   - Consider using a password manager

---

## 📝 Summary

**Backend (Cloudflare):**
- `TURNSTILE_SECRET` (Secret)
- `JWT_SECRET` (Secret)
- `ADMIN_SECRET` (Secret)

**Frontend (`.env`):**
- `VITE_API_BASE` (String)

---

**Last Updated:** December 8, 2025
