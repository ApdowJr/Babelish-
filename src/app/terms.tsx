import { useThemedStyles } from '@/theme/theme';
import type { Palette } from '@/theme/tokens';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * Terms of Service — the counterpart to /privacy, written in the same plain
 * voice. Play Console and the App Store both require a reachable terms page,
 * and a listing that links only a privacy policy is a common rejection.
 *
 * Keep this accurate: it describes what the code actually does (device-local
 * practice data, progress-only sync, no ads, no sale of data, user-requested
 * deletion). If a feature changes, change this file in the same commit.
 */
export default function TermsRoute() {
  const styles = useThemedStyles(createStyles);
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Babelish — Terms of Service</Text>
      <Text style={styles.meta}>Last updated: 2026-10-23 · applies to Babelish 3.4 and later</Text>

      <Text style={styles.h2}>The short version</Text>
      <Text style={styles.p}>
        Babelish is a free language-learning app. Use it, learn, and don’t abuse it. Your practice
        data stays on your device; only progress and vocabulary sync to your own account. You can
        delete your account and everything in it at any time.
      </Text>

      <Text style={styles.h2}>Your account</Text>
      <Text style={styles.p}>
        You may use Babelish without an account in demo mode, or create one to sync progress across
        devices. Keep your credentials private — you are responsible for activity under your
        account. You must be old enough to consent to data processing where you live (13+ in most
        places, 16+ in some).
      </Text>

      <Text style={styles.h2}>Acceptable use</Text>
      <View style={styles.ul}>
        <Text style={styles.li}>• Don’t attempt to overload, scrape or reverse the AI endpoints.</Text>
        <Text style={styles.li}>
          • Don’t use the tutor to generate illegal content, or to harass another person.
        </Text>
        <Text style={styles.li}>
          • Don’t try to bypass the daily limits; they exist so a free service stays free for
          everyone.
        </Text>
        <Text style={styles.li}>• Don’t upload content you have no right to share.</Text>
      </View>

      <Text style={styles.h2}>The AI tutor is a learning aid</Text>
      <Text style={styles.p}>
        Tutor replies come from open-weight language models, run on our server or on your device.
        They can be wrong, incomplete or oddly phrased. Nothing the tutor says is professional
        advice — not medical, legal, financial or safety advice. Babelish never fakes a
        pronunciation score: when there is no transcript to compare against, the app says so.
      </Text>

      <Text style={styles.h2}>Free service, honest limits</Text>
      <Text style={styles.p}>
        Babelish is free and has no ads. Tutor messages and voice transcriptions have daily limits,
        shown in the app when you reach them; lessons, review and the phrasebook keep working
        without them. We may change limits or features, and we try to say so in the changelog
        rather than silently.
      </Text>

      <Text style={styles.h2}>Your content, our software</Text>
      <Text style={styles.p}>
        What you write and record stays yours. You give us only the permission needed to transcribe
        your speech and answer your messages while you use the app. The Babelish name, mark and
        source code belong to their authors and are provided under the licence in the repository
        (see LICENSE).
      </Text>

      <Text style={styles.h2}>Availability and liability</Text>
      <Text style={styles.p}>
        The app is provided “as is”. We do not promise that the tutor server will always be
        reachable, or that a model will always answer. To the extent the law allows, we are not
        liable for indirect or consequential loss arising from use of the app. Nothing here limits
        rights you have under mandatory consumer law.
      </Text>

      <Text style={styles.h2}>Ending it</Text>
      <Text style={styles.p}>
        You can stop using Babelish at any time, and delete your account in Settings → Danger
        zone. We may suspend an account that abuses the service, and we will tell you why.
      </Text>

      <Text style={styles.h2}>Privacy</Text>
      <Text style={styles.p}>
        What is stored, what syncs and what never leaves the device is described in the privacy
        policy (Settings → Privacy policy). It is part of these terms.
      </Text>

      <Text style={styles.h2}>Contact</Text>
      <Text style={styles.p}>
        Questions about these terms: support@zelvoca.app. We answer in English.
      </Text>
    </ScrollView>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 24, paddingBottom: 64, maxWidth: 760, alignSelf: 'center', width: '100%' },
  title: { fontSize: 26, fontWeight: '800', color: c.text, marginBottom: 4 },
  meta: { fontSize: 13, color: c.textMuted, marginBottom: 24 },
  h2: { fontSize: 17, fontWeight: '700', color: c.primary, marginTop: 24, marginBottom: 8 },
  p: { fontSize: 15, lineHeight: 24, color: c.text, marginBottom: 12 },
  ul: { marginBottom: 12, gap: 6 },
  li: { fontSize: 15, lineHeight: 23, color: c.text },
});
