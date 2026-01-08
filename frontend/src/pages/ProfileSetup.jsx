// src/pages/ProfileSetup.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { ProfileWizard } from "../components/ProfileWizard";
import { API_BASE } from "../utils/apiBase";

export function ProfileSetup() {
  const navigate = useNavigate();

  async function handleComplete(wizardData) {
    try {
      // Extract required fields - backend will use profileData if direct fields missing
      const response = await fetch(`${API_BASE}/api/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          // Required fields (extract from wizardData if present)
          gender: wizardData.gender || "",
          seeking: wizardData.seeking || "",
          interests: wizardData.interests || [],
          
          // Phase-3 fields
          intent: wizardData.intent,
          year: wizardData.year,
          residence: wizardData.residence,
          bio: wizardData.bio,
          
          // Full wizard data for profile_data JSON
          profileData: wizardData,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Profile update failed");
      }

      navigate("/dashboard");
    } catch (err) {
      console.error("Profile setup error:", err);
      alert(err.message || "Failed to save profile. Please try again.");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950">
      <ProfileWizard onComplete={handleComplete} />
    </main>
  );
}
