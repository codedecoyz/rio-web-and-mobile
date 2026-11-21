import React from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'
import Svg, { Circle, G, Path, Rect } from 'react-native-svg'
import { colors } from '@/theme/tokens'

function CategoryGlyph({ slug }: { slug: string }) {
  switch (slug) {
    case 'air-cooler':
      return (
        <>
          <Rect x={38} y={14} width={44} height={62} rx={6} />
          <Path d="M46 24h28M46 30h28M46 36h28M46 42h28" />
          <Circle cx={60} cy={58} r={9} />
          <Path d="M60 49v18M51 58h18" />
          <Path d="M42 76v4M78 76v4" />
        </>
      )
    case 'foam-mattress':
      return (
        <>
          <Path d="M18 50l20-14h64l-20 14z" />
          <Path d="M18 50v12h64V50M82 62l20-14V36" />
          <Path d="M30 46h14M58 46h14" />
        </>
      )
    case 'kettle-immersion':
      return (
        <>
          <Path d="M44 34h30l4 40H40z" />
          <Path d="M74 42c10 0 12 14 2 18" />
          <Path d="M44 34l-10-8" />
          <Path d="M52 34v-6h14v6" />
          <Path d="M38 78h42" />
        </>
      )
    case 'drafter-board':
      return (
        <>
          <Rect x={22} y={20} width={76} height={52} rx={3} />
          <Path d="M34 62l30-30M64 32l10 10M34 62l12 0" />
          <Circle cx={64} cy={32} r={3} />
        </>
      )
    case 'study-table-chair':
      return (
        <>
          <Path d="M18 40h56M24 40v36M68 40v36" />
          <Path d="M30 40v-12h22v12" />
          <Path d="M86 20v34h18M86 54v22M104 54v22M86 40h18" />
        </>
      )
    default:
      return (
        <>
          <Path d="M30 34l30-14 30 14v32l-30 14-30-14z" />
          <Path d="M30 34l30 14 30-14M60 48v32" />
        </>
      )
  }
}

export function CategoryArt({
  slug,
  label,
  style,
}: {
  slug: string
  label: string
  style?: ViewStyle
}) {
  return (
    <View style={[styles.container, style]} accessibilityRole="image" accessibilityLabel={`Illustration: ${label} (no photo yet)`}>
      <Svg viewBox="0 0 120 92" width="60%" height="60%">
        <G fill="none" stroke={colors.forest} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <CategoryGlyph slug={slug} />
        </G>
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.forestTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
