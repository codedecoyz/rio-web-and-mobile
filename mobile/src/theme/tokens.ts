import type { TextStyle } from 'react-native'

/**
 * Exact RIO design tokens mirrored 1:1 from `web/src/app/globals.css`.
 */
export const colors = {
  stone: '#eeebe3',
  chalk: '#faf8f3',
  line: '#d9d3c5',
  lineStrong: '#857d6c',
  ink: '#1b2420',
  muted: '#545e57',
  forest: '#1f4033',
  forestStrong: '#142b22',
  forestTint: '#dde6dd',
  forestBorder: 'rgba(31, 64, 51, 0.2)',
  clay: '#9e4a2c',
  clayStrong: '#843d24',
  clayTint: '#f3e0d5',
  clayBorder: 'rgba(158, 74, 44, 0.25)',
  amber: '#7a5000',
  amberTint: '#f5e6c3',
  amberBorder: 'rgba(122, 80, 0, 0.25)',
  danger: '#a3271f',
  dangerTint: '#f7dbd7',
  dangerBorder: 'rgba(163, 39, 31, 0.25)',
} as const

export const radii = {
  tag: 4,
  media: 8,
  card: 12,
  pill: 9999,
} as const

export const fonts = {
  sansRegular: 'InstrumentSans_400Regular',
  sansMedium: 'InstrumentSans_500Medium',
  sansSemiBold: 'InstrumentSans_600SemiBold',
  sansBold: 'InstrumentSans_700Bold',
  displayRegular: 'BricolageGrotesque_400Regular',
  displayMedium: 'BricolageGrotesque_500Medium',
  displaySemiBold: 'BricolageGrotesque_600SemiBold',
  displayBold: 'BricolageGrotesque_700Bold',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

export const textStyles: Record<string, TextStyle> = {
  hero: {
    fontFamily: fonts.displayBold,
    fontSize: 34,
    lineHeight: 37,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  h1: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  h2: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  h3: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    lineHeight: 23,
    color: colors.ink,
  },
  bodyMuted: {
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  caption: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
}
