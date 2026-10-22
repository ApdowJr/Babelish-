import { Tabs } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useWindowDimensions, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, shadows, type Palette } from '@/theme/tokens';
import { useTheme, useThemedStyles } from '@/theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, color, focused }: { name: IconName; color: ColorValue; focused: boolean }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const tint = (color ?? colors.textFaint) as string;
  return (
    <View style={styles.iconWrap}>
      <Ionicons
        name={focused ? (name.replace('-outline', '') as IconName) : name}
        size={22}
        color={tint}
      />
      {focused ? <View style={[styles.dot, { backgroundColor: tint }]} /> : null}
    </View>
  );
}

/** The centre action: a raised gradient orb that reads as "talk to someone". */
function SpeakIcon({ focused }: { focused: boolean }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <LinearGradient
      // The orb keeps the brand gradient in both themes; only its ring reacts
      // to focus. Using the gradient tokens keeps it in brand sync.
      colors={
        focused
          ? [colors.gradientFrom, colors.gradientTo]
          : [colors.gradientMid, colors.gradientTo]
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.orb, focused && styles.orbFocused]}
    >
      <Ionicons name="mic" size={21} color={colors.onDark} />
    </LinearGradient>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Full-width on phones, a centred floating pill on wide screens.
  const barWidth = Math.min(width - 28, 560);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          left: '50%',
          marginLeft: -barWidth / 2,
          width: barWidth,
          bottom: Math.max(insets.bottom, 10),
          height: 68,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radii.lg,
          ...shadows.floating,
        },
        tabBarItemStyle: { paddingVertical: 0 },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.2,
          marginTop: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="compass-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="speak"
        options={{
          title: 'Speak',
          tabBarIcon: ({ focused }) => <SpeakIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="words"
        options={{
          title: 'Words',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="library-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person-outline" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center', height: 26, gap: 3 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  orb: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -6,
    borderWidth: 2,
    borderColor: c.surface,
    shadowColor: c.primary,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  orbFocused: { borderColor: c.sun },
});
