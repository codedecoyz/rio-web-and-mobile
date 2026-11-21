import React, { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { ScanLine, ShieldAlert, Users } from 'lucide-react-native'
import { StatusBadge } from '@/components/ui/Badges'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, Notice, Skeleton } from '@/components/ui/Feedback'
import { useAuth } from '@/lib/auth-context'
import { getNames } from '@/lib/data/transactions'
import { getScopedHostels, getStaffTransfers, type ScopedStaffTransfer } from '@/lib/data/warden'
import { formatDateTime } from '@/lib/format'
import { colors, fonts, textStyles } from '@/theme/tokens'

export default function StaffScreen() {
  const router = useRouter()
  const { viewer } = useAuth()
  const [transfers, setTransfers] = useState<ScopedStaffTransfer[]>([])
  const [hostelName, setHostelName] = useState<Map<string, string>>(new Map())
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [hasHostels, setHasHostels] = useState(true)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!viewer || !['staff', 'warden', 'admin'].includes(viewer.role)) {
      setLoading(false)
      return
    }
    try {
      setError(null)
      const hostels = await getScopedHostels(viewer)
      setHasHostels(hostels.length > 0)
      setHostelName(new Map(hostels.map((h) => [h.id, h.name])))
      const tr = await getStaffTransfers(hostels.map((h) => h.id))
      setTransfers(tr)
      setNames(await getNames(tr.map((t) => t.owner_id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Staff queue couldnâ€™t be loaded.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [viewer])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  if (!viewer || !['staff', 'warden', 'admin'].includes(viewer.role)) {
    return (
      <View style={styles.gate}>
        <EmptyState icon={<ShieldAlert size={24} color={colors.clay} />} title="Restricted to campus staff and wardens" />
      </View>
    )
  }

  const pending = transfers.filter((t) => t.status === 'PENDING')
  const accepted = transfers.filter((t) => t.status === 'ACCEPTED')

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true)
            void load()
          }}
          tintColor={colors.forest}
        />
      }
    >
      <Text style={textStyles.h1}>Staff custody</Text>
      <Text style={textStyles.bodyMuted}>
        Unsold items routed to campus staff in their ownerâ€™s final hour. Accept each one by scanning the studentâ€™s custody code.
      </Text>

      <Button
        label="Scan custody code"
        icon={<ScanLine size={16} color={colors.chalk} />}
        onPress={() => router.push('/(tabs)/handover')}
      />

      {error ? <Notice tone="error" title={error} /> : null}

      {loading ? (
        <Skeleton height={200} />
      ) : transfers.length === 0 ? (
        <EmptyState
          icon={<Users size={24} color={colors.forest} />}
          title="Nothing waiting for staff"
          message={
            hasHostels
              ? 'When a warden routes an unsold item to staff, it appears here.'
              : 'You arenâ€™t assigned to a hostel yet. Ask a campus administrator.'
          }
        />
      ) : (
        <View style={{ gap: 20 }}>
          <View style={{ gap: 10 }}>
            <Text style={textStyles.h2}>Waiting for pickup ({pending.length})</Text>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {pending.length === 0 ? (
                <Text style={[textStyles.bodyMuted, { padding: 14 }]}>All routed items have been collected.</Text>
              ) : (
                pending.map((t, idx) => (
                  <View key={t.id} style={[styles.row, idx > 0 && styles.border]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.title}>{t.listing.title}</Text>
                      <Text style={textStyles.caption}>
                        From {names.get(t.owner_id) ?? 'resident'}, {hostelName.get(t.hostel_id) ?? ''}. Routed {formatDateTime(t.routed_at)}.
                      </Text>
                    </View>
                    <StatusBadge status={t.status} />
                  </View>
                ))
              )}
            </Card>
          </View>

          <View style={{ gap: 10 }}>
            <Text style={textStyles.h2}>In custody ({accepted.length})</Text>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {accepted.length === 0 ? (
                <Text style={[textStyles.bodyMuted, { padding: 14 }]}>Nothing accepted yet.</Text>
              ) : (
                accepted.map((t, idx) => (
                  <View key={t.id} style={[styles.row, idx > 0 && styles.border]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.title}>{t.listing.title}</Text>
                      <Text style={textStyles.caption}>{t.accepted_at ? `Accepted ${formatDateTime(t.accepted_at)}` : ''}</Text>
                    </View>
                    <StatusBadge status={t.status} />
                  </View>
                ))
              )}
            </Card>
          </View>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  container: {
    padding: 16,
    paddingBottom: 36,
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  border: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.ink,
  },
})
