import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { showAlert } from '@/lib/alert';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/state/profile';
import {
  AVATAR_COLORS,
  AVATAR_EMOJIS,
  GOAL_OPTIONS,
  INTEREST_OPTIONS,
  LIMITS,
  profileSummary,
  toggleChip,
  type AvatarColor,
  type LearnerProfile,
} from '@/lib/learnerProfile';
import { radii, spacing, typography, type Palette } from '@/theme/tokens';
import { useTheme, useThemedStyles } from '@/theme/theme';

/**
 * The profile editor.
 *
 * Why a separate screen instead of inline fields: the old card saved on every
 * keystroke (so a mis-tap was permanent) and had no room for an avatar. Here
 * edits are held in local state, "Save" is the only thing that writes, and
 * leaving with unsaved changes asks first. The live preview shows exactly the
 * lines the tutor will receive.
 */
export default function EditProfileScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const { profile, saveProfile } = useProfile();
  const [draft, setDraft] = useState<LearnerProfile>(profile);

  const changed = useMemo(
    () => (Object.keys(draft) as (keyof LearnerProfile)[]).some((key) => {
      const a = draft[key];
      const b = profile[key];
      return Array.isArray(a) && Array.isArray(b) ? a.join('\u0000') !== b.join('\u0000') : a !== b;
    }),
    [draft, profile]
  );

  const accountName = user?.displayName ?? 'Learner';
  const previewName = draft.displayName || accountName;
  const summary = profileSummary(draft);
  const filled =
    [draft.displayName, draft.bio, draft.job, draft.avatar].filter(Boolean).length +
    draft.interests.length +
    draft.goals.length;

  function patch(update: Partial<LearnerProfile>) {
    setDraft((current) => ({ ...current, ...update }));
  }

  function leave() {
    if (!changed) {
      router.back();
      return;
    }
    showAlert('Discard changes?', 'Your profile has unsaved edits.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  }

  function save() {
    saveProfile(draft);
    router.back();
  }

  function clearAll() {
    showAlert('Clear your profile?', 'The tutor will go back to a generic profile. Your account is not affected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          saveProfile({
            displayName: '',
            bio: '',
            job: '',
            avatar: '',
            avatarColor: 'forest',
            interests: [],
            goals: [],
          });
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen scroll tabBarSpace>
      <View style={styles.topBar}>
        <Pressable
          onPress={leave}
          style={styles.textButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Cancel and go back"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Edit profile
        </Text>
        <Pressable
          onPress={save}
          style={styles.textButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Save profile"
          accessibilityState={{ disabled: !changed }}
          disabled={!changed}
        >
          <Text style={[styles.saveText, !changed && styles.saveTextMuted]}>Save</Text>
        </Pressable>
      </View>

      {/* ── Preview ─────────────────────────────────────────────────────── */}
      <View style={styles.preview}>
        <View style={styles.previewOrb} />
        <Avatar name={previewName} emoji={draft.avatar} color={draft.avatarColor} size={68} onDark ring />
        <View style={styles.previewText}>
          <Text style={styles.previewName} numberOfLines={1}>
            {previewName}
          </Text>
          <Text style={styles.previewMeta} numberOfLines={2}>
            {draft.bio || summary || 'Add a line about yourself — the tutor uses it for examples.'}
          </Text>
        </View>
      </View>

      {/* ── Avatar ──────────────────────────────────────────────────────── */}
      <Text style={styles.sectionTitle} accessibilityRole="header">
        PICK AN AVATAR
      </Text>
      <View style={styles.card}>
        <View style={styles.emojiGrid} accessibilityRole="radiogroup">
          <Pressable
            onPress={() => patch({ avatar: '' })}
            accessibilityRole="radio"
            accessibilityLabel="No emoji, use my initials"
            accessibilityState={{ selected: draft.avatar === '' }}
            style={[styles.emojiCell, draft.avatar === '' && styles.emojiCellOn]}
          >
            <Text style={styles.initials}>{previewName.slice(0, 1).toUpperCase()}</Text>
          </Pressable>
          {AVATAR_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => patch({ avatar: emoji })}
              accessibilityRole="radio"
              accessibilityLabel={`Avatar ${emoji}`}
              accessibilityState={{ selected: draft.avatar === emoji }}
              style={[styles.emojiCell, draft.avatar === emoji && styles.emojiCellOn]}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>Colour</Text>
        <View style={styles.colorRow}>
          {AVATAR_COLORS.map((color) => {
            const active = draft.avatarColor === color;
            return (
              <Pressable
                key={color}
                onPress={() => patch({ avatarColor: color as AvatarColor })}
                accessibilityRole="radio"
                accessibilityLabel={`Avatar colour ${color}`}
                accessibilityState={{ selected: active }}
                hitSlop={6}
                style={[styles.colorDotWrap, active && styles.colorDotWrapOn]}
              >
                <Avatar name={previewName} emoji={draft.avatar} color={color} size={30} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── Identity ────────────────────────────────────────────────────── */}
      <Text style={styles.sectionTitle} accessibilityRole="header">
        ABOUT YOU
      </Text>
      <View style={styles.card}>
        <Field
          label="What should your tutor call you?"
          value={draft.displayName}
          onChangeText={(value) => patch({ displayName: value })}
          placeholder={accountName}
          maxLength={LIMITS.displayName}
          autoCapitalize="words"
        />
        <Field
          label="One line about you"
          value={draft.bio}
          onChangeText={(value) => patch({ bio: value })}
          placeholder="Learning Spanish for a trip to Madrid"
          maxLength={LIMITS.bio}
          multiline
        />
        <Field
          label="What do you do?"
          value={draft.job}
          onChangeText={(value) => patch({ job: value })}
          placeholder="e.g. a nurse, a student, a chef"
          maxLength={LIMITS.job}
        />
      </View>

      {/* ── Interests & goals ───────────────────────────────────────────── */}
      <Text style={styles.sectionTitle} accessibilityRole="header">
        YOU’RE INTO…
      </Text>
      <View style={styles.card}>
        <ChipGrid
          options={INTEREST_OPTIONS}
          selected={draft.interests}
          onToggle={(chip) => patch({ interests: toggleChip(draft.interests, chip) })}
          labelPrefix="Interest"
        />
        <Text style={styles.hint}>Up to {LIMITS.chips}, used to pick examples from your life.</Text>
      </View>

      <Text style={styles.sectionTitle} accessibilityRole="header">
        YOU’RE LEARNING FOR…
      </Text>
      <View style={styles.card}>
        <ChipGrid
          options={GOAL_OPTIONS}
          selected={draft.goals}
          onToggle={(chip) => patch({ goals: toggleChip(draft.goals, chip) })}
          labelPrefix="Goal"
        />
      </View>

      {/* ── What the tutor sees ─────────────────────────────────────────── */}
      <Text style={styles.sectionTitle} accessibilityRole="header">
        WHAT YOUR TUTOR KNOWS
      </Text>
      <View style={[styles.card, styles.promptCard]}>
        <Text style={styles.promptText}>
          {[
            `Name: ${previewName}`,
            draft.bio ? `About: ${draft.bio}` : null,
            draft.job ? `Work: ${draft.job}` : null,
            draft.interests.length ? `Interests: ${draft.interests.join(', ')}` : null,
            draft.goals.length ? `Goals: ${draft.goals.join(', ')}` : null,
          ]
            .filter(Boolean)
            .join('\n')}
        </Text>
        <Text style={styles.hint}>
          This stays on your device and is sent with your messages so the tutor can use your own
          examples. Nothing else about you leaves the phone.
        </Text>
      </View>

      <Button label="Save profile" onPress={save} disabled={!changed} style={styles.saveButton} />
      <Text style={styles.progressNote}>
        {filled === 0 ? 'Nothing filled in yet.' : `${filled} detail${filled === 1 ? '' : 's'} added.`}
      </Text>
      <Pressable
        onPress={clearAll}
        accessibilityRole="button"
        accessibilityLabel="Clear profile"
        style={styles.clearButton}
        hitSlop={8}
      >
        <Ionicons name="trash-outline" size={14} color={colors.danger} />
        <Text style={styles.clearText}>Clear profile</Text>
      </Pressable>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  maxLength,
  multiline,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  maxLength: number;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const remaining = maxLength - value.length;
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {value.length > maxLength * 0.8 ? (
          <Text style={styles.counter}>{remaining}</Text>
        ) : null}
      </View>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        maxLength={maxLength}
        multiline={multiline}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        accessibilityLabel={label}
      />
    </View>
  );
}

function ChipGrid({
  options,
  selected,
  onToggle,
  labelPrefix,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (chip: string) => void;
  labelPrefix: string;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.chipWrap}>
      {options.map((option) => {
        const on = selected.includes(option);
        return (
          <Pressable
            key={option}
            onPress={() => onToggle(option)}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="checkbox"
            accessibilityLabel={`${labelPrefix}: ${option}`}
            accessibilityState={{ checked: on }}
          >
            {on ? <Ionicons name="checkmark" size={13} color={colors.onDark} /> : null}
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  textButton: { minWidth: 64, paddingVertical: spacing.xs },
  title: { ...typography.heading, color: c.text },
  cancelText: { ...typography.bodyStrong, color: c.textMuted },
  saveText: { ...typography.bodyStrong, color: c.primary, textAlign: 'right' },
  saveTextMuted: { color: c.textFaint },

  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: c.gradientFrom,
    borderRadius: radii.xl,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  previewOrb: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -70,
    right: -40,
  },
  previewText: { flex: 1, gap: 2 },
  previewName: { ...typography.title, color: c.onDark },
  previewMeta: { ...typography.caption, color: c.onDarkMuted, lineHeight: 18 },

  sectionTitle: {
    ...typography.micro,
    color: c.textMuted,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  emojiCell: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
  },
  emojiCellOn: { borderColor: c.primary, backgroundColor: c.primaryTint, borderWidth: 2 },
  emoji: { fontSize: 22 },
  initials: { ...typography.bodyStrong, color: c.textMuted },
  colorRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  colorDotWrap: { borderRadius: 17, padding: 2, borderWidth: 2, borderColor: 'transparent' },
  colorDotWrapOn: { borderColor: c.primary },

  field: { gap: 6 },
  fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { ...typography.caption, color: c.textMuted, fontWeight: '600' },
  counter: { ...typography.caption, color: c.textFaint },
  input: {
    backgroundColor: c.bg,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    ...typography.body,
    color: c.text,
  },
  inputMulti: { minHeight: 76, textAlignVertical: 'top' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
    backgroundColor: c.bg,
  },
  chipOn: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { ...typography.caption, color: c.textMuted, fontWeight: '600' },
  chipTextOn: { color: c.onDark },

  promptCard: { backgroundColor: c.surfaceHigh },
  promptText: { ...typography.caption, color: c.text, lineHeight: 20 },
  hint: { ...typography.caption, color: c.textMuted, lineHeight: 18 },
  saveButton: { marginTop: spacing.xl },
  progressNote: {
    ...typography.caption,
    color: c.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
  },
  clearText: { ...typography.caption, color: c.danger, fontWeight: '700' },
});
