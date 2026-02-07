// src/components/ProfileWizard.jsx
import React, { useState } from "react";

/**
 * ProfileWizard
 *
 * Props:
 *  - onComplete(formData: ProfileWizardData): void
 *
 * `formData` structure (you can send this JSON to backend as profile_data):
 * {
 *   gender: 'male' | 'female',
 *   intent: 'relationship' | 'friendship',
 *   year: 1|2|3|4|5,
 *   residence: 'day_scholar' | 'hosteller',
 *   instrument: 'yes' | 'no',
 *   bio: string,
 *   socialBattery: 'introvert' | 'extrovert' | 'ambivert',
 *   connectionStyle: 'physical_chemistry' | 'emotional_connection',
 *   attraction: 'looks' | 'maturity',
 *   gaming: 'yes' | 'no',
 *   sports: string[],
 *   vacation: 'mountains' | 'beaches',
 *   idealDate?: 'coffee' | 'movie' | 'dinner',
 *   activity?: 'clubs_party' | 'netflix_chill' | 'gym',
 *   trait: 'humor' | 'intelligence' | 'comfort',
 *   valentinesPlan: 'yes' | 'no'
 * }
 */

const SPORTS_OPTIONS = [
  "table_tennis",
  "basketball",
  "football",
  "chess",
  "carrom",
  "badminton",
  "volleyball",
  "lawn_tennis",
  "none",
];

const SPORTS_LABELS = {
  table_tennis: "Table Tennis",
  basketball: "Basketball",
  football: "Football",
  chess: "Chess",
  carrom: "Carrom",
  badminton: "Badminton",
  volleyball: "Volleyball",
  lawn_tennis: "Lawn Tennis",
  none: "None",
};

