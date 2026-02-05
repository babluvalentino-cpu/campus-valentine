// src/pages/Signup.jsx
import React, { useEffect, useState } from "react";
import { GeoFence } from "../components/GeoFence.jsx";
import { getFingerprintHash } from "../utils/fingerprint.js";
import { API_BASE, storeAuthToken } from "../utils/apiBase.js";
import { useNavigate } from "react-router-dom";

export function Signup() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fingerprint, setFingerprint] = useState(null);
  const [coords, setCoords] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getFingerprintHash().then(setFingerprint).catch(() => {
      // fallback handled in util
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.");
      return;
    }
    if (!fingerprint) {
      setError("Fingerprint not ready. Please wait a second and try again.");
      return;
    }

    // Check if API_BASE is configured
    if (!API_BASE) {
      setError("API configuration error. Please check console for details.");
      console.error("API_BASE is not set! Set VITE_API_BASE in .env file and rebuild.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: username.trim(),
          password,
          fingerprintHash: fingerprint,
          clientCoords: coords, // can be null
        }),
      });

      if (!res.ok) {
        let errorMessage = "Signup failed";
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          try {
            const errorData = await res.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            errorMessage = `Signup failed (${res.status})`;
          }
        } else {
          try {
            const text = await res.text();
            errorMessage = text || errorMessage;
          } catch {
            errorMessage = `Signup failed (${res.status})`;
          }
        }
        throw new Error(errorMessage);
      }

      // Parse response to check status
      const data = await res.json();
      // Store token for subsequent requests
      if (data.token) {
        storeAuthToken(data.token);
        console.log("✓ Auth token stored in localStorage");
      }
      // New users start with pending_profile status, redirect to profile setup
      navigate("/profile-setup");
    } catch (err) {
      console.error(err);
      setError(err.message || "Signup failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="w-full max-w-md bg-slate-900 p-6 rounded-xl shadow">
        <h2 className="text-2xl font-semibold mb-1">Create account</h2>
        <p className="text-xs text-slate-400 mb-4">
          Anonymous, campus-only. No real name, no email, no phone.
        </p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm mb-1">Username</label>
            <input
              type="text"
              className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-sm"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <GeoFence onCoordsChange={setCoords} />

          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-3 bg-pink-500 hover:bg-pink-600 disabled:bg-pink-800 py-2 rounded text-sm"
          >
            {submitting ? "Creating account..." : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
