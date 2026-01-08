import React, { useEffect, useState } from "react";
import { API_BASE } from "../utils/apiBase";

export function Admin() {
  const [secret, setSecret] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Force Match Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserA, setSelectedUserA] = useState(null);
  const [selectedUserBId, setSelectedUserBId] = useState("");

  // 1. Fetch Users
  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        headers: { "x-admin-secret": secret },
      });
      if (res.status === 403) throw new Error("Invalid Admin Secret");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
      setIsAuthenticated(true);
      setError("");
    } catch (e) {
      setError(e.message);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }

  function handleLogin(e) {
    e.preventDefault();
    fetchUsers();
  }

  // 2. Toggle Whitelist
  async function toggleWhitelist(id, currentStatus) {
    try {
      // Logic: Invert current status (1 -> 0, 0 -> 1)
      const newStatus = !currentStatus;
      
      const res = await fetch(`${API_BASE}/api/admin/whitelist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
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
      const res = await fetch(`${API_BASE}/api/admin/unmatch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ user_id: id }),
      });
      if (!res.ok) throw new Error("Failed to unmatch");
      fetchUsers(); // Refresh
      alert("Match broken successfully.");
    } catch (e) {
      alert(e.message);
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
      const res = await fetch(`${API_BASE}/api/admin/match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({
          user_a_id: selectedUserA.id,
          user_b_id: selectedUserBId,
        }),
      });

      if (res.status === 409) {
        return alert("Error: Target user match limit reached. (Are they whitelisted?)");
      }
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to force match");
      }
      
      setIsModalOpen(false);
      fetchUsers(); // Refresh
      alert("Match Created Successfully!");
    } catch (e) {
      alert(e.message);
    }
  }

  // --- VIEW: LOGIN SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <form onSubmit={handleLogin} className="bg-slate-900 p-8 rounded-xl border border-slate-800 w-full max-w-sm shadow-xl">
          <h1 className="text-xl font-bold mb-4 text-pink-500">Admin Command Center</h1>
          <p className="text-xs text-slate-400 mb-4">Enter the server secret key to verify identity.</p>
          
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="e.g. mySuperSecretKey123"
            className="w-full p-2 rounded bg-slate-950 border border-slate-700 mb-4 focus:border-pink-500 outline-none"
          />
          
          {error && <div className="p-2 mb-4 bg-red-900/30 border border-red-800 rounded text-red-400 text-xs">{error}</div>}
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-pink-600 p-2 rounded hover:bg-pink-500 font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Access Dashboard"}
          </button>
        </form>
      </div>
    );
  }

  // --- VIEW: DASHBOARD ---
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
          <button onClick={fetchUsers} className="text-sm bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded border border-slate-700 transition-colors">
            ↻ Refresh Data
          </button>
        </header>

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
                        {u.gender} • {u.year === 5 ? "5+" : u.year} yr
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