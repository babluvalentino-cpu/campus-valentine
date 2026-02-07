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
          clientCoords: coords,
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

      const data = await res.json();
      if (data.token) {
        storeAuthToken(data.token);
        console.log("✓ Auth token stored in localStorage");
      }
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

          <div className="mb-6 p-4 bg-red-900/30 border-l-4 border-red-500 rounded-r-lg">
            <p className="text-red-200 text-sm leading-relaxed">
              <span className="block font-bold text-red-100 mb-1 uppercase tracking-wide">
                ⚠️ Do not lose your password and username
              </span>
              We cannot help you recover your account if you do.
            </p>
          </div>

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