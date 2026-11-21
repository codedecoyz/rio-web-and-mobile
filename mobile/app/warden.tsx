import React, { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Leaf, ShieldAlert } from 'lucide-react-native'
import { Badge, StatusBadge } from '@/components/ui/Badges'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, Notice, Skeleton } from '@/components/ui/Feedback'
import { ChipSelect } from '@/components/ui/Field'
import { formatKg } from '@/domain/impact'
import { isStaffRoutable } from '@/domain/pricing'
import { useAuth } from '@/lib/auth-context'
import { getDisputes, type DisputeRow } from '@/lib/data/disputes'
import { getNames, reviewReport } from '@/lib/data/transactions'
import {
  getDepartureQueue,
  getImpact,
  getNoDues,
  getOpenReports,
  getScopedHostels,
  getStaffTransfers,
  routeToStaff,
  type Hostel,
  type NoDuesRow,
  type OpenReport,
  type QueueItem,
  type ScopedStaffTransfer,
} from '@/lib/data/warden'
import { formatDateTime, formatDuration } from '@/lib/format'
import { colors, fonts, radii, textStyles } from '@/theme/tokens'

const REPORT_REASON_LABELS: Record<string, string> = {
  misleading: 'Misleading photos or description',
  scam: 'Possible scam',
  prohibited: 'Not allowed in hostels',
  duplicate: 'Duplicate listing',
  offensive: 'Offensive content',
  other: 'Other',
}

