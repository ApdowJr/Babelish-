/**
 * Learner profile — pure model, so the rules can be tested without a device.
 *
 * The profile is what the tutor knows about the learner: what to call them, a
 * one-line bio, their job, what they care about and why they are studying.
 * Every field is optional; an empty profile is valid and simply produces a
 * generic tutor. Nothing here is uploaded — it is stored per device and sent
 * to the tutor server only as part of a prompt.
 */

export type LearnerProfile = {
  /** Optional display-name override (falls back to the account name). */
  displayName: string;
  /** One or two lines in the learner's own words ("Nurse in Hargeisa…"). */
  bio: string;
  /** Job or role, e.g. "a nurse", "a university student". */
  job: string;
  /** Emoji used as the avatar. Empty = initials fallback. */
  avatar: string;
  /** Palette key for the avatar background. */
  avatarColor: AvatarColor;
  /** Interest chips, e.g. ["Cooking", "Football"]. */
  interests: string[];
  /** Goal chips, e.g. ["Travel", "Work & career"]. */
  goals: string[];
};

export const AVATAR_COLORS = ['forest', 'mint', 'tangerine', 'sun', 'sky', 'lilac'] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

/** A small, deliberately mixed set: faces, animals, objects, travel. */
export const AVATAR_EMOJIS = [
  '🙂',
  '😎',
  '🧑‍🎓',
  '👩‍💻',
  '🧑‍🍳',
  '🎧',
  '🌍',
  '🦉',
  '🐫',
  '🐬',
  '🌱',
  '⚡',
] as const;

export const INTEREST_OPTIONS = [
  'Cooking',
  'Football',
  'Music',
  'Travel',
  'Movies',
  'Technology',
  'Fashion',
  'Gaming',
  'Nature',
  'Photography',
] as const;

export const GOAL_OPTIONS = [
  'Travel',
  'Work & career',
  'Family & friends',
  'Exams',
  'Moving abroad',
] as const;

/** Field limits, enforced by `normalizeLearnerProfile` on every write. */
export const LIMITS = {
  displayName: 40,
  bio: 160,
  job: 60,
  /** A learner may pick at most this many chips per list. */
  chips: 6,
} as const;

export const DEFAULT_PROFILE: LearnerProfile = {
  displayName: '',
  bio: '',
  job: '',
  avatar: '',
  avatarColor: 'forest',
  interests: [],
  goals: [],
};

export function isAvatarColor(value: unknown): value is AvatarColor {
  return typeof value === 'string' && (AVATAR_COLORS as readonly string[]).includes(value);
}

/** Keeps a stored string, trimmed and cut to `max`, or the fallback. */
function text(value: unknown, max: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, max);
}

function chips(value: unknown, allowed?: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const chip = raw.trim();
    if (!chip || seen.has(chip)) continue;
    if (allowed && !allowed.includes(chip)) continue;
    seen.add(chip);
    out.push(chip);
    if (out.length >= LIMITS.chips) break;
  }
  return out;
}

/**
 * Validates a stored (or hand-edited) profile.
 *
 * Never throws and never returns a partial object: every field is present, so
 * a screen can render it directly. An unknown avatar emoji is dropped rather
 * than rendered as a missing glyph, and chips are filtered through the same
 * lists the UI offers so a stale option cannot resurrect.
 */
export function normalizeLearnerProfile(raw: unknown): LearnerProfile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_PROFILE };
  const source = raw as Record<string, unknown>;
  const avatar = typeof source.avatar === 'string' ? source.avatar.trim() : '';
  return {
    displayName: text(source.displayName, LIMITS.displayName),
    bio: text(source.bio, LIMITS.bio),
    job: text(source.job, LIMITS.job),
    // Only the offered emoji are accepted: an arbitrary string in this field
    // would be rendered as text inside the avatar circle.
    avatar: (AVATAR_EMOJIS as readonly string[]).includes(avatar) ? avatar : '',
    avatarColor: isAvatarColor(source.avatarColor) ? source.avatarColor : DEFAULT_PROFILE.avatarColor,
    interests: chips(source.interests, INTEREST_OPTIONS),
    goals: chips(source.goals, GOAL_OPTIONS),
  };
}

/**
 * Up to two initials for the avatar fallback.
 * "Amina Yusuf" → "AY", "amina" → "A", "" → "?".
 */
export function avatarInitials(name: string | undefined | null): string {
  const parts = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  const letters = parts.slice(0, 2).map((part) => Array.from(part)[0] ?? '');
  return letters.join('').toUpperCase() || '?';
}

/** Toggles one chip in a list (add when absent, remove when present). */
export function toggleChip(list: string[], chip: string): string[] {
  return list.includes(chip) ? list.filter((item) => item !== chip) : [...list, chip];
}

/**
 * The one-line version of the profile, for a settings row or a share card.
 * Returns null when the learner has not filled anything in — callers show a
 * call to action instead of an empty sentence.
 */
export function profileSummary(profile: LearnerProfile): string | null {
  const bits: string[] = [];
  if (profile.job) bits.push(profile.job);
  if (profile.goals.length > 0) bits.push(`learning for ${profile.goals.join(', ').toLowerCase()}`);
  if (bits.length === 0 && profile.interests.length > 0) {
    bits.push(`into ${profile.interests.slice(0, 3).join(', ').toLowerCase()}`);
  }
  return bits.length === 0 ? null : bits.join(' · ');
}

/**
 * How complete the profile is, 0–1, used for the "finish your profile" nudge.
 * Weighted by what actually changes the tutor's answers.
 */
export function profileCompleteness(profile: LearnerProfile): number {
  const checks = [
    Boolean(profile.displayName),
    Boolean(profile.avatar),
    Boolean(profile.job),
    profile.interests.length > 0,
    profile.goals.length > 0,
  ];
  return checks.filter(Boolean).length / checks.length;
}

/**
 * The lines the tutor prompt is built from. Pure so a test can prove that an
 * empty profile produces no prompt noise ("You are talking to , who works
 * as ." was a real bug class in this app).
 */
export function tutorProfileLines(profile: LearnerProfile, fallbackName: string): string[] {
  const lines: string[] = [];
  const name = profile.displayName || fallbackName;
  if (name) lines.push(`The learner's name is ${name}.`);
  if (profile.job) lines.push(`They describe themselves as ${profile.job}.`);
  if (profile.interests.length > 0) {
    lines.push(`They enjoy ${profile.interests.join(', ').toLowerCase()}.`);
  }
  if (profile.goals.length > 0) {
    lines.push(`They are learning for ${profile.goals.join(', ').toLowerCase()}.`);
  }
  return lines;
}
