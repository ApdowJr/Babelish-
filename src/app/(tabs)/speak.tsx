import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Chip } from '@/components/Chip';
import { useAuth } from '@/context/AuthContext';
import { usePreferences } from '@/state/preferences';
import { getLanguage } from '@/data/languages';
import { isAIConfigured, speakNative, tutorReply, type TutorMessage } from '@/lib/ai';
import { colors, radii, spacing, typography } from '@/theme/tokens';

export default function SpeakScreen() {
  const { user } = useAuth();
  const { targetLanguageId } = usePreferences();
  const language = getLanguage(targetLanguageId);

  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);
  const listRef = useRef<FlatList<TutorMessage>>(null);

  const scenario = language.scenarios.find((s) => s.id === scenarioId);

  // Reset the conversation when the language or scenario changes — done
  // during render (React's recommended pattern), not inside the effect.
  const conversationKey = `${language.id}:${scenarioId ?? 'free'}`;
  const [prevKey, setPrevKey] = useState(conversationKey);
  if (prevKey !== conversationKey) {
    setPrevKey(conversationKey);
    setMessages([]);
    setBusy(true);
  }

  // Fresh opening line for every new conversation.
  useEffect(() => {
    let cancelled = false;
    tutorReply({
      language,
      history: [],
      learnerName: user?.displayName,
      scenarioTitle: scenario?.title,
    })
      .then((reply) => {
        if (!cancelled) {
          setMessages([{ role: 'assistant', text: reply.text, translation: reply.translation }]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessages([
            {
              role: 'assistant',
              text: '…',
              translation: 'Could not reach the tutor. Check your AI key in .env.',
            },
          ]);
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationKey]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    const history: TutorMessage[] = [...messages, { role: 'user', text }];
    setMessages(history);
    setBusy(true);
    try {
      const reply = await tutorReply({
        language,
        history,
        learnerName: user?.displayName,
        scenarioTitle: scenario?.title,
      });
      setMessages((prev) => [...prev, { role: 'assistant', text: reply.text, translation: reply.translation }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: '…',
          translation: 'Could not reach the tutor. Check your AI key in .env.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push(`/language/${language.id}`)}
          style={styles.headerLanguage}
          accessibilityRole="button"
        >
          <Text style={styles.headerFlag}>{language.flag}</Text>
          <View>
            <Text style={styles.headerTitle}>{language.name}</Text>
            <Text style={styles.headerSubtitle}>
              {scenario ? `${scenario.emoji} ${scenario.title}` : 'Free conversation'}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => setShowTranslation((v) => !v)}
          style={styles.translateToggle}
          accessibilityRole="button"
          accessibilityState={{ selected: showTranslation }}
        >
          <Ionicons
            name="language"
            size={16}
            color={showTranslation ? colors.accent : colors.textFaint}
          />
          <Text style={[styles.translateLabel, showTranslation && styles.translateLabelOn]}>
            {showTranslation ? 'Translation on' : 'Translation off'}
          </Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, index) => String(index)}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={
          <View style={styles.scenarios}>
            <Chip
              label="Free chat"
              selected={scenarioId === null}
              onPress={() => setScenarioId(null)}
            />
            {language.scenarios.map((s) => (
              <Chip
                key={s.id}
                label={`${s.emoji} ${s.title}`}
                selected={scenarioId === s.id}
                onPress={() => setScenarioId(s.id)}
              />
            ))}
          </View>
        }
        ListFooterComponent={
          busy ? (
            <View style={styles.typingRow}>
              <ActivityIndicator size="small" color={colors.primarySoft} />
              <Text style={styles.typingText}>{language.name} is thinking…</Text>
            </View>
          ) : undefined
        }
        renderItem={({ item }) =>
          item.role === 'assistant' ? (
            <View style={[styles.bubble, styles.aiBubble]}>
              <Text style={styles.aiText}>{item.text}</Text>
              {item.translation && showTranslation ? (
                <Text style={styles.aiTranslation}>{item.translation}</Text>
              ) : null}
              <Pressable
                onPress={() => speakNative(item.text, language.ttsLocale)}
                style={styles.listenRow}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Listen to this sentence"
              >
                <Ionicons name="volume-medium-outline" size={15} color={colors.accent} />
                <Text style={styles.listenLabel}>Listen</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.bubble, styles.userBubble]}>
              <Text style={styles.userText}>{item.text}</Text>
            </View>
          )
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.inputBar}>
          <Pressable
            style={styles.micButton}
            disabled
            accessibilityLabel="Voice input coming in Phase 2"
            onPress={() => {}}
          >
            <Ionicons name="mic-outline" size={20} color={colors.textFaint} />
          </Pressable>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={`Reply in ${language.name}…`}
            placeholderTextColor={colors.textFaint}
            returnKeyType="send"
            onSubmitEditing={send}
            accessibilityLabel="Message your tutor"
          />
          <Pressable
            onPress={send}
            disabled={!input.trim() || busy}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            style={({ pressed }) => [styles.sendWrap, (pressed || !input.trim() || busy) && { opacity: 0.6 }]}
          >
            <LinearGradient
              colors={[colors.gradientFrom, colors.gradientTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendButton}
            >
              <Ionicons name="arrow-up" size={20} color={colors.white} />
            </LinearGradient>
          </Pressable>
        </View>
        {!isAIConfigured ? (
          <Text style={styles.demoNote}>Demo tutor — add an AI key in .env for live conversations</Text>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLanguage: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerFlag: { fontSize: 28 },
  headerTitle: { ...typography.bodyStrong, color: colors.text },
  headerSubtitle: { ...typography.caption, color: colors.textMuted },
  translateToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  translateLabel: { ...typography.micro, color: colors.textFaint },
  translateLabelOn: { color: colors.accent },
  listContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  scenarios: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  bubble: { maxWidth: '86%', borderRadius: radii.lg, padding: spacing.lg },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceHigh,
    borderTopLeftRadius: spacing.xs,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    borderTopRightRadius: spacing.xs,
  },
  aiText: { ...typography.body, color: colors.text, lineHeight: 23 },
  aiTranslation: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm, fontStyle: 'italic' },
  listenRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  listenLabel: { ...typography.micro, color: colors.accent },
  userText: { ...typography.body, color: colors.text, lineHeight: 23 },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  typingText: { ...typography.caption, color: colors.textMuted },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    minHeight: 46,
    paddingVertical: spacing.sm,
  },
  sendWrap: { borderRadius: 23 },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoNote: {
    ...typography.micro,
    color: colors.textFaint,
    textAlign: 'center',
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
  },
});
