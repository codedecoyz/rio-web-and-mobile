import React from 'react'
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from 'lucide-react-native'
import { colors, fonts, radii } from '@/theme/tokens'
import { Button } from './Button'

type NoticeTone = 'info' | 'success' | 'warning' | 'error'

const TONES: Record<NoticeTone, { container: ViewStyle; color: string; Icon: LucideIcon }> = {
  info: {
    container: { backgroundColor: colors.chalk, borderColor: colors.line },
    color: colors.ink,
    Icon: Info,
  },
  success: {
    container: { backgroundColor: colors.forestTint, borderColor: colors.forestBorder },
    color: colors.forestStrong,
    Icon: CheckCircle2,
  },
  warning: {
    container: { backgroundColor: colors.amberTint, borderColor: colors.amberBorder },
    color: colors.amber,
    Icon: AlertTriangle,
  },
  error: {
    container: { backgroundColor: colors.dangerTint, borderColor: colors.dangerBorder },
    color: colors.danger,
    Icon: XCircle,
  },
}

export function Notice({
  tone = 'info',
  title,
  children,
  style,
}: {
  tone?: NoticeTone
  title: string
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const { container, color, Icon } = TONES[tone]
  return (
    <View style={[styles.notice, container, style]} accessibilityRole={tone === 'error' ? 'alert' : 'text'}>
      <Icon size={17} color={color} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.noticeTitle, { color }]}>{title}</Text>
        {children ? (
          typeof children === 'string' ? (
            <Text style={[styles.noticeBody, { color }]}>{children}</Text>
          ) : (
            children
          )
        ) : null}
      </View>
    </View>
  )
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function EmptyState({
  title,
  message,
  icon,
  actionLabel,
  onAction,
  style,
}: {
  title: string
  message?: string
  icon?: React.ReactNode
  actionLabel?: string
  onAction?: () => void
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.empty, style]}>
      {icon ? <View style={styles.emptyIcon}>{icon}</View> : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: 18 }}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  )
}

export function Skeleton({ height = 80, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.skeleton, { height }, style]} />
}

export function ConfirmModal({
  visible,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
  children,
}: {
  visible: boolean
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'primary' | 'clay' | 'danger'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: React.ReactNode
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={loading ? undefined : onCancel}>
        <Pressable style={styles.dialog} onPress={() => {}}>
          <Text style={styles.dialogTitle}>{title}</Text>
          {body ? <Text style={styles.dialogBody}>{body}</Text> : null}
          {children}
          <View style={styles.dialogActions}>
            <Button label={cancelLabel} variant="ghost" onPress={onCancel} disabled={loading} />
            <Button label={confirmLabel} variant={variant} onPress={onConfirm} loading={loading} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderRadius: radii.media,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    lineHeight: 20,
  },
  noticeBody: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.chalk,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.card,
    padding: 16,
  },
  empty: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    backgroundColor: 'rgba(250, 248, 243, 0.7)',
    paddingHorizontal: 24,
    paddingVertical: 36,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.forestTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 20,
    color: colors.ink,
    textAlign: 'center',
  },
  emptyMessage: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 320,
  },
  skeleton: {
    backgroundColor: 'rgba(217, 211, 197, 0.65)',
    borderRadius: radii.card,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(27, 36, 32, 0.48)',
    justifyContent: 'center',
    padding: 20,
  },
  dialog: {
    backgroundColor: colors.chalk,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.card,
    padding: 20,
    gap: 12,
  },
  dialogTitle: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 21,
    color: colors.ink,
  },
  dialogBody: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
})
