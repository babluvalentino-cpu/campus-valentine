# 🚨 QUICK FIX: 405 Error on Signup

## The Problem
You're getting `405 Method Not Allowed` because `VITE_API_BASE` is not set. This causes requests to go to the Pages deployment instead of the Worker.

## ✅ IMMEDIATE FIX (5 minutes)

### Step 1: Find Your Worker URL
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** → Your Worker
3. Copy the URL (should be like `https://campus-valentine-backend.workers.dev`)

### Step 2: Create `.env` File
1. Go to `frontend/` directory
2. Create a file named `.env` (exactly this name, no extension)
3. Add this line (replace with YOUR Worker URL):
   ```env
   VITE_API_BASE=https://campus-valentine-backend.workers.dev
   ```

### Step 3: Rebuild Frontend
```bash
cd frontend
npm run build
```

### Step 4: Redeploy to Pages
- If using Git: Push and let Pages auto-deploy
- If manual: Upload the new `dist/` folder

## ✅ Verification

After deploying, check:
1. Open browser console
2. Type: `console.log(import.meta.env.VITE_API_BASE)`
3. Should show your Worker URL (NOT empty)

## 🐛 Still Not Working?

1. **Check `.env` file location**: Must be in `frontend/` directory
2. **Check file name**: Must be exactly `.env` (not `.env.local` or `.env.production`)
3. **Check format**: No quotes, no spaces around `=`
4. **Rebuild required**: Environment variables are baked into the build
5. **Clear cache**: Hard refresh (Ctrl+Shift+R) or clear browser cache

## 📝 Example `.env` File

```env
VITE_API_BASE=https://campus-valentine-backend.workers.dev
```

That's it! One line, no quotes, no spaces.

