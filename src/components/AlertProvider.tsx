import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { subscribeAlerts, type AlertTask } from '@/lib/alert';
import { typography, spacing, radii, type Palette } from '@/theme/tokens';
import { useThemedStyles } from '@/theme/theme';

/**
 * Web renderer for `showAlert`. Native keeps using react-native's own Alert;
 * this provider only ever displays tasks dispatched on web (the platform
 * where RN's Alert is a no-op stub). Mounted once in the root layout.
 */
export function AlertProvider({ children }: { children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles);
  const [task, setTask] = useState<AlertTask | null>(null);

  useEffect(() => subscribeAlerts(setTask), []);

  if (!task) return <>{children}</>;

  const multi = task.buttons.length > 1;
  const dismiss = () => setTask(null);

  const onPress = (index: number) => {
    const button = task.buttons[index];
    setTask(null);
    // Fire after dismissal so confirm flows can navigate/alert again safely.
    setTimeout(() => button.onPress?.(), 0);
  };

  return (
    <View style={styles.root}>
      <View style={styles.content}>{children}</View>
      <Modal transparent visible animationType="fade" onRequestClose={dismiss}>
        <Pressable
          style={styles.backdrop}
          onPress={multi ? undefined : dismiss}
          accessibilityRole={multi ? undefined : 'button'}
        >
          <View style={styles.card} onStartShouldSetResponder={() => true}>
            <Text style={styles.title}>{task.title}</Text>
            {task.message ? <Text style={styles.message}>{task.message}</Text> : null}
            <View style={[styles.row, multi && styles.rowMulti]}>
              {task.buttons.map((b, i) => (
                <Pressable
                  key={`${b.text}-${i}`}
                  onPress={() => onPress(i)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.button,
                    b.style === 'destructive' && styles.buttonDanger,
                    b.style === 'cancel' && styles.buttonCancel,
                    multi && styles.buttonGrow,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.buttonLabel,
                      b.style === 'destructive' && styles.labelDanger,
                      b.style === 'cancel' && styles.labelCancel,
                    ]}
                  >
                    {b.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 420,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: c.border,
  },
  title: { ...typography.bodyStrong, color: c.text },
  message: { ...typography.body, color: c.textMuted, lineHeight: 22 },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  rowMulti: { flexDirection: 'row-reverse' },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    backgroundColor: c.primary,
  },
  buttonGrow: { flex: 1 },
  buttonCancel: { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border },
  buttonDanger: { backgroundColor: c.danger },
  buttonPressed: { opacity: 0.75 },
  buttonLabel: { ...typography.bodyStrong, color: c.white },
  labelDanger: { color: c.white },
  labelCancel: { color: c.text },
});
