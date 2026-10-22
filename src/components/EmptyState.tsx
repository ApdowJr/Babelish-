import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { colors, radii, spacing, typography } from '@/theme/tokens';

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  emoji?: string;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon, emoji, title, body, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        {emoji ? (
          <Text style={styles.emoji}>{emoji}</Text>
        ) : (
          <Ionicons name={icon ?? 'sparkles-outline'} size={26} color={colors.primary} />
        )}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceTint,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emoji: { fontSize: 26 },
  title: { ...typography.heading, color: colors.text, textAlign: 'center' },
  body: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: spacing.sm,
    maxWidth: 340,
  },
  action: { alignSelf: 'stretch', marginTop: spacing.lg },
});
