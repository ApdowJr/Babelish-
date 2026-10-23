import { useEffect, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Screen } from '@/components/Screen';
import { showAlert } from '@/lib/alert';
import { useAuth } from '@/context/AuthContext';
import { usePreferences, languageName } from '@/state/preferences';
import { useLearning } from '@/state/learning';
import { DEFAULT_PROFILE, useProfile } from '@/state/profile';
import { useAnalytics } from '@/state/analytics';
import { useSubscription } from '@/state/subscription';
import { DAILY_GOALS, VOICE_SPEEDS } from '@/lib/preferenceRules';
import { LANGUAGES, getLanguage } from '@/data/languages';
import { filterSettings } from '@/lib/settingsSearch';
import { REMINDER_SLOTS, slotKey } from '@/lib/reminder';
import { cancelDailyReminder, scheduleDailyReminder, sendTestReminder } from '@/lib/notifications';
import { buildDataExport } from '@/lib/privacy';
import { clearAllAccountLocalData } from '@/lib/scopedStorage';
import { clearConversations } from '@/lib/conversationStorage';
import { ownerIdFor } from '@/lib/conversations';
import { buildPack, formatPackSize } from '@/lib/offline';
import { clearLearningStorage, loadCurriculum } from '@/lib/curriculum/store';
import { createAiTransport, fetchAiStatus, type AiStatus } from '@/lib/ai';
import { radii, shadows, spacing, typography, type Palette } from '@/theme/tokens';
import { useTheme, useThemedStyles } from '@/theme/theme';
import { THEME_MODES, type ThemeMode } from '@/theme/palette';

type IconName = keyof typeof Ionicons.glyphMap;

type RowBase = {
  id: string;
  icon: IconName;
  label: string;
  hint?: string;
  keywords?: string;
  tint?: string;
};

type Row =
  | (RowBase & { kind: 'nav'; detail?: string; danger?: boolean; onPress: () => void })
  | (RowBase & { kind: 'toggle'; value: boolean; onChange: (value: boolean) => void })
  | (RowBase & {
      kind: 'chips';
      options: { label: string; active: boolean; onPress: () => void }[];
    })
  | (RowBase & { kind: 'info'; detail: string });

type Group = { id: string; title: string; rows: Row[] };

const THEME_LABELS: Record<ThemeMode, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

const VOICE_LABELS: Record<(typeof VOICE_SPEEDS)[number], string> = {
  slow: 'Slow',
  normal: 'Normal',
  fast: 'Fast',
};

