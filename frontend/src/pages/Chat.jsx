// src/pages/Chat.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../utils/apiBase";

export function Chat() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [partner, setPartner] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("inappropriate");
  const [reporting, setReporting] = useState(false);
  const [icebreaker, setIcebreaker] = useState("");
  const [messageWarning, setMessageWarning] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadCurrentUser();
    loadMessages();
    // Poll for new messages every 3 seconds
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [matchId]);

  async function loadCurrentUser() {
    try {
      const res = await fetch(`${API_BASE}/api/me`, {
        credentials: "include",
      });
      if (res.ok) {
        const me = await res.json();
        setCurrentUserId(me.id);
      }
    } catch (e) {
      console.error("Failed to load current user:", e);
    }
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function loadMessages() {
    try {
      const res = await fetch(`${API_BASE}/api/chat/${matchId}`, {
        credentials: "include",
      });

      if (res.status === 401) {
        navigate("/login");
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to load messages");
      }

      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);

      // Get partner info from matches endpoint
      if (!partner) {
        try {
          const matchesRes = await fetch(`${API_BASE}/api/matches`, {
            credentials: "include",
          });
          if (matchesRes.ok) {
            const matches = await matchesRes.json();
            const currentMatch = matches.find((m) => m.id === matchId);
            if (currentMatch && currentMatch.partner) {
              setPartner(currentMatch.partner);
              // Set icebreaker if available and no messages yet
              if (currentMatch.icebreaker && data.length === 0) {
                setIcebreaker(currentMatch.icebreaker);
              }
            }
          }
        } catch (e) {
          console.error("Failed to load partner info:", e);
        }
      }

      setLoading(false);
      setError("");
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load messages.");
      setLoading(false);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    setMessageWarning("");
    
    // Check for suspicious content (basic client-side check)
    const hasUrl = /https?:\/\/[^\s]+/gi.test(newMessage);
    if (hasUrl) {
      setMessageWarning("⚠️ Links are not allowed in messages");
    }

    try {
      const res = await fetch(`${API_BASE}/api/chat/${matchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: newMessage.trim() }),
      });

      if (!res.ok) {
        let errorMessage = "Failed to send message";
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          const text = await res.text();
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const sentMessage = await res.json();
      setMessages((prev) => [...prev, sentMessage]);
      setNewMessage("");
      setMessageWarning("");
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  async function handleEndChat() {
    if (!confirm("Are you sure you want to end this chat? You'll be requeued for matching.")) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/chat/${matchId}/end`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to end chat");
      }

      navigate("/dashboard");
    } catch (e) {
      alert(e.message || "Failed to end chat.");
    }
  }

  async function handleReportAndUnmatch() {
    setReporting(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat/${matchId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: reportReason }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to report");
      }

      setShowReportModal(false);
      navigate("/dashboard");
    } catch (e) {
      alert(e.message || "Failed to report.");
    } finally {
      setReporting(false);
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <p className="text-sm text-slate-300">Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <nav className="border-b border-slate-800 p-4 bg-slate-900 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm text-slate-400 hover:text-white"
          >
            ← Back
          </button>
          <div>
            <h1 className="font-semibold text-pink-400">
              {partner?.username || "Anonymous"}
            </h1>
            <p className="text-xs text-slate-500">Match</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReportModal(true)}
            className="text-xs px-3 py-1 rounded bg-amber-900/30 border border-amber-800 hover:bg-amber-900/50 text-amber-400"
            title="Report & Unmatch"
          >
            Report
          </button>
          <button
            onClick={handleEndChat}
            className="text-xs px-3 py-1 rounded bg-red-900/30 border border-red-900 hover:bg-red-900/50 text-red-400"
          >
            End Chat
          </button>
        </div>
      </nav>

      {/* Report & Unmatch modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">Report & Unmatch</h2>
            <p className="text-sm text-slate-400 mb-4">
              This will immediately end the chat and flag this user for admin review. You will be requeued for matching.
            </p>
            <label className="block text-xs font-medium text-slate-500 mb-2">Reason</label>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-white text-sm mb-4"
            >
              <option value="inappropriate">Inappropriate messages</option>
              <option value="harassment">Harassment</option>
              <option value="spam">Spam</option>
              <option value="other">Other</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setShowReportModal(false)}
                disabled={reporting}
                className="flex-1 px-3 py-2 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleReportAndUnmatch}
                disabled={reporting}
                className="flex-1 px-3 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {reporting ? "Reporting…" : "Report & Unmatch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Smart Icebreaker Suggestion */}
        {messages.length === 0 && icebreaker && (
          <div className="bg-gradient-to-r from-pink-900/40 to-purple-900/40 border border-pink-700/50 rounded-lg p-4 text-center">
            <p className="text-xs text-pink-300 font-medium mb-2">💡 Conversation Starter</p>
            <p className="text-sm text-pink-200 italic">{icebreaker}</p>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="text-center text-slate-500 text-sm mt-8">
            {icebreaker ? "Send the suggested message or start with your own!" : "No messages yet. Start the conversation!"}
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = currentUserId && msg.sender_id === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    isOwn
                      ? "bg-pink-600 text-white"
                      : "bg-slate-800 text-slate-200"
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-900/30 border-t border-red-900 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-slate-800 p-4 bg-slate-900">
        {messageWarning && (
          <div className="mb-2 text-xs text-amber-300 bg-amber-900/30 px-3 py-1 rounded border border-amber-700">
            {messageWarning}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-2 rounded bg-slate-950 border border-slate-700 focus:border-pink-500 outline-none text-sm"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="px-4 py-2 rounded bg-pink-500 hover:bg-pink-600 disabled:bg-pink-800 disabled:opacity-50 text-sm font-medium"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
