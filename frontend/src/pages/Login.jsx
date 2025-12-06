export function Login() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="w-full max-w-md bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
        <h2 className="text-2xl font-semibold mb-4 text-center">Welcome Back</h2>
        <form className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-slate-300">Username</label>
            <input
              type="text"
              className="w-full p-2 rounded bg-slate-950 border border-slate-700 focus:border-pink-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-slate-300">Password</label>
            <input
              type="password"
              className="w-full p-2 rounded bg-slate-950 border border-slate-700 focus:border-pink-500 outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full mt-2 bg-pink-600 hover:bg-pink-700 py-2 rounded font-medium transition-colors"
          >
            Log In
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-400">
          Don't have an account? <a href="/signup" className="text-pink-500 hover:underline">Sign up</a>
        </p>
      </div>
    </main>
  );
}