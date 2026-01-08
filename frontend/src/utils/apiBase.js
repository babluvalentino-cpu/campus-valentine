export const API_BASE = import.meta.env.VITE_API_BASE || "";

// Validate API_BASE in development
if (import.meta.env.DEV && !API_BASE) {
  console.warn(
    "⚠️ VITE_API_BASE is not set. API calls will fail.\n" +
    "Create a .env file in the frontend directory with:\n" +
    "VITE_API_BASE=https://your-worker.workers.dev"
  );
}