export default function SettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors, isDark } = useTheme();
  const { user, signOut, getAccessToken, isDemo } = useAuth();
  const prefs = usePreferences();
  const {
    setDailyGoal,
    setNativeLanguage,
    setReminderKey,
    setShowTranslation,
    setVoiceSpeed,
    setAutoSpeak,
    setReduceMotion,
    setThemeMode,
  } = prefs;
  const { progress, vocab, resetLearning } = useLearning();
  const { profile, saveProfile } = useProfile();
  const { state: analytics, resetAnalytics } = useAnalytics();
  const { resetSubscription } = useSubscription();

  const [query, setQuery] = useState('');
  const [languagePicker, setLanguagePicker] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [pack, setPack] = useState<{ chapters: number; exercises: number; kb: number } | null>(null);

  const target = getLanguage(prefs.targetLanguageId);
  const version = Constants.expoConfig?.version ?? '3.4.0';

  // A live probe, not a stored flag: the row must say what is true now.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const jwt = await getAccessToken().catch(() => null);
      const status = await fetchAiStatus(createAiTransport(jwt));
      if (!cancelled) setAiStatus(status);
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, user?.id]);

  useEffect(() => {
    let cancelled = false;
    loadCurriculum(prefs.targetLanguageId)
      .then((chapters) => {
        if (cancelled) return;
        const exercises = chapters.reduce(
          (n, chapter) => n + chapter.lessons.reduce((m, lesson) => m + lesson.exercises.length, 0),
          0
        );
        setPack(buildPack({ languageId: prefs.targetLanguageId, chapters: chapters.length, exercises, phrases: 0 }));
      })
      .catch(() => {
        if (!cancelled) setPack(null);
      });
    return () => {
      cancelled = true;
    };
  }, [prefs.targetLanguageId]);

  const webSpeechSupported =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    Boolean(
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ??
        (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
          .webkitSpeechRecognition
    );
  const tutorLive = aiStatus?.chat === true;
  const voiceLive = aiStatus?.stt === true || webSpeechSupported;

  async function pickReminder(hour: number, minute: number, turningOff: boolean) {
    if (turningOff) {
      await cancelDailyReminder();
      setReminderKey(null);
      return;
    }
    const slot = { hour, minute, label: '', icon: '' };
    const result = await scheduleDailyReminder(slot, {
      languageName: target.name,
      streak: 0,
      name: profile.displayName || undefined,
    });
    if (result === 'scheduled') {
      setReminderKey(slotKey(hour, minute));
    } else if (result === 'denied') {
      showAlert(
        'Notifications blocked',
        'Allow notifications for Babelish in your system settings, then pick a time again.'
      );
    } else {
      showAlert('Reminder unavailable', 'This device could not schedule the reminder.');
    }
  }

  function exportMyData() {
    const payload = buildDataExport({
      profile,
      preferences: {
        targetLanguageId: prefs.targetLanguageId,
        nativeLanguageId: prefs.nativeLanguageId,
        reminderKey: prefs.reminderKey,
      },
      progress,
      vocab,
      analytics,
    });

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `babelish-data-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showAlert('Export downloaded', 'Your Babelish data export was saved as a JSON file.');
        return;
      } catch {
        // Fall through to Share / clipboard below.
      }
    }

    void Share.share({
      title: 'Babelish data export',
      message: payload,
    }).catch(async () => {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(payload);
          showAlert('Export copied', 'Your Babelish data export JSON was copied to your clipboard.');
          return;
        } catch {
          // Ignore clipboard errors.
        }
      }
      showAlert('Export unavailable', 'Could not open the share sheet on this device.');
    });
  }

  function clearChats() {
    showAlert(
      'Clear saved conversations?',
      'Tutor chats on this device are removed. Your lessons, reviews and streak stay exactly as they are.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            void clearConversations(ownerIdFor(user?.id ?? null)).then(() =>
              showAlert('Conversations cleared', 'The tutor will start fresh next time you open Speak.')
            );
          },
        },
      ]
    );
  }

  function confirmSignOut() {
    showAlert('Sign out?', 'Your progress stays on this device and syncs again when you sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  function confirmDeleteAccount() {
    if (!user) {
      showAlert('Sign in required', 'Sign in to your account before requesting account deletion.');
      return;
    }
    const client = supabase;
    if (isDemo || !client) {
      showAlert(
        'Delete demo account?',
        'This clears your local demo account, profile, progress, vocabulary and saved tutor conversations on this device. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete permanently',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  await clearLearningStorage(user.id);
                  await clearConversations(ownerIdFor(user.id));
                  await clearAllAccountLocalData(user.id);
                  await resetAnalytics();
                  await resetLearning();
                  saveProfile(DEFAULT_PROFILE);
                  await resetSubscription();
                  await signOut();
                } finally {
                  showAlert('Account deleted', 'Your demo account and local learning data were deleted.');
                  router.replace('/login');
                }
              })();
            },
          },
        ]
      );
      return;
    }
    showAlert(
      'Permanently delete account?',
      'This deletes your Supabase account and cloud learning data. Your local Babelish profile, progress, vocabulary and saved tutor conversations on this device will also be cleared. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                const { error } = await client.functions.invoke('delete-account', { body: {} });
                if (error) throw error;
              } catch {
                showAlert(
                  'Account not deleted',
                  'The server could not confirm deletion. Your account was not reported as deleted; check your connection and try again.'
                );
                return;
              }

              // The server confirmed deletion. Clear local state separately so a
              // device-storage hiccup cannot falsely claim the cloud account survived.
              try {
                await client.auth.signOut({ scope: 'local' });
                await clearLearningStorage(user.id);
                await clearConversations(ownerIdFor(user.id));
                await clearAllAccountLocalData(user.id);
                await resetAnalytics();
                await resetLearning();
                saveProfile(DEFAULT_PROFILE);
                await resetSubscription();
              } finally {
                showAlert(
                  'Account deleted',
                  'Your Supabase account and cloud data were deleted, and saved data on this device was cleared.'
                );
                router.replace('/login');
              }
            })();
          },
        },
      ]
    );
  }

  async function testReminder() {
    const result = await sendTestReminder();
    if (result === 'scheduled') {
      showAlert(
        'Test reminder sent',
        'It arrives in about five seconds. If you do not see it, notifications are probably switched off for Babelish in your system settings.'
      );
    } else if (result === 'denied') {
      showAlert(
        'Notifications are off',
        'Allow notifications for Babelish in your system settings, then try again.'
      );
    } else {
      showAlert('Could not send a test', 'This device refused to schedule a local notification.');
    }
  }

  function sendFeedback() {
    // Version, platform and the course being studied — enough to reproduce a
    // bug, and nothing that identifies the learner.
    const body = [
      '',
      '',
      '---',
      `App: Babelish ${version}`,
      `Platform: ${Platform.OS} ${Platform.Version}`,
      `Learning: ${target.name} (${prefs.targetLanguageId})`,
    ].join('\n');
    const url = `mailto:support@zelvoca.app?subject=${encodeURIComponent(
      `Babelish ${version} feedback`
    )}&body=${encodeURIComponent(body)}`;
    Linking.openURL(url).catch(() =>
      showAlert('No email app found', 'Write to support@zelvoca.app from any email app.')
    );
  }

  function confirmResetProgress() {
    showAlert(
      'Reset all progress?',
      'Lessons, saved words, XP and your streak will be cleared on this device and in your account. Your profile, settings and account stay. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              // Raw stores first (speaking stats and the report queue are not
              // owned by a provider), then the providers, which also push the
              // empty state to the server so a sync cannot restore it.
              await clearLearningStorage(user?.id);
              await resetLearning();
              await resetAnalytics();
              showAlert(
                'Progress reset',
                'You are starting from the first lesson. Your account and profile are unchanged.'
              );
            })();
          },
        },
      ]
    );
  }

  const groups: Group[] = (() => {
    const reminderOptions = REMINDER_SLOTS.map((slot) => {
      const key = slotKey(slot.hour, slot.minute);
      return {
        label: `${slot.icon} ${slot.label}`,
        active: prefs.reminderKey === key,
        onPress: () => void pickReminder(slot.hour, slot.minute, prefs.reminderKey === key),
      };
    });

    return [
      {
        id: 'account',
        title: 'Account',
        rows: [
          {
            id: 'identity',
            kind: 'info',
            icon: 'person-outline',
            label: user?.displayName ?? 'Learner',
            hint: 'Signed in',
            detail: user?.email ?? 'Demo account',
          },
          {
            id: 'signout',
            kind: 'nav',
            icon: 'log-out-outline',
            label: 'Sign out',
            hint: 'Progress stays on this device',
            keywords: 'logout leave account',
            onPress: confirmSignOut,
          },
        ],
      },
      {
        id: 'appearance',
        title: 'Appearance',
        rows: [
          {
            id: 'theme',
            kind: 'chips',
            icon: 'contrast-outline',
            label: 'Theme',
            hint:
              prefs.themeMode === 'system'
                ? `Following this device — ${isDark ? 'dark' : 'light'} right now`
                : `${THEME_LABELS[prefs.themeMode]} palette in every screen`,
            keywords: 'dark light night mode appearance colour color',
            options: THEME_MODES.map((mode) => ({
              label: THEME_LABELS[mode],
              active: prefs.themeMode === mode,
              onPress: () => setThemeMode(mode),
            })),
          },
        ],
      },
      {
        id: 'learning',
        title: 'Learning',
        rows: [
          {
            id: 'goal',
            kind: 'chips',
            icon: 'flag-outline',
            label: 'Daily goal',
            hint: `${prefs.dailyGoalMinutes * 10} XP a day · about ${prefs.dailyGoalMinutes} minutes`,
            keywords: 'xp minutes target',
            options: DAILY_GOALS.map((minutes) => ({
              label: `${minutes} min`,
              active: prefs.dailyGoalMinutes === minutes,
              onPress: () => setDailyGoal(minutes),
            })),
          },
          {
            id: 'native',
            kind: 'nav',
            icon: 'chatbubbles-outline',
            label: 'Explanation language',
            hint: 'The language the tutor explains in',
            detail: languageName(prefs.nativeLanguageId),
            keywords: 'native language translation',
            onPress: () => setLanguagePicker(true),
          },
          ...(Platform.OS === 'web'
            ? []
            : ([
                {
                  id: 'reminder',
                  kind: 'chips',
                  icon: 'notifications-outline',
                  label: 'Daily reminder',
                  hint: prefs.reminderKey
                    ? `Set for ${prefs.reminderKey} — tap it again to turn it off.`
                    : 'Off — pick a time for one calm reminder.',
                  keywords: 'notification alarm time nudge',
                  options: reminderOptions,
                },
                {
                  id: 'test-reminder',
                  kind: 'nav',
                  icon: 'notifications-circle-outline',
                  label: 'Send a test reminder',
                  hint: 'Checks the permission without waiting for your reminder time',
                  keywords: 'notification test try check',
                  onPress: () => void testReminder(),
                },
              ] as Row[])),
          {
            id: 'translation',
            kind: 'toggle',
            icon: 'language-outline',
            label: 'Show translations',
            hint: 'Under tutor replies, on by default',
            keywords: 'translate subtitles',
            value: prefs.showTranslation,
            onChange: setShowTranslation,
          },
          {
            id: 'autospeak',
            kind: 'toggle',
            icon: 'volume-high-outline',
            label: 'Read replies aloud',
            hint: 'Speak new tutor messages automatically',
            keywords: 'audio voice tts sound',
            value: prefs.autoSpeak,
            onChange: setAutoSpeak,
          },
          {
            id: 'speed',
            kind: 'chips',
            icon: 'speedometer-outline',
            label: 'Voice speed',
            hint: 'Applies to every spoken word and phrase',
            keywords: 'rate slow fast audio',
            options: VOICE_SPEEDS.map((speed) => ({
              label: VOICE_LABELS[speed],
              active: prefs.voiceSpeed === speed,
              onPress: () => setVoiceSpeed(speed),
            })),
          },
        ],
      },
      {
        id: 'languages',
        title: 'Languages',
        rows: [
          {
            id: 'target',
            kind: 'nav',
            icon: 'globe-outline',
            label: 'Learning',
            hint: `${target.flag} ${target.name} · ${prefs.activeLanguageIds.length} in your list`,
            detail: 'Manage',
            keywords: 'course target language switch',
            onPress: () => router.push('/learn'),
          },
        ],
      },
      {
        id: 'tutor',
        title: 'Tutor & voice',
        rows: [
          {
            id: 'tutor-status',
            kind: 'info',
            icon: 'sparkles-outline',
            label: 'AI tutor',
            hint: tutorLive ? 'A real model answers in Speak' : 'Bundled coach replies — no model configured',
            detail: tutorLive ? 'Live' : 'Coach',
            keywords: 'model online status',
          },
          {
            id: 'voice-status',
            kind: 'info',
            icon: 'mic-outline',
            label: 'Voice input',
            hint:
              aiStatus?.stt === true
                ? 'Transcription is available'
                : webSpeechSupported
                  ? 'Browser speech recognition is available'
                  : 'Not configured — type your replies',
            detail: voiceLive ? 'Ready' : 'Off',
            keywords: 'speech microphone stt',
          },
        ],
      },
      {
        id: 'accessibility',
        title: 'Accessibility',
        rows: [
          {
            id: 'motion',
            kind: 'toggle',
            icon: 'sparkles-outline',
            label: 'Reduce motion',
            hint: 'Skip the splash entrance and other decorative movement',
            keywords: 'animation accessibility',
            value: prefs.reduceMotion,
            onChange: setReduceMotion,
          },
          ...(Platform.OS === 'web'
            ? []
            : ([
                {
                  id: 'system-settings',
                  kind: 'nav',
                  icon: 'options-outline',
                  label: 'System settings',
                  hint: 'Text size, notifications and microphone permissions',
                  keywords: 'os device permissions font',
                  onPress: () => {
                    Linking.openSettings().catch(() =>
                      showAlert('Could not open settings', 'Open your device Settings app instead.')
                    );
                  },
                },
              ] as Row[])),
        ],
      },
      {
        id: 'data',
        title: 'Data & storage',
        rows: [
          {
            id: 'offline',
            kind: 'info',
            icon: 'download-outline',
            label: 'Offline curriculum',
            hint: 'Lessons and reviews work without a connection',
            detail: pack ? `${pack.chapters} chapters · ${formatPackSize(pack.kb)}` : 'Bundled',
            keywords: 'download storage offline',
          },
          {
            id: 'export',
            kind: 'nav',
            icon: 'share-outline',
            label: 'Export my data',
            hint: 'Profile, progress and vocabulary as text',
            keywords: 'download backup privacy',
            onPress: exportMyData,
          },
          {
            id: 'reset-progress',
            kind: 'nav',
            icon: 'refresh-outline',
            label: 'Reset progress',
            hint: 'Start from lesson one — keeps your account and profile',
            keywords: 'start over clear xp streak lessons restart',
            danger: true,
            onPress: confirmResetProgress,
          },
          {
            id: 'clear-chats',
            kind: 'nav',
            icon: 'trash-outline',
            label: 'Clear saved conversations',
            hint: 'Tutor chats on this device only',
            keywords: 'delete history chat',
            onPress: clearChats,
          },
        ],
      },
      {
        id: 'about',
        title: 'About & help',
        rows: [
          {
            id: 'coach',
            kind: 'nav',
            icon: 'help-circle-outline',
            label: 'Why “Coach” mode?',
            hint: 'What happens with no model configured',
            keywords: 'faq offline ai help',
            onPress: () =>
              showAlert(
                'Coach mode',
                'Babelish never invents an AI answer. When no model is reachable, the tutor answers from the bundled course: it can translate, drill and explain the grammar it ships with, and says so on every reply. Connect a server or a local model and the same screen switches to live answers.'
              ),
          },
          {
            id: 'recordings',
            kind: 'nav',
            icon: 'shield-checkmark-outline',
            label: 'Are my recordings stored?',
            hint: 'Microphone privacy',
            keywords: 'faq audio privacy mic',
            onPress: () =>
              showAlert(
                'Your voice',
                'Audio is captured only while you hold the mic, sent for transcription when a transcriber is configured, and never written to storage. There is no pronunciation score without a real transcript to compare against.'
              ),
          },
          {
            id: 'feedback',
            kind: 'nav',
            icon: 'mail-outline',
            label: 'Send feedback',
            hint: 'Opens your email app — no in-app tracking',
            keywords: 'contact support help bug report email',
            onPress: sendFeedback,
          },
          {
            id: 'privacy',
            kind: 'nav',
            icon: 'document-text-outline',
            label: 'Privacy policy',
            keywords: 'legal terms data',
            onPress: () => router.push('/privacy'),
          },
          {
            id: 'terms',
            kind: 'nav',
            icon: 'reader-outline',
            label: 'Terms of Service',
            hint: 'How the app can be used',
            keywords: 'legal terms license eula',
            onPress: () => router.push('/terms'),
          },
          {
            id: 'version',
            kind: 'info',
            icon: 'information-circle-outline',
            label: 'Version',
            hint: `Babelish · ${LANGUAGES.length} languages · no ads, no trackers`,
            detail: `${version} (${Platform.OS})`,
            keywords: 'build about update',
          },
        ],
      },
      {
        id: 'danger',
        title: 'Danger zone',
        rows: [
          {
            id: 'delete',
            kind: 'nav',
            icon: 'warning-outline',
            label: 'Delete account',
            hint: 'Removes your data here and on Babelish servers',
            keywords: 'remove erase account',
            danger: true,
            onPress: confirmDeleteAccount,
          },
        ],
      },
    ];
  })();

  const visible = filterSettings(groups, query);

  return (
    <Screen scroll tabBarSpace>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Settings
        </Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={17} color={colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search settings"
          placeholderTextColor={colors.textFaint}
          style={styles.searchInput}
          returnKeyType="search"
          accessibilityLabel="Search settings"
          autoCorrect={false}
        />
        {query ? (
          <Pressable
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={17} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No setting matches “{query.trim()}”</Text>
          <Text style={styles.emptyBody}>Try “voice”, “language”, “privacy” or “motion”.</Text>
        </View>
      ) : null}

      {visible.map((group) => (
        <View key={group.id} style={styles.group}>
          <Text style={styles.groupTitle} accessibilityRole="header">
            {group.title.toUpperCase()}
          </Text>
          <View style={styles.card}>
            {group.rows.map((row, index) => (
              <View key={row.id}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <RowView row={row} />
              </View>
            ))}
          </View>
        </View>
      ))}

      <Text style={styles.footer}>
        Babelish {version} · open-source models, no paid AI required
      </Text>

      <LanguageModal
        visible={languagePicker}
        current={prefs.nativeLanguageId}
        onClose={() => setLanguagePicker(false)}
        onPick={(id) => {
          setNativeLanguage(id);
          setLanguagePicker(false);
        }}
      />
    </Screen>
  );
}

function RowView({ row }: { row: Row }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const danger = row.kind === 'nav' && row.danger === true;
  const tint = danger ? colors.danger : (row.tint ?? colors.primary);
  const tileBg = danger ? colors.dangerSoft : colors.primarySoft;

  const body = (children: React.ReactNode) => (
    <View style={styles.row}>
      <View style={[styles.iconTile, { backgroundColor: tileBg }]}>
        <Ionicons name={row.icon} size={17} color={tint} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{row.label}</Text>
        {row.hint ? <Text style={styles.rowHint}>{row.hint}</Text> : null}
      </View>
      {children}
    </View>
  );

  if (row.kind === 'toggle') {
    return (
      <Pressable
        onPress={() => row.onChange(!row.value)}
        accessibilityRole="switch"
        accessibilityLabel={row.label}
        accessibilityHint={row.hint}
        accessibilityState={{ checked: row.value }}
        style={({ pressed }) => [pressed && styles.rowPressed]}
      >
        {body(
          // The row is the control. The switch is visual only: a second tap
          // handler here would toggle twice on web (input click + row press),
          // and a screen reader would announce one setting as two switches.
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Switch
              value={row.value}
              trackColor={{ false: colors.borderStrong, true: colors.primary }}
              thumbColor={colors.white}
              ios_backgroundColor={colors.borderStrong}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          </View>
        )}
      </Pressable>
    );
  }

  if (row.kind === 'nav') {
    return (
      <Pressable
        onPress={row.onPress}
        accessibilityRole="button"
        accessibilityLabel={row.label}
        accessibilityHint={row.hint}
        style={({ pressed }) => [pressed && styles.rowPressed]}
      >
        {body(
          <View style={styles.rowEnd}>
            {row.detail ? <Text style={styles.rowDetail}>{row.detail}</Text> : null}
            <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
          </View>
        )}
      </Pressable>
    );
  }

  if (row.kind === 'chips') {
    return (
      <View>
        {body(<View />)}
        <View style={styles.chips}>
          {row.options.map((option) => (
            <Pressable
              key={option.label}
              onPress={option.onPress}
              accessibilityRole="radio"
              accessibilityLabel={`${row.label}: ${option.label}`}
              accessibilityState={{ selected: option.active }}
              style={[styles.chip, option.active && styles.chipOn]}
            >
              <Text style={[styles.chipText, option.active && styles.chipTextOn]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  return body(<Text style={styles.rowDetail}>{row.detail}</Text>);
}

function LanguageModal({
  visible,
  current,
  onPick,
  onClose,
}: {
  visible: boolean;
  current: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close language picker" accessibilityRole="button" />
      <View style={styles.sheet}>
        <View style={styles.sheetGrabber} />
        <Text style={styles.sheetTitle}>Explanation language</Text>
        <Text style={styles.sheetBody}>The language the tutor uses to explain grammar and translations.</Text>
        <ScrollView style={styles.sheetList} contentContainerStyle={{ paddingBottom: spacing.xl }}>
          <Pressable
            onPress={() => onPick('en')}
            accessibilityRole="radio"
            accessibilityState={{ selected: current === 'en' }}
            accessibilityLabel="Explanation language: English"
            style={[styles.langRow, current === 'en' && styles.langRowOn]}
          >
            <Text style={styles.langFlag}>🇬🇧</Text>
            <Text style={styles.langName}>English</Text>
            {current === 'en' ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
          </Pressable>
          {LANGUAGES.map((language) => {
            const active = current === language.id;
            return (
              <Pressable
                key={language.id}
                onPress={() => onPick(language.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Explanation language: ${language.name}`}
                style={[styles.langRow, active && styles.langRowOn]}
              >
                <Text style={styles.langFlag}>{language.flag}</Text>
                <Text style={styles.langName}>{language.name}</Text>
                {active ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.title, color: c.text },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchInput: { flex: 1, ...typography.body, color: c.text, paddingVertical: 0 },
  empty: { paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.xs },
  emptyTitle: { ...typography.bodyStrong, color: c.text },
  emptyBody: { ...typography.caption, color: c.textMuted },
  group: { marginTop: spacing.xl },
  groupTitle: { ...typography.micro, color: c.textMuted, marginBottom: spacing.sm, marginLeft: spacing.xs },
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 58,
  },
  rowPressed: { backgroundColor: c.surfaceTint },
  iconTile: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...typography.bodyStrong, color: c.text },
  rowHint: { ...typography.caption, color: c.textMuted, lineHeight: 17 },
  rowEnd: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowDetail: { ...typography.caption, color: c.textMuted, maxWidth: 160, textAlign: 'right' },
  divider: { height: 1, backgroundColor: c.border, marginLeft: spacing.md + 32 + spacing.md },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
    backgroundColor: c.bg,
  },
  chipOn: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { ...typography.caption, color: c.textMuted, fontWeight: '600' },
  chipTextOn: { color: c.onDark },
  footer: { ...typography.caption, color: c.textMuted, textAlign: 'center', marginTop: spacing.xxl },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(21, 35, 29, 0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '82%',
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  sheetGrabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.borderStrong,
    marginBottom: spacing.md,
  },
  sheetTitle: { ...typography.heading, color: c.text },
  sheetBody: { ...typography.caption, color: c.textMuted, marginTop: 2, marginBottom: spacing.md },
  sheetList: { marginBottom: spacing.md },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
  langRowOn: { backgroundColor: c.surfaceHigh },
  langFlag: { fontSize: 20 },
  langName: { ...typography.body, color: c.text, flex: 1 },
});
