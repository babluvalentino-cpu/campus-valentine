// src/pages/Signup.jsx
import { useState } from "react";
import { getFingerprintHash } from "../utils/fingerprint";

export function Signup() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const fingerprintHash = await getFingerprintHash();

      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          fingerprintHash,
        }),
      });

      const result = await response.json();
      console.log("Signup result:", result);

      // TODO: route to dashboard or show errors
    } catch (error) {
      console.error("Signup failed", error);
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="w-full max-w-md bg-slate-800 p-6 rounded-xl shadow">
        <h2 className="text-2xl font-semibold mb-4">Create account</h2>

        <form className="space-y-4" onSubmit={handleSignup}>
          <div>
            <label className="block text-sm mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2 rounded bg-slate-900 border border-slate-700"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 rounded bg-slate-900 border border-slate-700"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full mt-2 bg-pink-500 hover:bg-pink-600 py-2 rounded disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Creating..." : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
