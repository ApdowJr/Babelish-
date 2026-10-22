/**
 * Learner-profile rules.
 *
 * The profile is rendered directly (an emoji sits inside the avatar circle, a
 * name goes into the tutor prompt), so every field has to come back from
 * storage as something safe to render — never `undefined`, never arbitrary
 * text where an emoji belongs, never an unbounded string.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AVATAR_COLORS,
  AVATAR_EMOJIS,
  DEFAULT_PROFILE,
  GOAL_OPTIONS,
  INTEREST_OPTIONS,
  LIMITS,
  avatarInitials,
  normalizeLearnerProfile,
  profileCompleteness,
  profileSummary,
  toggleChip,
  tutorProfileLines,
} from '../src/lib/learnerProfile';

test('junk in storage returns a complete default profile', () => {
  for (const raw of [null, undefined, 7, 'nope', [], true]) {
    assert.deepEqual(normalizeLearnerProfile(raw), DEFAULT_PROFILE);
  }
});

test('a 3.1 blob without avatar or bio still loads', () => {
  const result = normalizeLearnerProfile({
    displayName: 'Amina',
    job: 'a nurse',
    interests: ['Cooking'],
    goals: ['Work & career'],
  });
  assert.equal(result.displayName, 'Amina');
  assert.equal(result.bio, '');
  assert.equal(result.avatar, '');
  assert.equal(result.avatarColor, 'forest');
});

test('an arbitrary string never becomes the avatar', () => {
  const result = normalizeLearnerProfile({ avatar: '<script>', avatarColor: 'neon' });
  assert.equal(result.avatar, '');
  assert.equal(result.avatarColor, 'forest');
  // Anything from the offered set is kept.
  assert.equal(normalizeLearnerProfile({ avatar: AVATAR_EMOJIS[2] }).avatar, AVATAR_EMOJIS[2]);
  assert.equal(normalizeLearnerProfile({ avatarColor: 'lilac' }).avatarColor, 'lilac');
  assert.equal(AVATAR_COLORS.length, 6);
});

test('text fields are trimmed and bounded', () => {
  const result = normalizeLearnerProfile({
    displayName: '  ' + 'a'.repeat(200) + '  ',
    bio: 'b'.repeat(500),
    job: 'c'.repeat(200),
  });
  assert.equal(result.displayName.length, LIMITS.displayName);
  assert.equal(result.bio.length, LIMITS.bio);
  assert.equal(result.job.length, LIMITS.job);
  assert.equal(result.displayName, result.displayName.trim());
});

test('chips are deduped, capped, and limited to the offered options', () => {
  const result = normalizeLearnerProfile({
    interests: ['Cooking', 'Cooking', 'Skydiving', 42, 'Music'],
    goals: [...GOAL_OPTIONS, ...GOAL_OPTIONS],
  });
  assert.deepEqual(result.interests, ['Cooking', 'Music']);
  assert.equal(result.goals.length, GOAL_OPTIONS.length);
  assert.ok(result.goals.every((goal) => (GOAL_OPTIONS as readonly string[]).includes(goal)));

  const tooMany = normalizeLearnerProfile({ interests: [...INTEREST_OPTIONS] });
  assert.equal(tooMany.interests.length, LIMITS.chips);
});

test('initials fall back to a question mark, never an empty circle', () => {
  assert.equal(avatarInitials('Amina Yusuf'), 'AY');
  assert.equal(avatarInitials('  amina  '), 'A');
  assert.equal(avatarInitials(''), '?');
  assert.equal(avatarInitials(null), '?');
  assert.equal(avatarInitials(undefined), '?');
  assert.equal(avatarInitials('محمد علي'), 'مع');
});

test('completeness reaches 1 only when every part is filled', () => {
  assert.equal(profileCompleteness(DEFAULT_PROFILE), 0);
  const full = {
    ...DEFAULT_PROFILE,
    displayName: 'Amina',
    avatar: '🌍',
    job: 'a nurse',
    interests: ['Music'],
    goals: ['Travel'],
  };
  assert.equal(profileCompleteness(full), 1);
  assert.ok(profileCompleteness({ ...full, job: '' }) < 1);
});

test('the summary is null when empty, and reads like a sentence when not', () => {
  assert.equal(profileSummary(DEFAULT_PROFILE), null);
  assert.equal(profileSummary({ ...DEFAULT_PROFILE, job: 'a nurse' }), 'a nurse');
  assert.equal(
    profileSummary({ ...DEFAULT_PROFILE, job: 'a nurse', goals: ['Work & career'] }),
    'a nurse · learning for work & career'
  );
  assert.equal(
    profileSummary({ ...DEFAULT_PROFILE, interests: ['Cooking', 'Music'] }),
    'into cooking, music'
  );
});

test('an empty profile produces no broken prompt lines', () => {
  // The bug class this prevents: "You are talking to , who works as ."
  for (const line of tutorProfileLines(DEFAULT_PROFILE, '')) {
    assert.ok(!/,\s*,|as\s*\.|for\s*\.|enjoy\s*\./.test(line), line);
  }
  assert.deepEqual(tutorProfileLines(DEFAULT_PROFILE, 'Learner'), ["The learner's name is Learner."]);
  assert.deepEqual(
    tutorProfileLines(
      { ...DEFAULT_PROFILE, displayName: 'Amina', job: 'a nurse', goals: ['Travel'] },
      'Learner'
    ),
    [
      "The learner's name is Amina.",
      'They describe themselves as a nurse.',
      'They are learning for travel.',
    ]
  );
});

test('toggleChip adds and removes without mutating', () => {
  const start = ['Music'];
  assert.deepEqual(toggleChip(start, 'Cooking'), ['Music', 'Cooking']);
  assert.deepEqual(toggleChip(start, 'Music'), []);
  assert.deepEqual(start, ['Music']);
});
