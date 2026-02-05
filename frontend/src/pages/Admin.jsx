import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, getStoredToken, apiFetch } from "../utils/apiBase";

export function Admin() {
  const navigate = useNavigate();
  const [authStatus, setAuthStatus] = useState("pending"); // "pending" | "admin" | "forbidden" | "unauthorized"
  const [users, setUsers] = useState([]);
  const [couples, setCouples] = useState([]);
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [runMatchingLoading, setRunMatchingLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("users"); // "users" or "couples"

  // Force Match Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserA, setSelectedUserA] = useState(null);
  const [selectedUserBId, setSelectedUserBId] = useState("");

  const isAuthenticated = authStatus === "admin";

  // Session-based auth: require logged-in admin (cookie). No static secret.
  useEffect(() => {
    let cancelled = false;
    async function checkAdmin() {
      try {
        const res = await apiFetch("/api/me");
        if (cancelled) return;
        if (res.status === 401) {
          setAuthStatus("unauthorized");
          return;
        }
        if (!res.ok) {
          setAuthStatus("unauthorized");
          return;
        }
        const me = await res.json();
        if (!me.isAdmin) {
          setAuthStatus("forbidden");
          return;
        }
        setAuthStatus("admin");
        fetchUsers();
        fetchCouples();
        fetchReports();
      } catch (e) {
        if (!cancelled) setAuthStatus("unauthorized");
      }
    }
    checkAdmin();
    return () => { cancelled = true; };
  }, []);

  // Fetch users (session cookie only; no x-admin-secret)
  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/users");
      if (res.status === 401) {
        setAuthStatus("unauthorized");
        return;
      }
      if (res.status === 403) {
        setAuthStatus("forbidden");
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchReports() {
    try {
      const res = await apiFetch("/api/admin/reports");
      if (res.ok) {
        const data = await res.json();
        setReports(Array.isArray(data) ? data : []);
      } else {
        setReports([]);
      }
    } catch (e) {
      setReports([]);
    }
  }

  // Fetch matched couples
  async function fetchCouples() {
    try {
      const res = await apiFetch("/api/admin/couples");
      if (res.ok) {
        const data = await res.json();
        setCouples(Array.isArray(data) ? data : []);
      } else {
        setCouples([]);
      }
    } catch (e) {
      setCouples([]);
    }
  }

  // 2. Toggle Whitelist
  async function toggleWhitelist(id, currentStatus) {
    try {
      const newStatus = !currentStatus;
      const res = await fetch(`${API_BASE}/api/admin/whitelist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ user_id: id, status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to toggle whitelist");
      fetchUsers(); // Refresh list
    } catch (e) {
      alert(e.message);
    }
  }

  // 3. Unmatch User
  async function handleUnmatch(id) {
    if (!confirm("Are you sure you want to break this match? This cannot be undone.")) return;
    try {
      const res = await apiFetch("/api/admin/whitelist", {
        method: "POST",
        body: JSON.stringify({ user_id: id }),
      });
      if (!res.ok) {
        let errorMsg = "Failed to unmatch";
        try {
          const errData = await res.json();
          errorMsg = errData.error || errorMsg;
        } catch {
          // Use default error message
        }
        throw new Error(errorMsg);
      }
      fetchUsers(); // Refresh
      alert("Match broken successfully.");
    } catch (e) {
      alert(`Unmatch Error: ${e.message}`);
    }
  }

  // 4. Force Match Modal Logic
  function openForceMatch(user) {
    setSelectedUserA(user);
    setSelectedUserBId(""); // Reset selection
    setIsModalOpen(true);
  }

  async function handleForceMatch() {
    if (!selectedUserBId) return alert("Please select a partner.");

    try {
      const res = await apiFetch("/api/admin/match", {
        method: "POST",
        body: JSON.stringify({
          user_a_id: selectedUserA.id,
          user_b_id: selectedUserBId,
        }),
      });

      if (!res.ok) {
        let errorMsg = "Failed to force match";
        try {
          const errData = await res.json();
          errorMsg = errData.error || errorMsg;
        } catch {
          // Use default error message
        }
        
        if (res.status === 409) {
          throw new Error(`Match limit reached: ${errorMsg}`);
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      setIsModalOpen(false);
      fetchUsers(); // Refresh
      alert(`Match Created Successfully! (ID: ${data.match_id})`);
    } catch (e) {
      alert(`Force Match Error: ${e.message}`);
    }
  }

  // --- VIEW: Not logged in -> show login CTA ---
  if (authStatus === "unauthorized") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 w-full max-w-sm shadow-xl text-center">
          <h1 className="text-xl font-bold mb-4 text-pink-500">Admin Command Center</h1>
          <p className="text-slate-400 text-sm mb-6">You must be logged in to access the admin dashboard.</p>
          <button
            onClick={() => navigate("/login")}
            className="w-full bg-pink-600 p-2 rounded hover:bg-pink-500 font-semibold transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // --- VIEW: Logged in but not admin ---
  if (authStatus === "forbidden") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 w-full max-w-sm shadow-xl text-center">
          <h1 className="text-xl font-bold mb-4 text-red-400">Access Denied</h1>
          <p className="text-slate-400 text-sm mb-6">This area is restricted to administrators.</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full bg-slate-700 p-2 rounded hover:bg-slate-600 font-semibold transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // --- VIEW: Pending (checking session) ---
  if (authStatus === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <p className="text-sm text-slate-400">Checking access…</p>
      </div>
    );
  }

  // --- VIEW: DASHBOARD (authStatus === "admin") ---
  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-slate-400 text-sm">Manage users, whitelist, and manual matches.</p>
          </div>
          <button onClick={() => { fetchUsers(); fetchCouples(); fetchReports(); }} className="text-sm bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded border border-slate-700 transition-colors">
            ↻ Refresh Data
          </button>
          <button
            onClick={async () => {
              if (!confirm('Run matching algorithm now? This will attempt to match eligible users.')) return;
              try {
                setRunMatchingLoading(true);
                const res = await apiFetch("/api/admin/run-matching", { method: "POST" });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  alert(`Run Matching failed: ${data.error || res.statusText}`);
                } else {
                  alert('Run Matching started successfully. ' + (data.result ? String(data.result) : ''));
                  fetchUsers();
                  fetchCouples();
                }
              } catch (e) {
                alert('Run Matching error: ' + e.message);
              } finally {
                setRunMatchingLoading(false);
              }
            }}
            className="text-sm bg-pink-600 hover:bg-pink-500 px-4 py-2 rounded ml-3 text-white border border-pink-500 transition-colors"
            disabled={runMatchingLoading}
          >
            {runMatchingLoading ? 'Running…' : 'Run Matcher'}
          </button>
        </header>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-6 border-b border-slate-800">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-3 font-semibold text-sm transition-colors ${
              activeTab === "users"
                ? "text-pink-500 border-b-2 border-pink-500"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            All Users
          </button>
          <button
            onClick={() => setActiveTab("couples")}
            className={`px-4 py-3 font-semibold text-sm transition-colors ${
              activeTab === "couples"
                ? "text-pink-500 border-b-2 border-pink-500"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            Matched Couples ({couples.length})
          </button>
        </div>

        {/* Reported users (safety) */}
        {activeTab === "users" && reports.length > 0 && (
          <div className="bg-amber-900/20 border border-amber-800 rounded-xl p-4 mb-6">
            <h2 className="text-lg font-semibold text-amber-400 mb-3">⚠️ Reported Users</h2>
            <p className="text-xs text-slate-400 mb-3">Users reported by others in chat. Review and consider banning if needed.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-400">
                <thead className="text-xs text-slate-300 uppercase border-b border-slate-700">
                  <tr>
                    <th className="py-2 pr-4">Reported</th>
                    <th className="py-2 pr-4">By</th>
                    <th className="py-2 pr-4">Reason</th>
                    <th className="py-2 pr-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id} className="border-b border-slate-800">
                      <td className="py-2 font-medium text-white">{r.reported_username}</td>
                      <td className="py-2">{r.reporter_username}</td>
                      <td className="py-2">{r.reason || "—"}</td>
                      <td className="py-2 text-slate-500">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== ALL USERS TAB ===== */}
        {activeTab === "users" && (
          <>
            {/* Stats & Filter Bar */}
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="flex gap-4 text-sm font-medium">
                 <div className="px-3 py-1 bg-slate-800 rounded">Total: <span className="text-white">{users.length}</span></div>
                 <div className="px-3 py-1 bg-green-900/30 text-green-400 rounded border border-green-900">Matched: {users.filter(u => u.status === 'matched').length}</div>
                 <div className="px-3 py-1 bg-blue-900/30 text-blue-400 rounded border border-blue-900">Pending: {users.filter(u => u.status === 'pending_match').length}</div>
              </div>

              <input
                type="text"
                placeholder="Search by username..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="p-2 rounded bg-slate-950 border border-slate-700 w-full md:w-64 focus:border-pink-500 outline-none"
              />
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl shadow-lg">
              <table className="w-full text-sm text-left text-slate-400">
                <thead className="text-xs text-slate-200 uppercase bg-slate-900 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">User Details</th>
                    <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Whitelist</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-500 italic bg-slate-900">
                    No users found matching "{filter}"
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="bg-slate-950 border-b border-slate-800 hover:bg-slate-900/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white text-base">{u.username}</div>
                      <div className="text-xs text-slate-500">
                        {u.gender || '—'} • {u.year === 5 ? "5+" : u.year} yr
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                        ${u.status === 'matched' ? 'bg-green-900 text-green-200' :
                          u.status === 'pending_match' ? 'bg-blue-900 text-blue-200' :
                          u.status === 'requeuing' ? 'bg-yellow-900 text-yellow-200' : 'bg-slate-800 text-slate-300'}
                      `}>
                        {u.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {u.is_whitelisted ? (
                         <span className="text-yellow-400 font-bold" title="Whitelisted">★ Yes</span>
                      ) : (
                         <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {/* 1. Toggle Whitelist */}
                      <button
                        onClick={() => toggleWhitelist(u.id, u.is_whitelisted)}
                        className="text-xs px-2 py-1 bg-slate-800 border border-slate-700 hover:border-yellow-500 hover:text-yellow-400 rounded transition-colors"
                      >
                        {u.is_whitelisted ? "Remove WL" : "Add WL"}
                      </button>

                      {/* 2. Unmatch (Only if matched) */}
                      {u.status === 'matched' && (
                        <button
                          onClick={() => handleUnmatch(u.id)}
                          className="text-xs px-2 py-1 bg-red-900/20 border border-red-900 hover:bg-red-900/40 text-red-400 rounded transition-colors"
                        >
                          Unmatch
                        </button>
                      )}

                      {/* 3. Force Match */}
                      <button
                        onClick={() => openForceMatch(u)}
                        className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 rounded transition-colors"
                      >
                        Force Match
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
            </div>
          </>
        )}

        {/* ===== MATCHED COUPLES TAB ===== */}
        {activeTab === "couples" && (
          <>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mb-6">
              <p className="text-sm text-slate-400">Showing {couples.length} active matched couple pairs.</p>
            </div>

            {couples.length === 0 ? (
              <div className="text-center py-12 bg-slate-900 rounded-xl border border-slate-800">
                <p className="text-slate-400 text-sm italic">No matched couples yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {couples.map((couple) => (
                  <div key={couple.match_id} className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors">
                    {/* Match Header */}
                    <div className="mb-4 pb-3 border-b border-slate-800">
                      <p className="text-xs text-slate-500 mb-1">Match ID: {couple.match_id.slice(0, 8)}...</p>
                      <p className="text-xs text-slate-600">Since {new Date(couple.match_created_at).toLocaleDateString()}</p>
                    </div>

                    {/* User A */}
                    <div className="mb-4 p-3 bg-slate-950 rounded border border-slate-800">
                      <p className="font-semibold text-white text-base">{couple.user_a_username}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-block px-2 py-1 bg-blue-900/30 text-blue-300 text-xs rounded border border-blue-900">
                          {couple.user_a_gender || 'Not Set'}
                        </span>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex-1 h-px bg-slate-800"></div>
                      <span className="text-pink-400 font-semibold text-xs">💕</span>
                      <div className="flex-1 h-px bg-slate-800"></div>
                    </div>

                    {/* User B */}
                    <div className="p-3 bg-slate-950 rounded border border-slate-800">
                      <p className="font-semibold text-white text-base">{couple.user_b_username}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-block px-2 py-1 bg-purple-900/30 text-purple-300 text-xs rounded border border-purple-900">
                          {couple.user_b_gender || 'Not Set'}
                        </span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => handleUnmatch(couple.user_a_id)}
                      className="w-full mt-4 px-3 py-2 text-xs bg-red-900/20 border border-red-900 hover:bg-red-900/40 text-red-400 rounded transition-colors font-medium"
                    >
                      Break Match
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* --- MODAL: FORCE MATCH --- */}
      {isModalOpen && selectedUserA && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700 w-full max-w-lg shadow-2xl relative">
            <h2 className="text-xl font-bold mb-1 text-white">Create Match</h2>
            <p className="text-sm text-slate-400 mb-6">
              Match <strong>{selectedUserA.username}</strong> ({selectedUserA.gender}) with:
            </p>

            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Select Partner</label>
            <select
              className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg mb-6 text-white focus:border-pink-500 outline-none"
              onChange={(e) => setSelectedUserBId(e.target.value)}
              value={selectedUserBId}
            >
              <option value="">-- Choose a user --</option>
              {users
                .filter(u => u.id !== selectedUserA.id) // Cannot match self
                .sort((a,b) => a.username.localeCompare(b.username))
                .map(u => (
                  <option key={u.id} value={u.id}>
                    {u.username} • {u.gender} • {u.status} {u.is_whitelisted ? "(WL)" : ""}
                  </option>
                ))
              }
            </select>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleForceMatch}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors shadow-lg shadow-blue-900/20"
              >
                Confirm Match
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
