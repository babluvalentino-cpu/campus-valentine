// Prefer build-time override, but fall back to the known Worker URL so Pages deploys work
export const API_BASE = import.meta.env.VITE_API_BASE || "https://campus-valentine-backend.campusvalentine.workers.dev";

// If the environment variable was missing at build time, log a reminder so maintainers can set it in Pages
if (!import.meta.env.VITE_API_BASE) {
  console.warn("VITE_API_BASE not set at build time; falling back to default Worker URL.");
}

// Helper to get auth token from localStorage
export function getStoredToken() {
  return localStorage.getItem("auth_token");
}

// Helper to store auth token in localStorage
export function storeAuthToken(token) {
  localStorage.setItem("auth_token", token);
}

// Clear auth token
export function clearAuthToken() {
  localStorage.removeItem("auth_token");
}

// Enhanced fetch wrapper that automatically includes Authorization header if token is stored
export async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = getStoredToken();
  
  // Build headers, merging any provided options
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Add Authorization header if token exists
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Always include credentials for cookie-based auth as fallback
  const fetchOptions = {
    ...options,
    headers,
    credentials: "include",
  };

  return fetch(url, fetchOptions);
}
