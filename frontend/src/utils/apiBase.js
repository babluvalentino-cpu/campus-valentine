export const API_BASE = import.meta.env.VITE_API_BASE || "";

// Validate API_BASE - show error in both dev and production
if (!API_BASE) {
  const errorMsg = 
    "❌ CRITICAL: VITE_API_BASE is not configured!\n\n" +
    "API calls will fail. To fix:\n" +
    "1. Create a .env file in the frontend/ directory\n" +
    "2. Add: VITE_API_BASE=https://your-worker.workers.dev\n" +
    "3. Replace with your actual Worker URL from Cloudflare Dashboard\n" +
    "4. Rebuild: npm run build\n\n" +
    "Current API_BASE: (empty - requests will go to Pages deployment)";
  
  console.error(errorMsg);
  
  // Show user-friendly error in production
  if (!import.meta.env.DEV) {
    // Store error to show in UI
    window.__API_BASE_ERROR__ = "API configuration missing. Please contact administrator.";
  }
}
