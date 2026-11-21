import React from 'react'
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Hourglass,
  Leaf,
  Lock,
  PackageCheck,
  ShieldAlert,
  Undo2,
  Users,
  type LucideIcon,
} from 'lucide-react-native'
import type { Urgency } from '@/domain/pricing'
import { STATUS_LABELS } from '@/domain/stateMachine'
import { colors, fonts, radii } from '@/theme/tokens'

export type BadgeTone = 'neutral' | 'forest' | 'clay' | 'amber' | 'danger'

const TONE_MAP: Record<BadgeTone, { container: ViewStyle; text: TextStyle; iconColor: string }> = {
  neutral: {
    container: { backgroundColor: colors.stone, borderColor: colors.line },
    text: { color: colors.ink },
    iconColor: colors.ink,
  },
  forest: {
    container: { backgroundColor: colors.forestTint, borderColor: colors.forestBorder },
    text: { color: colors.forestStrong },
    iconColor: colors.forestStrong,
  },
  clay: {
    container: { backgroundColor: colors.clayTint, borderColor: colors.clayBorder },
    text: { color: colors.clay },
    iconColor: colors.clay,
  },
  amber: {
    container: { backgroundColor: colors.amberTint, borderColor: colors.amberBorder },
    text: { color: colors.amber },
    iconColor: colors.amber,
  },
  danger: {
    container: { backgroundColor: colors.dangerTint, borderColor: colors.dangerBorder },
    text: { color: colors.danger },
    iconColor: colors.danger,
  },
}

export function Badge({
  tone = 'neutral',
  Icon,
  children,
  style,
}: {
  tone?: BadgeTone
  Icon?: LucideIcon
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const t = TONE_MAP[tone]
  return (
    <View style={[styles.badge, t.container, style]}>
      {Icon ? <Icon size={13} color={t.iconColor} strokeWidth={2.2} /> : null}
      <Text style={[styles.text, t.text]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  )
}

const STATUS_TONE: Record<string, { tone: BadgeTone; Icon: LucideIcon }> = {
  ACTIVE: { tone: 'forest', Icon: Leaf },
  RESERVED: { tone: 'amber', Icon: Lock },
  RENTED: { tone: 'amber', Icon: Clock },
  SOLD: { tone: 'neutral', Icon: PackageCheck },
  STAFF_PENDING: { tone: 'clay', Icon: Users },
  STAFF_CUSTODY: { tone: 'neutral', Icon: Users },
  WITHDRAWN: { tone: 'neutral', Icon: Undo2 },
  DISPUTED: { tone: 'danger', Icon: ShieldAlert },
  PENDING_HANDOVER: { tone: 'amber', Icon: Hourglass },
  COMPLETED: { tone: 'forest', Icon: CheckCircle2 },
  CANCELLED: { tone: 'neutral', Icon: Undo2 },
  REFUNDED: { tone: 'neutral', Icon: Undo2 },
  PENDING_PICKUP: { tone: 'amber', Icon: Hourglass },
  RETURNED: { tone: 'forest', Icon: CheckCircle2 },
  CONVERTED: { tone: 'forest', Icon: PackageCheck },
  OPEN: { tone: 'danger', Icon: AlertTriangle },
  RESOLVED_REFUND: { tone: 'neutral', Icon: CheckCircle2 },
  RESOLVED_RELEASE: { tone: 'neutral', Icon: CheckCircle2 },
  RESOLVED_DAMAGE: { tone: 'neutral', Icon: CheckCircle2 },
  PENDING: { tone: 'amber', Icon: Hourglass },
  ACCEPTED: { tone: 'forest', Icon: CheckCircle2 },
}

export function StatusBadge({ status, style }: { status: string; style?: StyleProp<ViewStyle> }) {
  const meta = STATUS_TONE[status] ?? { tone: 'neutral' as BadgeTone, Icon: Clock }
  const label = STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status
  return (
    <Badge tone={meta.tone} Icon={meta.Icon} style={style}>
      {label}
    </Badge>
  )
}

const URGENCY: Record<Urgency, { tone: BadgeTone; label: string }> = {
  KEEPER: { tone: 'neutral', label: 'Fixed price' },
  FRESH: { tone: 'forest', label: 'More than 2 days left' },
  DROPPING: { tone: 'amber', label: 'Leaving within 2 days' },
  CRITICAL: { tone: 'clay', label: 'Under 3 hours left' },
  FINAL_HOUR: { tone: 'danger', label: 'Final hour' },
  DEPARTED: { tone: 'neutral', label: 'Owner departed' },
}

export function UrgencyBadge({ urgency, style }: { urgency: Urgency; style?: StyleProp<ViewStyle> }) {
  const u = URGENCY[urgency]
  return (
    <Badge tone={u.tone} Icon={Clock} style={style}>
      {u.label}
    </Badge>
  )
}

export function SandboxBadge({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <Badge tone="amber" style={style}>
      Sandbox money
    </Badge>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  text: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    lineHeight: 16,
  },
})
