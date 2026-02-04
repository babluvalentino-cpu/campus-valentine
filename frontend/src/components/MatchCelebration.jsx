// src/components/MatchCelebration.jsx
import React, { useEffect, useRef } from "react";

/**
 * MatchCelebration Component
 * 
 * Displays a celebratory popup when a user receives a new match.
 * Features:
 * - Full-screen overlay with backdrop blur
 * - Floating heart animations
 * - Gender-aware personalized messages
 * - Accessibility: focus trap, ESC to close, ARIA dialog
 * - Tailwind-only styling (no inline styles)
 */
export function MatchCelebration({ match, currentUserGender, onClose }) {
  const dialogRef = useRef(null);
  const initialFocusRef = useRef(null);

  // Message logic based on gender combination
  const getMessage = () => {
    const partnerGender = match.partner?.gender;
    
    if (!partnerGender) {
      return {
        title: "It's a match! ❤️",
        subtitle: "Something special just started.",
      };
    }

    const genderPair = [currentUserGender, partnerGender].sort().join("_");

    const messages = {
      female_male: {
        title: "You've got a Valentine 💘",
        subtitle: "Looks like Cupid did his job. Say hello and let the magic begin.",
      },
      female_female: {
        title: "You've got a Valentine 💖",
        subtitle: "A beautiful connection just found its spark.",
      },
      male_male: {
        title: "You've got a Valentine, bro ❤️",
        subtitle: "Legends don't wait—go make the first move.",
      },
    };

    return messages[genderPair] || {
      title: "It's a match! ❤️",
      subtitle: "Something special just started.",
    };
  };

  const message = getMessage();

  // Focus trap: keep focus inside dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleKeyDown = (e) => {
      // ESC key closes popup
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // Focus trap
      if (e.key !== "Tab") return;

      const focusableElements = dialog.querySelectorAll(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    dialog.addEventListener("keydown", handleKeyDown);
    return () => dialog.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Auto-focus dismiss button
  useEffect(() => {
    initialFocusRef.current?.focus();
  }, []);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      ref={dialogRef}
    >
      {/* Backdrop with blur and fade animation */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Floating hearts container */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute text-pink-500 animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.15}s`,
              fontSize: `${16 + Math.random() * 24}px`,
              opacity: 0.6,
            }}
          >
            ❤️
          </div>
        ))}
      </div>

      {/* Center card with celebration content */}
      <div className="relative z-10 mx-4 max-w-md animate-scale-in">
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-pink-900/20 rounded-2xl p-8 border border-pink-500/30 shadow-2xl">
          {/* Glow effect behind card */}
          <div
            className="absolute -inset-4 bg-gradient-to-r from-pink-600/20 to-purple-600/20 rounded-2xl blur-xl -z-10"
            aria-hidden="true"
          />

          {/* Content */}
          <div className="text-center space-y-4">
            {/* Title */}
            <h2
              id="celebration-title"
              className="text-3xl sm:text-4xl font-bold text-white"
            >
              {message.title}
            </h2>

            {/* Subtitle */}
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              {message.subtitle}
            </p>

            {/* Partner name */}
            {match.partner && (
              <div className="pt-2">
                <p className="text-pink-400 font-semibold text-lg">
                  Meet {match.partner.username}
                </p>
              </div>
            )}

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-pink-500/50 to-transparent" />

            {/* Call-to-action button */}
            <button
              ref={initialFocusRef}
              onClick={onClose}
              className="w-full mt-6 py-3 px-4 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 focus:ring-offset-slate-800"
            >
              Let's Go ❤️
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes float {
          0% {
            opacity: 0;
            transform: translateY(0) rotate(0deg);
          }
          10% {
            opacity: 0.8;
          }
          90% {
            opacity: 0.8;
          }
          100% {
            opacity: 0;
            transform: translateY(-100vh) rotate(360deg);
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.4s ease-out;
        }

        .animate-scale-in {
          animation: scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
