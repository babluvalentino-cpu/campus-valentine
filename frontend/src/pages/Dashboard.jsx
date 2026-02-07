// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MatchCelebration } from "../components/MatchCelebration";
import Footer from "../components/Footer";
import { API_BASE, apiFetch } from "../utils/apiBase";

export function Dashboard() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [me, setMe] = useState(null);
  const [celebrationMatch, setCelebrationMatch] = useState(null);
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  function calculateTimeLeft() {
    const targetDate = new Date("2026-02-14T00:00:00");
    const now = new Date();
    const difference = targetDate - now;

    if (difference <= 0) return null;

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getSeenMatches = () => {
    try {
      const stored = localStorage.getItem("seenMatches");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const saveSeenMatch = (matchId) => {
    try {
      const seen = getSeenMatches();
      if (!seen.includes(matchId)) {
        seen.push(matchId);
        localStorage.setItem("seenMatches", JSON.stringify(seen));
      }
    } catch { /* empty */ }
  };

  useEffect(() => {
    async function load() {
      try {
        const meRes = await apiFetch("/api/me");
        if (meRes.status === 401) {
          navigate("/login");
          return;
        }
        if (!meRes.ok) {
          throw new Error("Failed to load user.");
        }
        const meJson = await meRes.json();
        setMe(meJson);

        if (meJson.status === "pending_profile") {
          navigate("/profile-setup");
          return;
        }

        const res = await apiFetch("/api/matches");
        if (!res.ok) {
          throw new Error("Failed to load matches.");
        }
        const list = await res.json();
        setMatches(Array.isArray(list) ? list : []);

        if (Array.isArray(list) && list.length > 0) {
          const seenMatches = getSeenMatches();
          const newMatch = list.find((m) => !seenMatches.includes(m.id));
          if (newMatch) {
            setCelebrationMatch(newMatch);
          }
        }
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
    try {
      await apiFetch("/api/logout", {
        method: "POST",
      });
    } catch (e) {
      console.error("Logout error:", e);
    }
    navigate("/login");
  }

  function openChat(matchId) {
    navigate(`/chat/${matchId}`);
  }

  function handleCelebrationClose() {
    if (celebrationMatch) {
      saveSeenMatch(celebrationMatch.id);
    }
    setCelebrationMatch(null);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <p className="text-sm text-slate-300">Loading your dashboard…</p>
      </main>
    );
  }

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
      {celebrationMatch && (
        <MatchCelebration
          match={celebrationMatch}
          currentUserGender={me?.gender}
          onClose={handleCelebrationClose}
        />
      )}

      <nav className="border-b border-slate-800 p-4 flex justify-between items-center bg-slate-900 sticky top-0 z-10">
        <span className="font-bold text-xl text-pink-500">ViMatch</span>
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

          {/* Column 2: My Matches (Dynamic) - keep existing content but constrain width from friend's changes */}
          <div className="max-w-2xl">
            <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              💌 My Matches
            </h2>

            {matches.length === 0 ? (
              <div className="bg-slate-900 p-8 rounded-xl border border-pink-500/20 shadow-lg text-center transform hover:scale-[1.02] transition-all min-h-[300px] flex flex-col items-center justify-center">
                {timeLeft ? (
                  <div className="py-2 w-full">
                    <p className="text-gray-300 mb-6 text-lg font-medium tracking-wide">
                      Matching in progress
                    </p>

                    <div className="grid grid-cols-4 gap-2 md:gap-4 max-w-sm mx-auto">
                      <div className="flex flex-col items-center">
                        <span className="text-3xl md:text-5xl font-black text-white">
                          {timeLeft.days}
                        </span>
                        <span className="text-[10px] md:text-xs text-gray-500 uppercase mt-2 font-bold tracking-wider">
                          Days
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-3xl md:text-5xl font-black text-white">
                          {timeLeft.hours}
                        </span>
                        <span className="text-[10px] md:text-xs text-gray-500 uppercase mt-2 font-bold tracking-wider">
                          Hours
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-3xl md:text-5xl font-black text-white">
                          {timeLeft.minutes}
                        </span>
                        <span className="text-[10px] md:text-xs text-gray-500 uppercase mt-2 font-bold tracking-wider">
                          Mins
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-3xl md:text-5xl font-black text-white">
                          {timeLeft.seconds}
                        </span>
                        <span className="text-[10px] md:text-xs text-gray-500 uppercase mt-2 font-bold tracking-wider">
                          Secs
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-6">
                    <p className="text-3xl text-pink-500 font-black animate-bounce">
                      💘 IT'S TIME! 💘
                    </p>
                    <p className="text-gray-400 mt-2">
                      Check your matches below!
                    </p>
                  </div>
                )}
              </div>
            ) : (
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

        </div>

        
      </main>
    </div>
  );
}