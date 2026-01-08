// src/pages/ProfileSetup.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { ProfileWizard } from "../components/ProfileWizard";
import { API_BASE } from "../utils/apiBase";

export function ProfileSetup() {
  const navigate = useNavigate();

  async function handleComplete(wizardData) {
    // Example: send to backend as profile_data + top-level fields
    await fetch(`${API_BASE}/api/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        intent: wizardData.intent,
        year: wizardData.year,
        bio: wizardData.bio,
        profileData: wizardData, // store as JSON string in profile_data
      }),
    });

    navigate("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950">
      <ProfileWizard onComplete={handleComplete} />
    </main>
  );
}
