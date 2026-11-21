import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import { Check } from 'lucide-react-native'
import { colors, fonts, radii } from '@/theme/tokens'

export function Field({
  label,
  hint,
  error,
  optional,
  children,
}: {
  label: string
  hint?: string
  error?: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {optional ? <Text style={styles.optional}> (optional)</Text> : null}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
      {error ? <Text style={styles.error}>! {error}</Text> : null}
    </View>
  )
}

export function TextInputField({ invalid, multiline, style, ...props }: TextInputProps & { invalid?: boolean }) {
  return (
    <TextInput
      placeholderTextColor="rgba(84, 94, 87, 0.72)"
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      style={[styles.input, multiline && styles.multiline, invalid && styles.inputInvalid, style]}
      {...props}
    />
  )
}

export interface ChipOption<T extends string> {
  value: T
  label: string
}

export function ChipSelect<T extends string>({
  options,
  value,
  onChange,
  scrollable = false,
}: {
  options: readonly ChipOption<T>[]
  value: T | undefined
  onChange: (next: T) => void
  scrollable?: boolean
}) {
  const content = options.map((opt) => {
    const active = opt.value === value
    return (
      <Pressable
        key={opt.value}
        onPress={() => onChange(opt.value)}
        style={[styles.chip, active ? styles.chipOn : styles.chipOff]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Text style={[styles.chipText, active ? styles.chipTextOn : styles.chipTextOff]}>{opt.label}</Text>
      </Pressable>
    )
  })

  if (scrollable) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {content}
      </ScrollView>
    )
  }

  return <View style={[styles.chipRow, styles.chipWrap]}>{content}</View>
}

export function CheckboxRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      style={styles.checkRow}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Check size={14} color={colors.chalk} strokeWidth={3} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.checkLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.ink,
  },
  optional: {
    fontFamily: fonts.sansRegular,
    color: colors.muted,
  },
  hint: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
  error: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.danger,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.chalk,
    borderRadius: radii.media,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontFamily: fonts.sansRegular,
    fontSize: 16,
    color: colors.ink,
  },
  multiline: {
    minHeight: 104,
  },
  inputInvalid: {
    borderColor: colors.danger,
    backgroundColor: 'rgba(247, 219, 215, 0.45)',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chipWrap: {
    flexWrap: 'wrap',
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  chipOff: {
    backgroundColor: colors.chalk,
    borderColor: colors.line,
  },
  chipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
  },
  chipTextOn: {
    color: colors.chalk,
  },
  chipTextOff: {
    color: colors.ink,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingVertical: 4,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    backgroundColor: colors.chalk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  checkLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.ink,
  },
})
