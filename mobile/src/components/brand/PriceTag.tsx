import React from 'react'
import { StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { formatINR, type Paise } from '@/domain/money'
import { auctionPhase, decayProgress } from '@/domain/pricing'
import { formatDuration } from '@/lib/format'
import { colors, fonts, radii } from '@/theme/tokens'

interface PriceTagProps {
  currentPaise: Paise
  startPaise: Paise
  floorPaise: Paise
  listedAt: string | Date
  departureAt: string | Date | null
  now: number
  size?: 'card' | 'detail'
  style?: ViewStyle
}

/**
 * The hang-tag: RIO's signature price display with the punched hole on the left
 * edge, starting price strikethrough, seller floor, and decay progress rail.
 */
export function PriceTag({
  currentPaise,
  startPaise,
  floorPaise,
  listedAt,
  departureAt,
  now,
  size = 'card',
  style,
}: PriceTagProps) {
  const dep = departureAt ? new Date(departureAt).getTime() : null
  const phase = auctionPhase({ departureAt: dep }, now)
  const dropped = currentPaise < startPaise
  const atFloor = currentPaise === floorPaise && dep !== null
  const big = size === 'detail'
  const progress = dep !== null ? decayProgress({ startPaise, floorPaise, listedAt: new Date(listedAt), departureAt: dep }, now) : 0
  const remaining = dep !== null ? dep - now : 0
  const railLabel =
    phase === 'departed'
      ? 'Owner has left'
      : phase === 'final_hour'
        ? 'Final hour: staff pickup'
        : `Owner leaves in ${formatDuration(remaining)}`

  return (
    <View
      style={[styles.tag, big && styles.tagBig, style]}
      accessibilityLabel={`Current price ${formatINR(currentPaise)}. Started at ${formatINR(startPaise)}; floor ${formatINR(floorPaise)}.`}
    >
      <View style={styles.hole} />
      <View style={styles.priceRow}>
        <Text style={[styles.current, big && styles.currentBig]}>{formatINR(currentPaise)}</Text>
        {dropped && <Text style={styles.struck}>{formatINR(startPaise)}</Text>}
      </View>
      <View style={styles.floorRow}>
        <Text style={[styles.floorMuted, big && styles.floorBig]}>
          Floor <Text style={styles.floorValue}>{formatINR(floorPaise)}</Text>
        </Text>
        {atFloor && <Text style={[styles.atFloor, big && styles.floorBig]}>At floor</Text>}
      </View>
      {dep !== null && (
        <View style={[styles.railWrap, big && styles.railWrapBig]}>
          <View style={styles.railTrack}>
            <View style={[styles.railFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={[styles.railLabel, big && styles.railLabelBig]}>{railLabel}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  tag: {
    position: 'relative',
    backgroundColor: colors.chalk,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.tag,
    paddingVertical: 10,
    paddingRight: 12,
    paddingLeft: 24,
  },
  tagBig: {
    paddingVertical: 14,
    paddingRight: 16,
    paddingLeft: 28,
  },
  hole: {
    position: 'absolute',
    left: 8,
    top: '50%',
    width: 8,
    height: 8,
    marginTop: -4,
    borderRadius: 999,
    backgroundColor: colors.stone,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  current: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 23,
    lineHeight: 27,
    letterSpacing: -0.4,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  currentBig: {
    fontSize: 34,
    lineHeight: 39,
  },
  struck: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.muted,
    textDecorationLine: 'line-through',
    textDecorationColor: colors.clay,
    fontVariant: ['tabular-nums'],
  },
  floorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 3,
  },
  floorMuted: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
  },
  floorBig: {
    fontSize: 13,
  },
  floorValue: {
    fontFamily: fonts.sansMedium,
    color: colors.ink,
  },
  atFloor: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.clay,
  },
  railWrap: {
    marginTop: 8,
    gap: 4,
  },
  railWrapBig: {
    marginTop: 10,
    gap: 6,
  },
  railTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  railFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.clay,
  },
  railLabel: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.muted,
  },
  railLabelBig: {
    fontSize: 13,
  },
})
