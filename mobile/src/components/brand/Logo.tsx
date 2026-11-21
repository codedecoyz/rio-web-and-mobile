import React from 'react'
import { StyleSheet, Text, View, type ViewStyle } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { colors, fonts } from '@/theme/tokens'

/** Wordmark: lowercase "rio" with a loop mark (an item staying in circulation). */
export function Logo({ size = 28, style }: { size?: number; style?: ViewStyle }) {
  return (
    <View style={[styles.row, style]} accessibilityRole="header" accessibilityLabel="rio">
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Circle
          cx={16}
          cy={16}
          r={11}
          fill="none"
          stroke={colors.forest}
          strokeWidth={3}
          strokeDasharray={[52, 17]}
          strokeLinecap="round"
        />
        <Path
          d="M24.5 6.5l1.2 6-5.8-1.6"
          fill="none"
          stroke={colors.clay}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <Text style={[styles.wordmark, { fontSize: Math.round(size * 0.86) }]}>rio</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordmark: {
    fontFamily: fonts.displayBold,
    color: colors.forest,
    letterSpacing: -0.5,
  },
})
