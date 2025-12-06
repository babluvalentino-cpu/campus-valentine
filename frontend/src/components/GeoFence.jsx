// src/components/GeoFence.jsx
import React, { useState } from "react";

/**
 * NOTE:
 * Campus polygon is enforced on the server side.
 * Here we only get coords & send them. We don't store location.
 */
export function GeoFence({ onCoordsChange }) {
  const [status, setStatus] = useState("idle"); // idle | pending | success | denied | error

  async function handleVerify() {
    if (!navigator.geolocation) {
      setStatus("error");
      onCoordsChange(null);
      return;
    }

    setStatus("pending");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setStatus("success");
        onCoordsChange({ lat: latitude, lon: longitude });
      },
      (err) => {
        console.error("Geolocation error:", err);
        setStatus("denied");
        // Backend will use IP-based fallback.
        onCoordsChange(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  }

  return (
    <div className="mt-4 p-3 rounded border border-slate-700 bg-slate-900">
      <p className="text-xs text-slate-300 mb-2">
        To keep this event campus-only, we briefly check your location. We{" "}
        <span className="font-semibold">do not store</span> your exact
        coordinates – only a “verified” flag.
      </p>
      <button
        type="button"
        onClick={handleVerify}
        disabled={status === "pending" || status === "success"}
        className="w-full py-2 rounded bg-blue-600 hover:bg-blue-700 text-sm"
      >
        {status === "pending"
          ? "Checking..."
          : status === "success"
          ? "Location verified ✅"
          : "Verify campus location"}
      </button>
      {status === "denied" && (
        <p className="mt-2 text-xs text-yellow-400">
          Location denied. We’ll try a rough IP check instead. You can still sign up.
        </p>
      )}
      {status === "error" && (
        <p className="mt-2 text-xs text-red-400">
          Geolocation not supported in this browser.
        </p>
      )}
    </div>
  );
}
