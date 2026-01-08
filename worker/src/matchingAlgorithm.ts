// Deterministic female-first matching algorithm with intent + year + questionnaire scoring.

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  run(): Promise<{ success: boolean; meta?: { changes?: number } }>;
  all<T = any>(): Promise<{ results: T[] }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<any[]>;
}

type Intent = "relationship" | "friendship";

type Gender = "male" | "female" | "other";

type Seeking = "male" | "female" | "other" | "all" | "" | null;

export interface ProfileData {
  // Step 1
  intent?: Intent;
  year?: number;
  residence?: "day_scholar" | "hosteller";
  instrument?: "yes" | "no";
  bio?: string;

  // Step 2
  socialBattery?: "introvert" | "extrovert" | "ambivert";
  connectionStyle?: "physical_chemistry" | "emotional_connection";
  attraction?: "looks" | "maturity";

  // Step 3
  gaming?: "yes" | "no";
  sports?: string[]; // e.g. ["table_tennis", "basketball"]
  vacation?: "mountains" | "beaches";

  // Step 4 (relationship only)
  lookingFor?: "long_term" | "short_term";
  idealDate?: "coffee" | "movie" | "dinner";
  activity?: "clubs_party" | "netflix_chill" | "gym";

  // Step 5
  trait?: "humor" | "intelligence" | "comfort";
  valentinesPlan?: "yes" | "no";
}

export interface UserRow {
  id: string;
  username: string;
  gender: Gender | null;
  seeking: Seeking;
  intent: Intent | null;
  year: number | null;
  profile_data: string | null;
  created_at: string;
}

export interface User extends UserRow {
  profile: ProfileData;
}

function parseProfileData(raw: string | null): ProfileData {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return (parsed ?? {}) as ProfileData;
  } catch {
    return {};
  }
}

function normalizeSeeking(s: Seeking): Seeking {
  return (s || "all") as Seeking;
}

function intentsCompatible(a: User, b: User): boolean {
  const intentA = (a.intent || a.profile.intent) as Intent | undefined;
  const intentB = (b.intent || b.profile.intent) as Intent | undefined;
  if (!intentA || !intentB) return false;
  return intentA === intentB;
}

function gendersCompatible(a: User, b: User): boolean {
  const genderA = a.gender;
  const genderB = b.gender;
  if (!genderA || !genderB) return false;

  const seekingA = normalizeSeeking(a.seeking);
  const seekingB = normalizeSeeking(b.seeking);

  const aLikesB = seekingA === "all" || seekingA === (genderB as Seeking);
  const bLikesA = seekingB === "all" || seekingB === (genderA as Seeking);

  return aLikesB && bLikesA;
}

function yearScore(a: User, b: User): number {
  const yearA = a.year ?? a.profile.year;
  const yearB = b.year ?? b.profile.year;
  if (!yearA || !yearB) return 0;

  const diff = Math.abs(yearA - yearB);
  if (diff === 0) return 1000; // Massive boost
  if (diff === 1) return 500; // Adjacent year
  return 0; // Gap > 1 => no boost
}

function sportsScore(a: User, b: User): number {
  const sportsA = new Set((a.profile.sports || []) as string[]);
  const sportsB = new Set((b.profile.sports || []) as string[]);

  if (sportsA.size === 0 && sportsB.size === 0) return 0;

  let intersection = 0;
  const unionSet = new Set<string>();
  for (const s of sportsA) unionSet.add(s);
  for (const s of sportsB) unionSet.add(s);
  for (const s of sportsA) {
    if (sportsB.has(s)) intersection++;
  }
  const union = unionSet.size || 1;
  const jaccard = intersection / union;
  return Math.round(jaccard * 100); // up to +100
}

function equalFieldScore(
  aVal: string | undefined,
  bVal: string | undefined,
  weight = 50
): number {
  if (!aVal || !bVal) return 0;
  return aVal === bVal ? weight : 0;
}

/**
 * Main pairwise score function.
 * Returns 0 for impossible pairs (intent mismatch or gender/seeking mismatch).
 */
export function calculatePairwiseScore(a: User, b: User): number {
  // === Hard filters ===
  if (!intentsCompatible(a, b)) return 0;
  if (!gendersCompatible(a, b)) return 0;

  const profileA = a.profile;
  const profileB = b.profile;

  let score = 0;

  // === Year weighting ===
  score += yearScore(a, b);

  // === Single-choice questionnaire fields ===
  score += equalFieldScore(profileA.residence, profileB.residence); // +50
  score += equalFieldScore(profileA.instrument, profileB.instrument); // +50
  score += equalFieldScore(profileA.socialBattery, profileB.socialBattery); // +50
  score += equalFieldScore(profileA.connectionStyle, profileB.connectionStyle); // +50
  score += equalFieldScore(profileA.attraction, profileB.attraction); // +50
  score += equalFieldScore(profileA.gaming, profileB.gaming); // +50
  score += equalFieldScore(profileA.vacation, profileB.vacation); // +50
  score += equalFieldScore(profileA.lookingFor, profileB.lookingFor); // +50 (relationship only)
  score += equalFieldScore(profileA.idealDate, profileB.idealDate); // +50
  score += equalFieldScore(profileA.activity, profileB.activity); // +50
  score += equalFieldScore(profileA.trait, profileB.trait); // +50
  score += equalFieldScore(profileA.valentinesPlan, profileB.valentinesPlan); // +50

  // === Sports similarity ===
  score += sportsScore(a, b);

  return score;
}

