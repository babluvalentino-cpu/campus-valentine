// src/components/TurnstileWidget.jsx
import React from "react";
import { Turnstile } from "@marsidev/react-turnstile";

// TODO: set in .env: VITE_TURNSTILE_SITE_KEY="your_site_key"
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export function TurnstileWidget({ onTokenChange }) {
  if (!SITE_KEY) {
    return (
      <p className="text-xs text-yellow-400">
        Turnstile site key missing. Set VITE_TURNSTILE_SITE_KEY in .env.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <Turnstile
        siteKey={SITE_KEY}
        onSuccess={onTokenChange}
        onError={() => onTokenChange(null)}
        onExpire={() => onTokenChange(null)}
        options={{ theme: "auto" }}
      />
    </div>
  );
}
