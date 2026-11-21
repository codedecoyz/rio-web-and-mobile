import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import { colors, fonts, radii } from '@/theme/tokens'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'clay'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps {
  label: string
  onPress?: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  icon?: React.ReactNode
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading
  const v = variantStyles[variant]
  const s = sizeStyles[size]

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        v.container,
        s.container,
        pressed && !isDisabled && v.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={v.spinnerColor} /> : icon}
      <Text style={[styles.label, v.label, s.label, textStyle]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.media,
  },
  label: {
    fontFamily: fonts.sansMedium,
  },
  disabled: {
    opacity: 0.58,
  },
})

const variantStyles: Record<
  ButtonVariant,
  { container: ViewStyle; pressed: ViewStyle; label: TextStyle; spinnerColor: string }
> = {
  primary: {
    container: { backgroundColor: colors.forest },
    pressed: { backgroundColor: colors.forestStrong },
    label: { color: colors.chalk },
    spinnerColor: colors.chalk,
  },
  secondary: {
    container: { backgroundColor: colors.chalk, borderWidth: 1, borderColor: colors.lineStrong },
    pressed: { backgroundColor: colors.stone },
    label: { color: colors.ink },
    spinnerColor: colors.ink,
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    pressed: { backgroundColor: colors.forestTint },
    label: { color: colors.forest },
    spinnerColor: colors.forest,
  },
  danger: {
    container: { backgroundColor: colors.chalk, borderWidth: 1, borderColor: colors.danger },
    pressed: { backgroundColor: colors.dangerTint },
    label: { color: colors.danger },
    spinnerColor: colors.danger,
  },
  clay: {
    container: { backgroundColor: colors.clay },
    pressed: { backgroundColor: colors.clayStrong },
    label: { color: colors.chalk },
    spinnerColor: colors.chalk,
  },
}

const sizeStyles: Record<ButtonSize, { container: ViewStyle; label: TextStyle }> = {
  sm: {
    container: { minHeight: 38, paddingHorizontal: 12 },
    label: { fontSize: 13 },
  },
  md: {
    container: { minHeight: 44, paddingHorizontal: 16 },
    label: { fontSize: 15 },
  },
  lg: {
    container: { minHeight: 48, paddingHorizontal: 22 },
    label: { fontSize: 16 },
  },
}
