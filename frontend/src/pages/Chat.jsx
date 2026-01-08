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
    try {
      const res = await fetch(`${API_BASE}/api/chat/${matchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: newMessage.trim() }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to send message");
      }

      const sentMessage = await res.json();
      setMessages((prev) => [...prev, sentMessage]);
      setNewMessage("");
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
        <button
          onClick={handleEndChat}
          className="text-xs px-3 py-1 rounded bg-red-900/30 border border-red-900 hover:bg-red-900/50 text-red-400"
        >
          End Chat
        </button>
      </nav>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-slate-500 text-sm mt-8">
            No messages yet. Start the conversation!
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
