import React, { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  ChevronDown,
  ClipboardList,
  Gavel,
  Heart,
  LogOut,
  Route,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react-native'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { formatINR } from '@/domain/money'
import { useAuth } from '@/lib/auth-context'
import { colors, fonts, radii } from '@/theme/tokens'

export function AppHeader() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { viewer, balance, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const go = (path: string) => {
    setMenuOpen(false)
    router.push(path as never)
  }

  return (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
      <View style={styles.inner}>
        <Pressable onPress={() => router.push('/(tabs)')} hitSlop={8}>
          <Logo size={26} />
        </Pressable>

        <View style={styles.right}>
          {viewer ? (
            <>
              {balance !== null && (
                <Pressable onPress={() => router.push('/(tabs)/activity')} style={styles.walletPill}>
                  <Text style={styles.walletAmount}>{formatINR(balance)}</Text>
                  <Text style={styles.walletTag}>sandbox</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setMenuOpen(true)} style={styles.avatarBtn} accessibilityLabel="Account menu">
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarLetter}>{viewer.fullName.slice(0, 1).toUpperCase()}</Text>
                </View>
                <Text style={styles.avatarName} numberOfLines={1}>
                  {viewer.fullName.split(' ')[0]}
                </Text>
                <ChevronDown size={15} color={colors.muted} />
              </Pressable>
            </>
          ) : (
            <View style={styles.guestBtns}>
              <Button label="Sign in" variant="ghost" size="sm" onPress={() => router.push('/auth/login')} />
              <Button label="Join" size="sm" onPress={() => router.push('/auth/signup')} />
            </View>
          )}
        </View>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={[styles.sheet, { marginTop: insets.top + 56 }]} onPress={() => {}}>
            {viewer ? (
              <>
                <View style={styles.sheetHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetName}>{viewer.fullName}</Text>
                    <Text style={styles.sheetMeta}>
                      {viewer.role.charAt(0).toUpperCase() + viewer.role.slice(1)}
                      {viewer.hostelName ? ` Â· ${viewer.hostelName}` : ''}
                    </Text>
                  </View>
                  <Pressable onPress={() => setMenuOpen(false)} hitSlop={8}>
                    <X size={20} color={colors.muted} />
                  </Pressable>
                </View>

                {balance !== null && (
                  <View style={styles.sheetBalance}>
                    <Text style={styles.sheetBalanceLabel}>Sandbox balance</Text>
                    <Text style={styles.sheetBalanceValue}>{formatINR(balance)}</Text>
                  </View>
                )}

                <MenuItem Icon={Heart} label="Saved items" onPress={() => go('/saved')} />
                <MenuItem Icon={Gavel} label="Disputes" onPress={() => go('/disputes')} />
                <MenuItem Icon={Settings} label="Account settings" onPress={() => go('/settings')} />
                <MenuItem Icon={Route} label="How RIO works" onPress={() => go('/how-it-works')} />

                {(viewer.role === 'warden' || viewer.role === 'admin') && (
                  <MenuItem Icon={ShieldCheck} label="Warden dashboard" onPress={() => go('/warden')} />
                )}
                {(viewer.role === 'staff' || viewer.role === 'warden' || viewer.role === 'admin') && (
                  <MenuItem Icon={Users} label="Staff custody" onPress={() => go('/staff')} />
                )}
                {viewer.role === 'admin' && (
                  <MenuItem Icon={ClipboardList} label="Roles & access" onPress={() => go('/admin/roles')} />
                )}

                <View style={styles.divider} />
                <MenuItem
                  Icon={LogOut}
                  label="Sign out"
                  tone="danger"
                  onPress={async () => {
                    setMenuOpen(false)
                    await signOut()
                    router.replace('/(tabs)')
                  }}
                />
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

function MenuItem({
  Icon,
  label,
  onPress,
  tone,
}: {
  Icon: typeof Heart
  label: string
  onPress: () => void
  tone?: 'danger'
}) {
  const color = tone === 'danger' ? colors.danger : colors.ink
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
      <Icon size={18} color={color} />
      <Text style={[styles.menuLabel, { color }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.stone,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.amberTint,
    borderWidth: 1,
    borderColor: colors.amberBorder,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    minHeight: 36,
  },
  walletAmount: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  walletTag: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.amber,
  },
  avatarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.chalk,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 10,
    minHeight: 38,
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.chalk,
  },
  avatarName: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.ink,
    maxWidth: 80,
  },
  guestBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(27, 36, 32, 0.35)',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
  },
  sheet: {
    width: 270,
    backgroundColor: colors.chalk,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 10,
    gap: 2,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  sheetName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.ink,
  },
  sheetMeta: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  sheetBalance: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.amberTint,
    borderRadius: radii.media,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  sheetBalanceLabel: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.amber,
  },
  sheetBalanceValue: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    minHeight: 42,
    borderRadius: radii.media,
  },
  menuItemPressed: {
    backgroundColor: colors.stone,
  },
  menuLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: 4,
  },
})