export function ProfileWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");

  const [data, setData] = useState({
    // Step 0 (Required for matching)
    gender: "", // 'male' | 'female' | 'other'
    seeking: "", // 'male' | 'female' | 'other' | 'all'
    
    // Step 1
    intent: "", // 'relationship' | 'friendship'
    year: "", // "1".."5"
    residence: "", // 'day_scholar' | 'hosteller'
    dietary: "", // 'veg' | 'non_veg' | 'jain' | 'vegan'
    instrument: "", // 'yes' | 'no'
    bio: "",

    // Step 2
    socialBattery: "", // 'introvert' | 'extrovert' | 'ambivert'
    connectionStyle: "", // 'physical_chemistry' | 'emotional_connection'
    attraction: "", // 'looks' | 'maturity'

    // Step 3
    gaming: "", // 'yes' | 'no'
    sports: [], // string[]
    vacation: "", // 'mountains' | 'beaches'

    // Step 4 (relationship only)
    lookingFor: "", // 'long_term' | 'short_term'
    idealDate: "", // 'coffee' | 'movie' | 'dinner'
    activity: "", // 'clubs_party' | 'netflix_chill' | 'gym'

    // Step 5
    trait: "", // 'humor' | 'intelligence' | 'comfort'
    valentinesPlan: "", // 'yes' | 'no'
  });

  const isRelationship = data.intent === "relationship";
  const isFriendship = data.intent === "friendship";

  function update(field, value) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function toggleSport(sportKey) {
    setData((prev) => {
      let next = [...prev.sports];
      if (next.includes(sportKey)) {
        next = next.filter((s) => s !== sportKey);
      } else {
        if (sportKey === "none") {
          // if "None" is selected, clear all others
          next = ["none"];
        } else {
          // remove "none" if present
          next = next.filter((s) => s !== "none");
          if (next.length < 4) {
            next.push(sportKey);
          }
        }
      }
      return { ...prev, sports: next };
    });
  }

  function validateStep(currentStep) {
    // Basic validation per step
    if (currentStep === 0) {
      if (!data.gender) return "Please select your gender.";
      if (!data.year) return "Please select your current year.";
    } else if (currentStep === 1) {
      if (!isRelationship && !isFriendship) {
        return "Please select what you're looking for.";
      }
      if (!data.residence) return "Please select your residence status.";
      if (!data.dietary) return "Please select your dietary preference.";
      if (!data.instrument) return "Please answer if you play an instrument.";
      if (data.bio.length > 200) return "Bio must be at most 200 characters.";
    } else if (currentStep === 2) {
      if (!data.socialBattery) return "Please choose your social battery.";
      if (!data.connectionStyle) return "Please choose what you value more.";
      if (!data.attraction) return "Please choose what initially draws you.";
    } else if (currentStep === 3) {
      if (!data.gaming) return "Please answer if you enjoy gaming.";
      if (!data.vacation) return "Please pick a vacation preference.";
      // sports optional, but we allow empty
    } else if (currentStep === 4 && isRelationship) {
      if (!data.idealDate) return "Please pick an ideal date.";
      if (!data.activity) return "Please pick a preferred activity.";
    } else if (currentStep === 5) {
      if (!data.trait) return "Please choose your most preferred trait.";
      if (!data.valentinesPlan)
        return "Please answer the Valentine's meet in person question.";
    }

    return "";
  }

  function goNext() {
    if(step!=5){
      const message = validateStep(step);
      if (message) {
        setError(message);
        return;
      }
    }
    setError("");

    if (step === 0) {
      setStep(1);
    } else if (step === 3 && isFriendship) {
      setStep(5); // skip Step 4 for friendship
    } else if (step < 5) {
      setStep(step + 1);
    }
  }

  function goBack() {
    setError("");
    if (step === 5 && isFriendship) {
      setStep(3); // skip Step 4 for friendship
    } else if (step === 1) {
      setStep(0);
    } else if (step > 0) {
      setStep(step - 1);
    }
  }

  function handleFinish() {
    const message = validateStep(5);
    if (message) {
      setError(message);
      return;
    }
    setError("");

    const finalData = {
      gender: data.gender,
      intent: data.intent === "relationship" ? "relationship" : "friendship",
      year: parseInt(String(data.year), 10),
      residence: data.residence,
      dietary: data.dietary,
      instrument: data.instrument,
      bio: data.bio.trim(),

      socialBattery: data.socialBattery,
      connectionStyle: data.connectionStyle,
      attraction: data.attraction,

      gaming: data.gaming,
      sports: data.sports,
      vacation: data.vacation,

      idealDate: isRelationship ? data.idealDate : undefined,
      activity: isRelationship ? data.activity : undefined,

      trait: data.trait,
      valentinesPlan: data.valentinesPlan,
    };

    if (typeof onComplete === "function") {
      onComplete(finalData);
    }
  }

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <Step0GenderSeeking data={data} update={update} />
        );
      case 1:
        return (
          <Step1Basics data={data} update={update} />
        );
      case 2:
        return (
          <Step2Vibe data={data} update={update} />
        );
      case 3:
        return (
          <Step3Hobbies data={data} update={update} toggleSport={toggleSport} />
        );
      case 4:
        return isRelationship ? (
          <Step4DatingStyle data={data} update={update} />
        ) : (
          <div className="text-sm text-slate-300">
            {/* Should normally be skipped for friendship */}
            Skipping dating style for friendship intent.
          </div>
        );
      case 5:
        return (
          <Step5Preferences data={data} update={update} />
        );
      default:
        return null;
    }
  }

  const stepLabel =
    step === 0
      ? "Step 0 · Gender and Year"
      : step === 1
      ? "Step 1 · Basics"
      : step === 2
      ? "Step 2 · Vibe"
      : step === 3
      ? "Step 3 · Hobbies"
      : step === 4
      ? "Step 4 · Dating Style"
      : "Step 5 · Preferences";

  const showBack = step > 0;
  const showNext = step < 5
  const showFinish = step === 5;

  return (
    <div className="w-full max-w-xl bg-slate-900 p-6 rounded-xl shadow text-white">
      <div className="mb-4">
        <p className="text-xs text-slate-400 mb-1">{stepLabel}</p>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={
                "h-1 flex-1 rounded-full " +
                (n <= step ? "bg-pink-500" : "bg-slate-700")
              }
            />
          ))}
        </div>
      </div>

      <div className="mb-4">{renderStep()}</div>

      {error && (
        <p className="text-xs text-red-400 mb-3">{error}</p>
      )}

      <div className="flex justify-between items-center mt-2">
        {showBack ? (
          <button
            type="button"
            onClick={goBack}
            className="px-3 py-1 text-xs rounded border border-slate-600 hover:border-pink-400"
          >
            Back
          </button>
        ) : (
          <span />
        )}

        <div className="flex gap-2">
          {showNext && (
            <button
              type="button"
              onClick={goNext}
              className="px-3 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700"
            >
              Next
            </button>
          )}
          {showFinish && (
            <button
              type="button"
              onClick={handleFinish}
              className="px-3 py-1 text-xs rounded bg-pink-500 hover:bg-pink-600"
            >
              Finish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* === Step components === */

function Step0GenderSeeking({ data, update }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="mb-1">Your gender?</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <RadioPill
            label="Male"
            value="male"
            checked={data.gender === "male"}
            onChange={() => update("gender", "male")}
          />
          <RadioPill
            label="Female"
            value="female"
            checked={data.gender === "female"}
            onChange={() => update("gender", "female")}
          />
        </div>
      </div>

      <div>
        <p className="mb-1">Current year?</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {["1", "2", "3", "4", "5"].map((y) => (
            <RadioPill
              key={y}
              label={y === "5" ? "5+" : `${y} year`}
              value={y}
              checked={data.year === y}
              onChange={() => update("year", y)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Step1Basics({ data, update }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="mb-1">What are you looking for?</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <RadioPill
            label="Relationship"
            value="relationship"
            checked={data.intent === "relationship"}
            onChange={() => update("intent", "relationship")}
          />
          <RadioPill
            label="Friendship"
            value="friendship"
            checked={data.intent === "friendship"}
            onChange={() => update("intent", "friendship")}
          />
        </div>
      </div>

      <div>
        <p className="mb-1">Status?</p>
        <div className="flex gap-3 text-xs">
          <RadioPill
            label="Day Scholar"
            value="day_scholar"
            checked={data.residence === "day_scholar"}
            onChange={() => update("residence", "day_scholar")}
          />
          <RadioPill
            label="Hosteller"
            value="hosteller"
            checked={data.residence === "hosteller"}
            onChange={() => update("residence", "hosteller")}
          />
        </div>
      </div>

      <div>
        <p className="mb-1">Dietary preference? (Helps plan dates)</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <RadioPill
            label="Veg"
            value="veg"
            checked={data.dietary === "veg"}
            onChange={() => update("dietary", "veg")}
          />
          <RadioPill
            label="Non-Veg"
            value="non_veg"
            checked={data.dietary === "non_veg"}
            onChange={() => update("dietary", "non_veg")}
          />
          <RadioPill
            label="Jain"
            value="jain"
            checked={data.dietary === "jain"}
            onChange={() => update("dietary", "jain")}
          />
          <RadioPill
            label="Vegan"
            value="vegan"
            checked={data.dietary === "vegan"}
            onChange={() => update("dietary", "vegan")}
          />
        </div>
      </div>

      <div>
        <p className="mb-1">Do you play an instrument?</p>
        <div className="flex gap-3 text-xs">
          <RadioPill
            label="Yes"
            value="yes"
            checked={data.instrument === "yes"}
            onChange={() => update("instrument", "yes")}
          />
          <RadioPill
            label="No"
            value="no"
            checked={data.instrument === "no"}
            onChange={() => update("instrument", "no")}
          />
        </div>
      </div>

      <div>
        <p className="mb-1">Anything else? (Optional)</p>
        <textarea
          className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-xs resize-none"
          rows={3}
          maxLength={200}
          value={data.bio}
          onChange={(e) => update("bio", e.target.value)}
          placeholder="Skip if you want to stay mysterious."
        />
        <p className="text-[10px] text-slate-500 text-right">
          {data.bio.length}/200
        </p>
      </div>
    </div>
  );
}

function Step2Vibe({ data, update }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="mb-1">Social battery?</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <RadioPill
            label="Introvert"
            value="introvert"
            checked={data.socialBattery === "introvert"}
            onChange={() => update("socialBattery", "introvert")}
          />
          <RadioPill
            label="Extrovert"
            value="extrovert"
            checked={data.socialBattery === "extrovert"}
            onChange={() => update("socialBattery", "extrovert")}
          />
          <RadioPill
            label="Ambivert"
            value="ambivert"
            checked={data.socialBattery === "ambivert"}
            onChange={() => update("socialBattery", "ambivert")}
          />
        </div>
      </div>

      <div>
        <p className="mb-1">What do you value more?</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <RadioPill
            label="Physical Chemistry"
            value="physical_chemistry"
            checked={data.connectionStyle === "physical_chemistry"}
            onChange={() => update("connectionStyle", "physical_chemistry")}
          />
          <RadioPill
            label="Emotional Connection"
            value="emotional_connection"
            checked={data.connectionStyle === "emotional_connection"}
            onChange={() => update("connectionStyle", "emotional_connection")}
          />
        </div>
      </div>

      <div>
        <p className="mb-1">What is your initial draw?</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <RadioPill
            label="Looks"
            value="looks"
            checked={data.attraction === "looks"}
            onChange={() => update("attraction", "looks")}
          />
          <RadioPill
            label="Maturity"
            value="maturity"
            checked={data.attraction === "maturity"}
            onChange={() => update("attraction", "maturity")}
          />
        </div>
      </div>
    </div>
  );
}

function Step3Hobbies({ data, update, toggleSport }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="mb-1">Do you enjoy gaming?</p>
        <div className="flex gap-3 text-xs">
          <RadioPill
            label="Yes"
            value="yes"
            checked={data.gaming === "yes"}
            onChange={() => update("gaming", "yes")}
          />
          <RadioPill
            label="No"
            value="no"
            checked={data.gaming === "no"}
            onChange={() => update("gaming", "no")}
          />
        </div>
      </div>

      <div>
        <p className="mb-1">Sports (max 4)</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {SPORTS_OPTIONS.map((key) => {
            const active = data.sports.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleSport(key)}
                className={
                  "px-3 py-1 rounded-full border " +
                  (active
                    ? "bg-pink-600 border-pink-400 text-white"
                    : "bg-slate-950 border-slate-600 text-slate-200 hover:border-pink-400")
                }
              >
                {SPORTS_LABELS[key]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-1">Vacation preference?</p>
        <div className="flex gap-3 text-xs">
          <RadioPill
            label="Mountains"
            value="mountains"
            checked={data.vacation === "mountains"}
            onChange={() => update("vacation", "mountains")}
          />
          <RadioPill
            label="Beaches"
            value="beaches"
            checked={data.vacation === "beaches"}
            onChange={() => update("vacation", "beaches")}
          />
        </div>
      </div>
    </div>
  );
}

function Step4DatingStyle({ data, update }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="mb-1">Ideal date?</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <RadioPill
            label="Coffee"
            value="coffee"
            checked={data.idealDate === "coffee"}
            onChange={() => update("idealDate", "coffee")}
          />
          <RadioPill
            label="Movie"
            value="movie"
            checked={data.idealDate === "movie"}
            onChange={() => update("idealDate", "movie")}
          />
          <RadioPill
            label="Dinner"
            value="dinner"
            checked={data.idealDate === "dinner"}
            onChange={() => update("idealDate", "dinner")}
          />
        </div>
      </div>

      <div>
        <p className="mb-1">Preferred activity?</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <RadioPill
            label="Clubs / Party"
            value="clubs_party"
            checked={data.activity === "clubs_party"}
            onChange={() => update("activity", "clubs_party")}
          />
          <RadioPill
            label="Netflix &amp; Chill"
            value="netflix_chill"
            checked={data.activity === "netflix_chill"}
            onChange={() => update("activity", "netflix_chill")}
          />
          <RadioPill
            label="Gym"
            value="gym"
            checked={data.activity === "gym"}
            onChange={() => update("activity", "gym")}
          />
        </div>
      </div>
    </div>
  );
}

function Step5Preferences({ data, update }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="mb-1">Most preferred trait?</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <RadioPill
            label="Humor"
            value="humor"
            checked={data.trait === "humor"}
            onChange={() => update("trait", "humor")}
          />
          <RadioPill
            label="Intelligence"
            value="intelligence"
            checked={data.trait === "intelligence"}
            onChange={() => update("trait", "intelligence")}
          />
          <RadioPill
            label="Comfort"
            value="comfort"
            checked={data.trait === "comfort"}
            onChange={() => update("trait", "comfort")}
          />
        </div>
      </div>

      <div>
        <p className="mb-1">Would you want to meet in person on Valentine's?</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <RadioPill
            label="Yes"
            value="yes"
            checked={data.valentinesPlan === "yes"}
            onChange={() => update("valentinesPlan", "yes")}
          />
          <RadioPill
            label="No"
            value="no"
            checked={data.valentinesPlan === "no"}
            onChange={() => update("valentinesPlan", "no")}
          />
        </div>
      </div>
    </div>
  );
}

// Removed 'value' from props
function RadioPill({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={
        "px-3 py-1 rounded-full border " +
        (checked
          ? "bg-pink-600 border-pink-400 text-white"
          : "bg-slate-950 border-slate-600 text-slate-200 hover:border-pink-400")
      }
    >
      {label}
    </button>
  );
}
