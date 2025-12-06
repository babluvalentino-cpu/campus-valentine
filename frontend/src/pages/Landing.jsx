// src/pages/Landing.jsx
export function Landing() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
      <h1 className="text-3xl font-bold mb-4">Campus Valentine</h1>
      <p className="mb-6 text-center max-w-md">
        Anonymous, campus-only Valentine matching & confession map.
      </p>
      <div className="flex gap-4">
        <a href="/signup" className="px-4 py-2 rounded bg-pink-500 hover:bg-pink-600">
          Sign up
        </a>
        <a href="/login" className="px-4 py-2 rounded border border-pink-500">
          Log in
        </a>
      </div>
    </main>
  );
}
