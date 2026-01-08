import fs from "fs";
import crypto from "crypto";
import { execSync } from "child_process";

const TOTAL_USERS = 100;
const OUT_FILE = "./scripts/bulk_users.sql";

const genders = ["male", "female"];
const intents = ["relationship", "friendship"];
const years = [1, 2, 3, 4];

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function profileData(intent, year) {
  return JSON.stringify({
    intent,
    year,
    residence: Math.random() > 0.5 ? "hosteller" : "day_scholar",
    socialBattery: rand(["introvert", "extrovert", "ambivert"]),
    gaming: rand(["yes", "no"]),
    vacation: rand(["mountains", "beaches"]),
    sports: Math.random() > 0.5 ? ["football"] : ["basketball"],
    lookingFor:
      intent === "relationship"
        ? rand(["long_term", "short_term"])
        : undefined,
    valentinesPlan: rand(["yes", "no"]),
  });
}

let sql = "";

for (let i = 1; i <= TOTAL_USERS; i++) {
  const id = crypto.randomUUID();
  const gender = rand(genders);
  const seeking = gender === "male" ? "female" : "male";
  const intent = rand(intents);
  const year = rand(years);

  sql += `
INSERT INTO Users (
  id, username, password_hash, gender, seeking,
  intent, year, profile_data, status, geo_verified, fingerprint_hash
) VALUES (
  '${id}',
  'bulk_user_${i}',
  'hash_${i}',
  '${gender}',
  '${seeking}',
  '${intent}',
  ${year},
  '${profileData(intent, year)}',
  'pending_match',
  1,
  'fp_bulk_${i}'
);
`;
}

// 1️⃣ Write SQL file (NO BEGIN / COMMIT)
fs.writeFileSync(OUT_FILE, sql, "utf8");

// 2️⃣ Execute via wrangler
execSync(
  `npx wrangler d1 execute campus-valentine-db --remote --file=${OUT_FILE}`,
  { stdio: "inherit" }
);

console.log(`✅ Successfully inserted ${TOTAL_USERS} users`);
