/**
 * Crash boundary.
 *
 * React unmounts the whole tree when a render throws. Without this, a single
 * bad screen takes the app to a blank page — on web it looks like the site is
 * down, and on Android it closes the tab. The boundary keeps the failure local:
 * a readable screen, Retry (remount), and a way back to Learn.
 *
 * It never touches storage, auth or progress: those live outside the render
 * tree and stay exactly as they were. Copy is in `@/lib/errors` (pure/tested).
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { describeCrash } from '@/lib/errors';
import { radii, spacing, typography, type Palette } from '@/theme/tokens';
import { useTheme, useThemedStyles } from '@/theme/theme';

type Props = {
  children: ReactNode;
  /** Provided by Expo Router's route-level boundary; optional in-app. */
  onRetry?: () => void;
  onHome?: () => void;
};

type State = { error: Error | null };

export function CrashScreen({
  error,
  onRetry,
  onHome,
}: {
  error: unknown;
  onRetry: () => void;
  onHome?: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const copy = describeCrash(error);
  return (
    <View
      style={styles.wrap}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      testID="crash-screen"
    >
      <View style={styles.icon}>
        <Ionicons name="alert-circle-outline" size={28} color={colors.warning} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {copy.title}
      </Text>
      <Text style={styles.body}>{copy.body}</Text>
      {copy.detail ? (
        <ScrollView style={styles.detailBox} contentContainerStyle={styles.detailInner}>
          <Text style={styles.detail} numberOfLines={3}>
            {copy.detail}
          </Text>
        </ScrollView>
      ) : null}
      <View style={styles.actions}>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry this screen"
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.primaryLabel}>Try again</Text>
        </Pressable>
        {onHome ? (
          <Pressable
            onPress={onHome}
            accessibilityRole="button"
            accessibilityLabel="Go back to Learn"
            style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.secondaryLabel}>Back to Learn</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Message only — never the component props or anything the learner typed.
    if (__DEV__) {
      console.warn('[babelish] screen crashed:', error.message, info.componentStack?.split('\n')[1] ?? '');
    }
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <CrashScreen
        error={this.state.error}
        onRetry={() => {
          this.retry();
          this.props.onRetry?.();
        }}
        onHome={
          this.props.onHome
            ? () => {
                // Leave the broken screen first, then clear the error state so
                // the boundary is ready for the next render.
                this.props.onHome?.();
                this.retry();
              }
            : undefined
        }
      />
    );
  }
}

const createStyles = (c: Palette) => StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...typography.title, color: c.text, textAlign: 'center' },
  body: {
    ...typography.body,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 420,
  },
  detailBox: {
    maxHeight: 64,
    maxWidth: 420,
    width: '100%',
    backgroundColor: c.surfaceHigh,
    borderRadius: radii.sm,
    marginTop: spacing.xs,
  },
  detailInner: { padding: spacing.sm },
  detail: { ...typography.micro, color: c.textMuted },
  actions: { marginTop: spacing.md, gap: spacing.sm, alignItems: 'center' },
  primary: {
    backgroundColor: c.primary,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
  },
  primaryLabel: { ...typography.bodyStrong, color: c.white },
  secondary: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  secondaryLabel: { ...typography.body, color: c.primary },
});