export default function WardenScreen() {
  const router = useRouter()
  const { viewer } = useAuth()
  const [hostels, setHostels] = useState<Hostel[]>([])
  const [selectedHostelId, setSelectedHostelId] = useState<string>('')
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [transfers, setTransfers] = useState<ScopedStaffTransfer[]>([])
  const [disputes, setDisputes] = useState<DisputeRow[]>([])
  const [reports, setReports] = useState<OpenReport[]>([])
  const [noDues, setNoDues] = useState<NoDuesRow[]>([])
  const [impact, setImpact] = useState<Awaited<ReturnType<typeof getImpact>>>(null)
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!viewer || (viewer.role !== 'warden' && viewer.role !== 'admin')) {
      setLoading(false)
      return
    }
    try {
      setError(null)
      const hList = await getScopedHostels(viewer)
      setHostels(hList)
      if (!hList.length) {
        setLoading(false)
        setRefreshing(false)
        return
      }
      const activeId = hList.some((h) => h.id === selectedHostelId) ? selectedHostelId : hList[0].id
      if (activeId !== selectedHostelId) setSelectedHostelId(activeId)

      const now = Date.now()
      const [q, tr, d, imp, nd, rep] = await Promise.all([
        getDepartureQueue(activeId, now),
        getStaffTransfers([activeId]),
        getDisputes({ status: 'OPEN', hostelIds: [activeId] }),
        getImpact(activeId),
        getNoDues(activeId),
        getOpenReports([activeId]),
      ])
      setQueue(q)
      setTransfers(tr)
      setDisputes(d)
      setImpact(imp)
      setNoDues(nd)
      setReports(rep)
      setNames(await getNames([...q.map((x) => x.owner_id), ...tr.map((t) => t.owner_id)]))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Warden dashboard couldnâ€™t be loaded.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [viewer, selectedHostelId])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  if (!viewer || (viewer.role !== 'warden' && viewer.role !== 'admin')) {
    return (
      <View style={styles.gate}>
        <EmptyState
          icon={<ShieldAlert size={24} color={colors.clay} />}
          title="Restricted to hostel wardens"
          message="Your account doesnâ€™t have warden access."
        />
      </View>
    )
  }

  if (!loading && hostels.length === 0) {
    return (
      <View style={styles.gate}>
        <EmptyState
          title="No hostels assigned yet"
          message="Ask a campus administrator to assign you to a hostel. Youâ€™ll see its departures, disputes and staff queue here."
        />
      </View>
    )
  }

  const now = Date.now()
  const hostel = hostels.find((h) => h.id === selectedHostelId) ?? hostels[0]
  const routable = queue.filter((q) => isStaffRoutable(new Date(q.departure_at), now))
  const outstanding = noDues.filter((r) => !r.cleared)

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
      {hostel ? (
        <View>
          <Text style={textStyles.h1}>{hostel.name}</Text>
          <Text style={textStyles.bodyMuted}>{hostel.campus}. Warden overview.</Text>
        </View>
      ) : null}

      {hostels.length > 1 ? (
        <ChipSelect
          scrollable
          value={selectedHostelId}
          onChange={setSelectedHostelId}
          options={hostels.map((h) => ({ value: h.id, label: h.name }))}
        />
      ) : null}

      {notice ? <Notice tone="success" title={notice} /> : null}
      {error ? <Notice tone="error" title={error} /> : null}

      {loading ? (
        <Skeleton height={220} />
      ) : (
        <>
          <View style={styles.statsRow}>
            <Stat label="Ready for staff" value={String(routable.length)} clay={routable.length > 0} />
            <Stat label="Open disputes" value={String(disputes.length)} clay={disputes.length > 0} />
            <Stat label="Residents with dues" value={String(outstanding.length)} />
          </View>

          <View style={styles.impactCard}>
            <View style={styles.rowCenter}>
              <Leaf size={15} color={colors.forestStrong} />
              <Text style={styles.impactLabel}>Estimated impact</Text>
            </View>
            {impact ? (
              <>
                <Text style={styles.impactValue}>{formatKg(impact.co2eKg)} COâ‚‚e</Text>
                <Text style={styles.impactSub}>
                  {impact.itemsDiverted} items re-homed, {impact.rentalsCompleted} rentals. Estimates.
                </Text>
              </>
            ) : (
              <Text style={styles.impactSub}>Unavailable.</Text>
            )}
          </View>

          <Section title="Final hour: route to staff" subtitle="Unsold items whose owner leaves within the hour (or has left).">
            {routable.length === 0 ? (
              <Text style={textStyles.bodyMuted}>Nothing needs routing right now.</Text>
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {routable.map((q, idx) => (
                  <View key={q.id} style={[styles.row, idx > 0 && styles.border]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Pressable onPress={() => router.push({ pathname: '/items/[id]', params: { id: q.id } })}>
                        <Text style={styles.itemTitle}>{q.title}</Text>
                      </Pressable>
                      <Text style={textStyles.caption}>
                        {names.get(q.owner_id) ?? 'Resident'},{' '}
                        {new Date(q.departure_at).getTime() <= now
                          ? 'departed'
                          : `leaves in ${formatDuration(new Date(q.departure_at).getTime() - now)}`}
                      </Text>
                    </View>
                    <Button
                      label="Route to staff"
                      variant="clay"
                      size="sm"
                      loading={busyKey === `route-${q.id}`}
                      onPress={async () => {
                        setBusyKey(`route-${q.id}`)
                        try {
                          await routeToStaff(q.id)
                          setNotice('Routed to staff.')
                          await load()
                        } catch (e) {
                          setError(e instanceof Error ? e.message : 'Routing failed.')
                        } finally {
                          setBusyKey(null)
                        }
                      }}
                    />
                  </View>
                ))}
              </Card>
            )}
          </Section>

          <Section title="Reported listings" subtitle="Reporters stay anonymous to sellers.">
            {reports.length === 0 ? (
              <Text style={textStyles.bodyMuted}>No open reports.</Text>
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {reports.map((r, idx) => (
                  <View key={r.id} style={[styles.reportItem, idx > 0 && styles.border]}>
                    <Pressable onPress={() => router.push({ pathname: '/items/[id]', params: { id: r.listing.id } })}>
                      <Text style={styles.itemTitle}>{r.listing.title}</Text>
                    </Pressable>
                    <Text style={textStyles.caption}>
                      {REPORT_REASON_LABELS[r.reason] ?? r.reason}, reported {formatDateTime(r.created_at)}
                    </Text>
                    {r.details ? <Text style={textStyles.body}>â€œ{r.details}â€</Text> : null}
                    <View style={styles.btnRow}>
                      <Button
                        label="Remove listing"
                        variant="danger"
                        size="sm"
                        loading={busyKey === `rem-${r.id}`}
                        onPress={async () => {
                          setBusyKey(`rem-${r.id}`)
                          try {
                            await reviewReport(r.id, 'remove')
                            setNotice('Listing removed from the marketplace.')
                            await load()
                          } catch (e) {
                            setError(e instanceof Error ? e.message : 'Action failed.')
                          } finally {
                            setBusyKey(null)
                          }
                        }}
                      />
                      <Button
                        label="Dismiss"
                        variant="ghost"
                        size="sm"
                        loading={busyKey === `dis-${r.id}`}
                        onPress={async () => {
                          setBusyKey(`dis-${r.id}`)
                          try {
                            await reviewReport(r.id, 'dismiss')
                            setNotice('Report dismissed.')
                            await load()
                          } catch (e) {
                            setError(e instanceof Error ? e.message : 'Action failed.')
                          } finally {
                            setBusyKey(null)
                          }
                        }}
                      />
                    </View>
                  </View>
                ))}
              </Card>
            )}
          </Section>

          <Section title="Open disputes">
            {disputes.length === 0 ? (
              <Text style={textStyles.bodyMuted}>No open disputes.</Text>
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {disputes.map((d, idx) => (
                  <View key={d.id} style={[styles.row, idx > 0 && styles.border]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{d.listing.title}</Text>
                      <Text style={textStyles.caption} numberOfLines={1}>
                        {d.reason}
                      </Text>
                    </View>
                    <Button label="Review" variant="secondary" size="sm" onPress={() => router.push({ pathname: '/disputes/[id]', params: { id: d.id } })} />
                  </View>
                ))}
              </Card>
            )}
          </Section>

          <Section title="Staff transfers">
            {transfers.length === 0 ? (
              <Text style={textStyles.bodyMuted}>No items routed to staff yet.</Text>
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {transfers.map((t, idx) => (
                  <View key={t.id} style={[styles.row, idx > 0 && styles.border]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{t.listing.title}</Text>
                      <Text style={textStyles.caption}>
                        From {names.get(t.owner_id) ?? 'resident'}, routed {formatDateTime(t.routed_at)}
                      </Text>
                    </View>
                    <StatusBadge status={t.status} />
                  </View>
                ))}
              </Card>
            )}
          </Section>

          <Section title="No-dues check" subtitle="Informational only in this pilot; not linked to university records.">
            {noDues.length === 0 ? (
              <Notice tone="info" title="No student residents are linked to this hostel yet." />
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {noDues.map((r, idx) => (
                  <View key={r.user_id} style={[styles.row, idx > 0 && styles.border]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{r.full_name}</Text>
                      <Text style={textStyles.caption}>
                        {Number(r.open_listings)} listings, {Number(r.open_rentals)} rentals, {Number(r.open_disputes)} disputes
                      </Text>
                    </View>
                    <Badge tone={r.cleared ? 'forest' : 'amber'}>{r.cleared ? 'Clear' : 'Outstanding'}</Badge>
                  </View>
                ))}
              </Card>
            )}
          </Section>
        </>
      )}
    </ScrollView>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={textStyles.h2}>{title}</Text>
      {subtitle ? <Text style={textStyles.caption}>{subtitle}</Text> : null}
      {children}
    </View>
  )
}

function Stat({ label, value, clay }: { label: string; value: string; clay?: boolean }) {
  return (
    <View style={[styles.statBox, clay && styles.statClay]}>
      <Text style={[styles.statLabel, clay && { color: colors.clay }]}>{label}</Text>
      <Text style={styles.statVal}>{value}</Text>
    </View>
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
    paddingBottom: 40,
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.chalk,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.card,
    padding: 12,
    gap: 4,
  },
  statClay: {
    backgroundColor: colors.clayTint,
    borderColor: colors.clayBorder,
  },
  statLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.muted,
  },
  statVal: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 24,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  impactCard: {
    backgroundColor: colors.forestTint,
    borderWidth: 1,
    borderColor: colors.forestBorder,
    borderRadius: radii.card,
    padding: 16,
    gap: 4,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  impactLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.forestStrong,
  },
  impactValue: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 24,
    color: colors.forestStrong,
    fontVariant: ['tabular-nums'],
  },
  impactSub: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.forestStrong,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 14,
  },
  border: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  itemTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.ink,
  },
  reportItem: {
    padding: 14,
    gap: 6,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
})
