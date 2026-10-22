import { View } from 'react-native';
import { colors } from '@/theme/tokens';

/**
 * The Babelish mark: two speech bubbles — a large answering bubble with a
 * written line in it, and a smaller tangerine reply.
 *
 * This is the same drawing as `scripts/brand/generate-icons.py`, rebuilt from
 * plain views so it stays crisp at every size and needs no image asset. Keep
 * the two in sync: icon, splash and in-app mark should look like one brand.
 *
 * `tone` describes what the mark sits *on*, not the mark itself:
 *   'light' → dark surface, so the big bubble is parchment
 *   'dark'  → light surface, so the big bubble is forest ink
 */
export function BrandMark({
  size = 28,
  tone = 'dark',
}: {
  size?: number;
  tone?: 'dark' | 'light';
}) {
  const onDark = tone === 'light';
  const ink = onDark ? colors.onDark : colors.primary;
  const barColour = onDark ? colors.primary : colors.onDark;
  // Below ~24 px the written line turns to mush; the silhouette carries it.
  const showLines = size >= 24;

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Tail first, then the body over it — the seam stays inside the bubble. */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.16,
          top: size * 0.56,
          width: size * 0.2,
          height: size * 0.2,
          backgroundColor: ink,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: size * 0.16,
          width: size * 0.68,
          height: size * 0.52,
          borderRadius: size * 0.17,
          backgroundColor: ink,
        }}
      />
      {showLines ? (
        <>
          <View
            style={{
              position: 'absolute',
              left: size * 0.13,
              top: size * 0.3,
              width: size * 0.4,
              height: size * 0.06,
              borderRadius: size * 0.03,
              backgroundColor: barColour,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: size * 0.13,
              top: size * 0.42,
              width: size * 0.26,
              height: size * 0.06,
              borderRadius: size * 0.03,
              backgroundColor: colors.accent,
            }}
          />
        </>
      ) : null}
      <View
        style={{
          position: 'absolute',
          right: 0,
          bottom: size * 0.06,
          width: size * 0.44,
          height: size * 0.38,
          borderRadius: size * 0.13,
          backgroundColor: colors.accent,
        }}
      />
    </View>
  );
}
