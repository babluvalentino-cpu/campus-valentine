// src/pages/Signup.jsx
export function Signup() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="w-full max-w-md bg-slate-800 p-6 rounded-xl shadow">
        <h2 className="text-2xl font-semibold mb-4">Create account</h2>
        {/* Later: Turnstile, fingerprint, geofence */}
        <form className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Username</label>
            <input
              type="text"
              className="w-full p-2 rounded bg-slate-900 border border-slate-700"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              className="w-full p-2 rounded bg-slate-900 border border-slate-700"
            />
          </div>
          <button
            type="submit"
            className="w-full mt-2 bg-pink-500 hover:bg-pink-600 py-2 rounded"
          >
            Continue
          </button>
        </form>
      </div>
    </main>
  );
}
