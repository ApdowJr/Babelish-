import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { layout, spacing, type Palette } from '@/theme/tokens';
import { useThemedStyles } from '@/theme/theme';

type Props = {
  children: ReactNode;
  /** Adds keyboard-avoiding scroll behavior — use for form screens. */
  scroll?: boolean;
  /** Remove the default horizontal padding (for edge-to-edge hero headers). */
  edgeToEdge?: boolean;
  /** Extra space at the bottom so content clears the floating tab bar. */
  tabBarSpace?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  scroll = false,
  edgeToEdge = false,
  tabBarSpace = false,
  style,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const contentStyle = [
    styles.scrollContent,
    edgeToEdge && styles.edgeToEdge,
    tabBarSpace && styles.tabBarSpace,
    style,
  ];

  if (scroll) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={contentStyle}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <View style={[styles.flex, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
  },
  edgeToEdge: { paddingHorizontal: 0, paddingTop: 0 },
  tabBarSpace: { paddingBottom: 112 },
});
