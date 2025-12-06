export function Dashboard() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Navbar Placeholder */}
      <nav className="border-b border-slate-800 p-4 flex justify-between items-center bg-slate-900">
        <span className="font-bold text-xl text-pink-500">Campus Valentine</span>
        <button className="text-sm text-slate-400 hover:text-white">Log Out</button>
      </nav>

      <main className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Your Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Confession Map Placeholder */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800 min-h-[300px] flex flex-col items-center justify-center">
            <h2 className="text-xl font-semibold mb-2">📍 Confession Map</h2>
            <p className="text-slate-400 text-center">
              (Map integration coming soon)<br />
              View anonymous confessions around campus.
            </p>
          </div>

          {/* Matches Placeholder */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800 min-h-[300px] flex flex-col items-center justify-center">
            <h2 className="text-xl font-semibold mb-2">💌 My Matches</h2>
            <p className="text-slate-400 text-center">
              You haven't matched with anyone yet.<br />
              Complete the quiz to get started.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}