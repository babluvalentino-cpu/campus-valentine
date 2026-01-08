// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../utils/apiBase";

export function Dashboard() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [me, setMe] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        // 1. Check session & status
        const meRes = await fetch(`${API_BASE}/api/me`, {
          credentials: "include",
        });
        if (meRes.status === 401) {
          navigate("/login");
          return;
        }
        if (!meRes.ok) {
          throw new Error("Failed to load user.");
        }
        const meJson = await meRes.json();
        setMe(meJson);

        // 2. Fetch matches
        const res = await fetch(`${API_BASE}/api/matches`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("Failed to load matches.");
        }
        const list = await res.json();
        setMatches(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error(e);
        setError(e.message || "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    }

    load();                               
  }, [navigate]);

  async function handleLogout() {
    // Optional: Call backend to clear cookie if endpoint exists
    // await fetch(`${API_BASE}/api/logout`, { method: "POST" });
    navigate("/login");
  }

  function openChat(matchId) {
    navigate(`/chat/${matchId}`);
  }

  // --- Loading State (Full Screen) ---
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <p className="text-sm text-slate-300">Loading your dashboard…</p>
      </main>
    );
  }

  // --- Error State ---
  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="bg-slate-900 p-4 rounded-xl max-w-sm text-center border border-slate-800">
          <p className="text-sm text-red-400 mb-2">{error}</p>
          <button
            className="px-3 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-white"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  const status = me?.status;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* --- Navbar --- */}
      <nav className="border-b border-slate-800 p-4 flex justify-between items-center bg-slate-900 sticky top-0 z-10">
        <span className="font-bold text-xl text-pink-500">Campus Valentine</span>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500 hidden sm:block">
            {me?.username}
          </span>
          <button
            onClick={handleLogout}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Log Out
          </button>
        </div>
      </nav>

      <main className="p-4 md:p-6 max-w-6xl mx-auto">
        {/* --- Header Section --- */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Your Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            {status === "pending_profile"
              ? "Complete your profile to join the matching pool."
              : status === "pending_match"
              ? "You’re in the pool! Matches reveal on event night."
              : status === "matched"
              ? "You have matches! Check them out below."
              : "Welcome back."}
          </p>
        </header>

        {/* --- Main Grid Layout --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Column 1: Confession Map (Placeholder) */}
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 min-h-[300px] flex flex-col items-center justify-center text-center">
            <div className="bg-slate-800 p-3 rounded-full mb-3">
              <span className="text-2xl">📍</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">Confession Map</h2>
            <p className="text-slate-400 text-sm max-w-xs">
              (Coming Soon) <br />
              View anonymous confessions dropped at locations around campus.
            </p>
          </div>

          {/* Column 2: My Matches (Dynamic) */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              💌 My Matches
            </h2>

            {matches.length === 0 ? (
              // Empty State
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 min-h-[300px] flex flex-col items-center justify-center text-center">
                <p className="text-slate-400">
                  {status === "pending_match"
                    ? "Matching is in progress. Check back on Valentine's!"
                    : status === "matched"
                    ? "No active matches found."
                    : "No matches yet. Make sure your profile is ready."}
                </p>
              </div>
            ) : (
              // Match List
              <div className="grid gap-3">
                {matches.map((m) => {
                  const partner = m.partner || {};
                  const name = partner.username || "Anonymous";
                  const lastMsg = m.last_message || "No messages yet.";
                  const unread = m.unread_count || 0;
                  const time = m.last_message_at
                    ? new Date(m.last_message_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";

                  return (
                    <button
                      key={m.id}
                      onClick={() => openChat(m.id)}
                      className="w-full text-left bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl p-4 transition-colors group"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-pink-400 group-hover:text-pink-300">
                          {name}
                        </span>
                        {time && (
                          <span className="text-[10px] text-slate-500">
                            {time}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-slate-400 line-clamp-1 pr-2">
                          {lastMsg}
                        </p>
                        {unread > 0 && (
                          <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-pink-600 text-[10px] font-bold">
                            {unread}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}