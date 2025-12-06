// src/pages/Signup.jsx
import React, { useEffect, useState } from "react";
import { TurnstileWidget } from "../components/TurnstileWidget.jsx";
import { GeoFence } from "../components/GeoFence.jsx";
import { getFingerprintHash } from "../utils/fingerprint.js";
import { API_BASE } from "../utils/apiBase.js";
import { useNavigate } from "react-router-dom";

export function Signup() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fingerprint, setFingerprint] = useState(null);
  const [coords, setCoords] = useState(null);
  const [turnstileToken, setTurnstileToken] = useState(null);
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
    if (!turnstileToken) {
      setError("Please complete the human check.");
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
          turnstileToken,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Signup failed");
      }

      // OR parse JSON if backend returns it
      // const data = await res.json();
      navigate("/dashboard");
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
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <GeoFence onCoordsChange={setCoords} />
          <TurnstileWidget onTokenChange={setTurnstileToken} />

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
