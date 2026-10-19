import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function PrivacyRoute() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Nativa — Privacy Policy</Text>
      <Text style={styles.meta}>Last updated: 2026-10-18</Text>

      <Text style={styles.h2}>The short version</Text>
      <Text style={styles.p}>
        Your practice stays on your phone. Nativa has no ads, no third-party analytics, and no data
        brokers. The only thing that ever syncs to a server is your progress and vocabulary — under
        your own Neon account, on a database branch you control. Microphone audio is transcribed on
        demand and never stored.
      </Text>

      <Text style={styles.h2}>What lives only on your device</Text>
      <View style={styles.ul}>
        <Text style={styles.li}>• Practice events, XP, streaks, league standing (computed locally)</Text>
        <Text style={styles.li}>• Your learner profile (name, goals, interests)</Text>
        <Text style={styles.li}>• Reminder settings (scheduling is a local OS notification — no push server)</Text>
        <Text style={styles.li}>• The offline curriculum for every language (bundled in the app)</Text>
      </View>
      <Text style={styles.p}>
        None of this leaves the device unless you sign in, and even then only the items in the next
        section sync.
      </Text>

      <Text style={styles.h2}>What syncs when you sign in</Text>
      <View style={styles.table}>
        <View style={styles.tr}>
          <Text style={styles.th}>Data</Text>
          <Text style={styles.th}>Where</Text>
          <Text style={styles.th}>Why</Text>
        </View>
        <View style={styles.tr}>
          <Text style={styles.td}>Lesson progress (scores, timestamps)</Text>
          <Text style={styles.td}>Your Neon Postgres branch (app_state)</Text>
          <Text style={styles.td}>Resume on another device</Text>
        </View>
        <View style={styles.tr}>
          <Text style={styles.td}>Vocabulary / spaced-repetition boxes</Text>
          <Text style={styles.td}>Same row</Text>
          <Text style={styles.td}>Keep review queues correct</Text>
        </View>
        <View style={styles.tr}>
          <Text style={styles.td}>Weekly XP (a number, and a week key)</Text>
          <Text style={styles.td}>weekly_xp</Text>
          <Text style={styles.td}>Your rank on the weekly board</Text>
        </View>
      </View>
      <Text style={styles.p}>
        The weekly board is privacy-first by design: you see your own rank and the number of
        participants — never another learner’s identity, and they never see yours. Reports you file
        (“this sounds wrong”) are queued with your user id so reviewers can follow up; they are
        never shown to other learners.
      </Text>

      <Text style={styles.h2}>Microphone audio</Text>
      <View style={styles.ul}>
        <Text style={styles.li}>• Pronunciation scoring happens on your device.</Text>
        <Text style={styles.li}>
          • Optional cloud speech-to-text (only if an OpenAI-compatible endpoint is configured)
          receives the audio for transcription only; the audio is discarded immediately and only the
          transcribed phrase is kept as practice content.
        </Text>
        <Text style={styles.li}>
          • With no STT configured, audio never leaves the device — and the app says so instead of
          pretending otherwise.
        </Text>
      </View>

      <Text style={styles.h2}>AI tutor content</Text>
      <Text style={styles.p}>
        Tutor replies come from whichever AI endpoint is configured (or from the built-in demo
        responses when none is). Conversation text is sent to that endpoint to generate the reply; it
        is not stored by Nativa. Every AI-generated item that could reach the curriculum passes the
        human approval gate before publication — AI never publishes itself.
      </Text>

      <Text style={styles.h2}>Children</Text>
      <Text style={styles.p}>
        Nativa is general-audience (12+). It is not directed at children under 13 and does not
        knowingly collect their data. No ads, no tracking, no behavioral profiling — for anyone, of
        any age. See docs/STORE_COMPLIANCE.md.
      </Text>

      <Text style={styles.h2}>Your rights</Text>
      <View style={styles.ul}>
        <Text style={styles.li}>
          • Export everything the app knows about you: Profile → PRIVACY → Export my data (JSON via
          the system share sheet).
        </Text>
        <Text style={styles.li}>
          • Delete everything: Profile → PRIVACY → Delete account — wipes the device and calls
          DELETE /api/me, which erases your rows from app_state, weekly_xp, and learner_reports, and
          (when configured) removes the auth user itself.
        </Text>
        <Text style={styles.li}>• No cookie banners, because there is nothing to consent to.</Text>
      </View>

      <Text style={styles.h2}>Operators & subprocessors</Text>
      <View style={styles.table}>
        <View style={styles.tr}>
          <Text style={styles.th}>Service</Text>
          <Text style={styles.th}>Role</Text>
          <Text style={styles.th}>Data</Text>
        </View>
        <View style={styles.tr}>
          <Text style={styles.td}>Neon (Lakebase Postgres + Managed Auth + Functions)</Text>
          <Text style={styles.td}>App backend</Text>
          <Text style={styles.td}>Account id/email, progress, vocab, weekly XP, reports</Text>
        </View>
        <View style={styles.tr}>
          <Text style={styles.td}>OpenAI-compatible endpoint (optional, configurable)</Text>
          <Text style={styles.td}>STT + tutor</Text>
          <Text style={styles.td}>Audio (transient, STT only), conversation text</Text>
        </View>
      </View>
      <Text style={styles.p}>That’s the whole list. Nothing else touches your data.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  meta: { color: '#666', fontSize: 12 },
  h2: { fontSize: 16, fontWeight: '600', marginTop: 8 },
  p: { lineHeight: 20 },
  ul: { gap: 6 },
  li: { lineHeight: 20 },
  table: { borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 8, overflow: 'hidden' },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  th: { flex: 1, fontWeight: '600', padding: 8, backgroundColor: '#f5f5f5' },
  td: { flex: 1, padding: 8 },
});
