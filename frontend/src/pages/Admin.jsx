export function Admin() {
  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <header className="mb-8 border-b border-slate-700 pb-4">
        <h1 className="text-3xl font-bold text-red-500">Admin Control Panel</h1>
        <p className="text-slate-400">Moderation and User Management</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stats Card */}
        <div className="bg-slate-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-slate-300">Total Users</h3>
          <p className="text-4xl font-bold mt-2">0</p>
        </div>

        {/* Flagged Content */}
        <div className="lg:col-span-2 bg-slate-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-slate-300 mb-4">Flagged Confessions</h3>
          <div className="p-4 bg-slate-900/50 rounded border border-slate-700 text-center text-slate-500 italic">
            No flagged content to review.
          </div>
        </div>
      </div>
    </div>
  );
}