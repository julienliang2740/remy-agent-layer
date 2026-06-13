/**
 * Real stats derived from persisted session history — replaces every
 * fabricated number that used to live in the UI ($32 saved, 5-day streak,
 * static skill tree). Pure functions over `SessionRecord[]`, unit-tested.
 */
export type SessionRecord = {
  /** Unix ms when the session finished. */
  at: number;
  recipeId: string;
  /** The recipe's skill tag, e.g. "Sauté". */
  skill: string;
  done: number;
  total: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function dayIndex(t: number): number {
  return Math.floor(t / DAY_MS);
}

/**
 * Consecutive-day cooking streak ending today or yesterday (a streak isn't
 * broken until a full day passes with no session).
 */
export function computeStreak(history: SessionRecord[], now: number): number {
  const days = new Set(history.map((s) => dayIndex(s.at)));
  const today = dayIndex(now);
  let start = days.has(today) ? today : days.has(today - 1) ? today - 1 : null;
  if (start === null) return 0;
  let streak = 0;
  while (days.has(start - streak)) streak++;
  return streak;
}

export type SkillProgress = { name: string; level: number; sessions: number };

/** Sessions needed for a skill to read 100%. */
export const SKILL_MASTERY_SESSIONS = 3;

/**
 * Skill tree derived from completed sessions: each completed cook of a skill
 * advances it by 1/SKILL_MASTERY_SESSIONS, capped at 100%.
 */
export function deriveSkillTree(history: SessionRecord[]): SkillProgress[] {
  const counts = new Map<string, number>();
  for (const s of history) {
    if (s.done >= s.total) counts.set(s.skill, (counts.get(s.skill) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, sessions]) => ({
      name,
      sessions,
      level: Math.min(100, Math.round((sessions / SKILL_MASTERY_SESSIONS) * 100)),
    }))
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
}

/** Distinct skills ever practiced (completed sessions). */
export function distinctSkills(history: SessionRecord[]): number {
  return new Set(history.filter((s) => s.done >= s.total).map((s) => s.skill)).size;
}

/** Completed-session count. */
export function completedSessions(history: SessionRecord[]): number {
  return history.filter((s) => s.done >= s.total).length;
}
