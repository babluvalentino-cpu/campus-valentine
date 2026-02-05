// Prefer build-time override, but fall back to the known Worker URL so Pages deploys work
export const API_BASE = import.meta.env.VITE_API_BASE || "https://campus-valentine-backend.campusvalentine.workers.dev";

// If the environment variable was missing at build time, log a reminder so maintainers can set it in Pages
if (!import.meta.env.VITE_API_BASE) {
  console.warn("VITE_API_BASE not set at build time; falling back to default Worker URL.");
}