interface CandidatePair {
  aIndex: number;
  bIndex: number;
  score: number;
  // tie-breakers for determinism
  aCreatedAt: string;
  bCreatedAt: string;
}

/**
 * Main matching job.
 * - Selects eligible users.
 * - Runs female-first greedy matching.
 * - Then runs a generic greedy matching on remaining users.
 * - Writes Matches + updates Users.status to 'matched'.
 */
export async function runMatchingAlgorithm(db: D1Database): Promise<string> {
  // 1. Fetch eligible users
  const result = await db
    .prepare(
      `SELECT id, username, gender, seeking, intent, year, profile_data, created_at
       FROM Users
       WHERE status IN ('pending_match', 'requeuing')
         AND geo_verified = 1`
    )
    .all<UserRow>();

  const rows = result.results || [];
  if (rows.length < 2) {
    return "Not enough eligible users to match.";
  }

  const users: User[] = rows.map((row) => ({
    ...row,
    profile: parseProfileData(row.profile_data),
  }));

  const takenUsers = new Set<string>();
  const statements: D1PreparedStatement[] = [];
  let matchesCreated = 0;

  // Partition by gender for female-first pass
  const females: User[] = [];
  const males: User[] = [];
  const others: User[] = [];

  for (const u of users) {
    if (u.gender === "female") females.push(u);
    else if (u.gender === "male") males.push(u);
    else others.push(u);
  }

  // Deterministic ordering by created_at then id
  const byCreated = (a: User, b: User) => {
    const t = a.created_at.localeCompare(b.created_at);
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  };

  females.sort(byCreated);
  males.sort(byCreated);

  // --- PASS 1: Female-first greedy matching ---
  for (const female of females) {
    if (takenUsers.has(female.id)) continue;

    let bestMale: User | null = null;
    let bestScore = 0;
    let bestTieBreaker: string | null = null; // male.created_at + male.id

    for (const male of males) {
      if (takenUsers.has(male.id)) continue;

      const score = calculatePairwiseScore(female, male);
      if (score <= 0) continue;

      const tieKey = `${male.created_at}|${male.id}`;
      if (
        score > bestScore ||
        (score === bestScore && bestMale && tieKey < bestTieBreaker!)
      ) {
        bestMale = male;
        bestScore = score;
        bestTieBreaker = tieKey;
      }

      // "Greedy" but we still scan all to keep determinism by score
    }

    if (bestMale && bestScore > 0) {
      // Safety: One-Match Auto-Rule – ignore is_whitelisted, at most 1 new match in this run.
      if (takenUsers.has(bestMale.id) || takenUsers.has(female.id)) {
        continue;
      }

      const matchId = crypto.randomUUID();
      statements.push(
        db
          .prepare(
            `INSERT INTO Matches (id, user_a_id, user_b_id)
             VALUES (?, ?, ?)`
          )
          .bind(matchId, female.id, bestMale.id)
      );

      // Update both users to 'matched' (if still pending/requeuing)
      statements.push(
        db
          .prepare(
            `UPDATE Users
             SET status = 'matched'
             WHERE id = ? AND status IN ('pending_match', 'requeuing')`
          )
          .bind(female.id)
      );
      statements.push(
        db
          .prepare(
            `UPDATE Users
             SET status = 'matched'
             WHERE id = ? AND status IN ('pending_match', 'requeuing')`
          )
          .bind(bestMale.id)
      );

      takenUsers.add(female.id);
      takenUsers.add(bestMale.id);
      matchesCreated++;
    }
  }

  // --- PASS 2: Generic greedy matching among remaining users ---
  const remaining: User[] = users.filter((u) => !takenUsers.has(u.id));
  if (remaining.length >= 2) {
    const candidates: CandidatePair[] = [];

    // Build all possible pairs
    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const u1 = remaining[i];
        const u2 = remaining[j];

        const score = calculatePairwiseScore(u1, u2);
        if (score <= 0) continue;

        candidates.push({
          aIndex: i,
          bIndex: j,
          score,
          aCreatedAt: u1.created_at,
          bCreatedAt: u2.created_at,
        });
      }
    }

    // Sort by score desc, then by creation time for determinism
    candidates.sort((x, y) => {
      if (x.score !== y.score) return y.score - x.score;

      const aCmp = x.aCreatedAt.localeCompare(y.aCreatedAt);
      if (aCmp !== 0) return aCmp;

      return x.bCreatedAt.localeCompare(y.bCreatedAt);
    });

    for (const cand of candidates) {
      const u1 = remaining[cand.aIndex];
      const u2 = remaining[cand.bIndex];

      if (takenUsers.has(u1.id) || takenUsers.has(u2.id)) continue;

      const matchId = crypto.randomUUID();
      statements.push(
        db
          .prepare(
            `INSERT INTO Matches (id, user_a_id, user_b_id)
             VALUES (?, ?, ?)`
          )
          .bind(matchId, u1.id, u2.id)
      );

      statements.push(
        db
          .prepare(
            `UPDATE Users
             SET status = 'matched'
             WHERE id = ? AND status IN ('pending_match', 'requeuing')`
          )
          .bind(u1.id)
      );
      statements.push(
        db
          .prepare(
            `UPDATE Users
             SET status = 'matched'
             WHERE id = ? AND status IN ('pending_match', 'requeuing')`
          )
          .bind(u2.id)
      );

      takenUsers.add(u1.id);
      takenUsers.add(u2.id);
      matchesCreated++;
    }
  }

  if (statements.length > 0) {
    await db.batch(statements);
    return `Matching complete. Created ${matchesCreated} matches.`;
  }

  return "Matching complete. No matches created.";
}
