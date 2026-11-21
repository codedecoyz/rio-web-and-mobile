import React, { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { ArrowUpRight, ClipboardList, Gavel, Heart, Leaf, PackageOpen, ScanLine, Search, Settings, ShieldCheck, Users } from 'lucide-react-native'
import { CategoryArt } from '@/components/brand/CategoryArt'
import { ListingCard } from '@/components/listings/ListingCard'
import { SandboxBadge } from '@/components/ui/Badges'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, Notice, Skeleton } from '@/components/ui/Feedback'
import { TextInputField } from '@/components/ui/Field'
import { CATEGORIES } from '@/domain/catalog'
import { estimateRentalImpact, estimateTransferImpact, formatKg, sumImpact } from '@/domain/impact'
import { formatINR } from '@/domain/money'
import { useAuth } from '@/lib/auth-context'
import { getMarketplace, getMyListings, type ListingCardData } from '@/lib/data/listings'
import { getActivity, type ClaimRow, type RentalRow, type StaffTransferRow } from '@/lib/data/transactions'
import { formatDateTime } from '@/lib/format'
import { colors, fonts, radii, textStyles } from '@/theme/tokens'

interface TodoItem {
  key: string
  title: string
  detail: string
  cta: string
  onPress: () => void
}

export default function HomeScreen() {
  const router = useRouter()
  const { viewer, balance, loading: authLoading, refreshBalance } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [leavingSoon, setLeavingSoon] = useState<ListingCardData[]>([])
  const [myListings, setMyListings] = useState<ListingCardData[]>([])
  const [activity, setActivity] = useState<{
    bought: ClaimRow[]
    sold: ClaimRow[]
    renting: RentalRow[]
    lending: RentalRow[]
    transfers: StaffTransferRow[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      if (!viewer) {
        const res = await getMarketplace({ sort: 'ending', page: 1 }, Date.now())
        setLeavingSoon(res.items.slice(0, 4))
        setMyListings([])
        setActivity(null)
      } else {
        const [act, mine] = await Promise.all([getActivity(viewer.id), getMyListings(viewer.id)])
        setActivity(act)
        setMyListings(mine)
        await refreshBalance()
      }
    } catch {
      // Soft fail on home refresh
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [viewer, refreshBalance])

  useFocusEffect(
    useCallback(() => {
      if (!authLoading) void load()
    }, [authLoading, load]),
  )

  useEffect(() => {
    if (!authLoading) void load()
  }, [authLoading, load])

  const now = Date.now()

  if (authLoading || (loading && !leavingSoon.length && !activity)) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Skeleton height={44} style={{ width: '65%' }} />
        <Skeleton height={110} />
        <Skeleton height={110} />
        <Skeleton height={220} />
      </ScrollView>
    )
  }

  if (!viewer) {
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
        <View style={styles.heroBox}>
          <Text style={textStyles.hero}>Leaving campus? Leave your stuff for the next batch.</Text>
          <Text style={styles.heroSub}>
            RIO is a move-out marketplace for hostels. Sell or rent what you canâ€™t carry home, at a price that drops as your departure nears, and hand it
            over with a QR scan.
          </Text>

          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <Search size={18} color={colors.muted} style={styles.searchIcon} />
              <TextInputField
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search cooler, mattressâ€¦"
                returnKeyType="search"
                onSubmitEditing={() =>
                  router.push({ pathname: '/(tabs)/marketplace', params: searchQuery.trim() ? { q: searchQuery.trim() } : {} })
                }
                style={{ paddingLeft: 38 }}
              />
            </View>
            <Button
              label="Search"
              onPress={() =>
                router.push({ pathname: '/(tabs)/marketplace', params: searchQuery.trim() ? { q: searchQuery.trim() } : {} })
              }
            />
          </View>

          <View style={styles.rowBtns}>
            <Button label="Browse all items" variant="secondary" onPress={() => router.push('/(tabs)/marketplace')} style={{ flex: 1 }} />
            <Button label="How it works" variant="ghost" onPress={() => router.push('/how-it-works')} style={{ flex: 1 }} />
          </View>

          <Text style={textStyles.caption}>Simulated payment: no real money is transferred during the pilot.</Text>
        </View>

        <View style={styles.section}>
          <Text style={textStyles.h2}>Browse by category</Text>
          <View style={styles.catGrid}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.slug}
                onPress={() => router.push({ pathname: '/(tabs)/marketplace', params: { category: c.slug } })}
                style={styles.catCard}
              >
                <CategoryArt slug={c.slug} label={c.name} style={styles.catArt} />
                <Text style={styles.catName} numberOfLines={2}>
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {leavingSoon.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={textStyles.h2}>Leaving soonest</Text>
              <Pressable onPress={() => router.push('/(tabs)/marketplace')}>
                <Text style={styles.linkText}>See everything</Text>
              </Pressable>
            </View>
            <View style={{ gap: 14 }}>
              {leavingSoon.map((item) => (
                <ListingCard
                  key={item.id}
                  item={item}
                  now={now}
                  onPress={() => router.push({ pathname: '/items/[id]', params: { id: item.id } })}
                />
              ))}
            </View>
          </View>
        ) : null}

        <Card style={styles.ctaCard}>
          <Text style={styles.ctaTitle}>Sign in with your campus account</Text>
          <Text style={styles.ctaBody}>Claim items, generate 10-minute handover QR codes, and keep your room number private.</Text>
          <View style={styles.rowBtns}>
            <Button label="Sign in" onPress={() => router.push('/auth/login')} style={{ flex: 1 }} />
            <Button label="Create account" variant="secondary" onPress={() => router.push('/auth/signup')} style={{ flex: 1 }} />
          </View>
        </Card>
      </ScrollView>
    )
  }

  const todos: TodoItem[] = activity
    ? [
        ...activity.sold
          .filter((c) => c.status === 'PENDING_HANDOVER')
          .map((c) => ({
            key: `sell-${c.id}`,
            title: `Hand over â€œ${c.listing.title}â€`,
            detail: `Claimed for ${formatINR(c.amount_paise)}. Meet the buyer and show your code.`,
            cta: 'Show code',
            onPress: () => router.push('/(tabs)/activity'),
          })),
        ...activity.bought
          .filter((c) => c.status === 'PENDING_HANDOVER')
          .map((c) => ({
            key: `buy-${c.id}`,
            title: `Collect â€œ${c.listing.title}â€`,
            detail: 'Meet the seller and scan their code to complete the purchase.',
            cta: 'Scan code',
            onPress: () => router.push('/(tabs)/handover'),
          })),
        ...activity.lending
          .filter((r) => r.status === 'PENDING_PICKUP')
          .map((r) => ({
            key: `lend-${r.id}`,
            title: `Lend out â€œ${r.listing.title}â€`,
            detail: 'The renter is waiting. Show your pickup code when you meet.',
            cta: 'Show code',
            onPress: () => router.push({ pathname: '/rentals/[id]', params: { id: r.id } }),
          })),
        ...activity.renting
          .filter((r) => r.status === 'PENDING_PICKUP')
          .map((r) => ({
            key: `rent-pick-${r.id}`,
            title: `Pick up â€œ${r.listing.title}â€`,
            detail: 'Scan the ownerâ€™s pickup code to start your rental.',
            cta: 'Scan code',
            onPress: () => router.push('/(tabs)/handover'),
          })),
        ...activity.renting
          .filter((r) => r.status === 'ACTIVE')
          .map((r) => ({
            key: `rent-ret-${r.id}`,
            title: `Return â€œ${r.listing.title}â€`,
            detail: r.due_at ? `Due ${formatDateTime(r.due_at)}.` : 'Return it when youâ€™re done.',
            cta: 'Open rental',
            onPress: () => router.push({ pathname: '/rentals/[id]', params: { id: r.id } }),
          })),
        ...activity.transfers
          .filter((t) => t.status === 'PENDING')
          .map((t) => ({
            key: `tr-${t.id}`,
            title: `Hand â€œ${t.listing.title}â€ to staff`,
            detail: 'Your warden routed this unsold item to campus staff.',
            cta: 'Show code',
            onPress: () => router.push('/(tabs)/activity'),
          })),
      ]
    : []

  const impact = sumImpact([
    ...myListings.filter((l) => l.status === 'SOLD' || l.status === 'STAFF_CUSTODY').map((l) => estimateTransferImpact(l.category_slug)),
    ...(activity?.renting ?? []).filter((r) => r.status === 'RETURNED').map((r) => estimateRentalImpact(r.listing.category_slug)),
  ])
  const firstName = viewer.fullName.split(/\s+/)[0]

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
      <View style={styles.greetingRow}>
        <Text style={textStyles.hero}>Hi, {firstName}</Text>
        <Text style={styles.roleTag}>
          {viewer.role.charAt(0).toUpperCase() + viewer.role.slice(1)}
          {viewer.hostelName ? ` Â· ${viewer.hostelName}` : ''}
        </Text>
      </View>

      <View style={styles.rowBtns}>
        <Button label="List an item" onPress={() => router.push('/(tabs)/sell')} style={{ flex: 1 }} />
        <Button
          label="Scan a code"
          variant="secondary"
          icon={<ScanLine size={16} color={colors.ink} />}
          onPress={() => router.push('/(tabs)/handover')}
          style={{ flex: 1 }}
        />
      </View>

      {(viewer.role === 'warden' || viewer.role === 'admin' || viewer.role === 'staff') ? (
        <View style={styles.roleShortcuts}>
          {(viewer.role === 'warden' || viewer.role === 'admin') ? (
            <Button
              label="Warden dashboard"
              variant="clay"
              icon={<ShieldCheck size={16} color={colors.chalk} />}
              onPress={() => router.push('/warden')}
            />
          ) : null}
          <Button
            label="Staff custody queue"
            variant="secondary"
            icon={<Users size={16} color={colors.ink} />}
            onPress={() => router.push('/staff')}
          />
          {viewer.role === 'admin' ? (
            <Button
              label="Manage roles"
              variant="secondary"
              icon={<ClipboardList size={16} color={colors.ink} />}
              onPress={() => router.push('/admin/roles')}
            />
          ) : null}
        </View>
      ) : null}

      {!viewer.hostelId ? (
        <Notice tone="warning" title="Add your hostel">
          <Text style={{ fontFamily: fonts.sansRegular, fontSize: 13, color: colors.amber }}>
            Set your hostel in account settings so your listings show where they are and your warden can help with disputes.{' '}
            <Text style={{ fontFamily: fonts.sansSemiBold, textDecorationLine: 'underline' }} onPress={() => router.push('/settings')}>
              Open settings
            </Text>
          </Text>
        </Notice>
      ) : null}

      <View style={styles.statsGrid}>
        <Pressable onPress={() => router.push('/(tabs)/activity')} style={styles.statCard}>
          <View style={styles.statTop}>
            <Text style={styles.statLabel}>Balance</Text>
            <SandboxBadge />
          </View>
          <Text style={styles.statValue}>{balance === null ? 'Unavailable' : formatINR(balance)}</Text>
          <View style={styles.statLinkRow}>
            <Text style={styles.statLink}>See transactions</Text>
            <ArrowUpRight size={14} color={colors.forest} />
          </View>
        </Pressable>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Your listings</Text>
          <Text style={styles.statValue}>{myListings.filter((l) => l.status === 'ACTIVE').length} live</Text>
          <Text style={styles.statSub}>
            {myListings.filter((l) => l.status === 'SOLD').length} sold, {myListings.filter((l) => l.status === 'STAFF_CUSTODY').length} with staff
          </Text>
        </View>

        <View style={styles.impactCard}>
          <View style={styles.impactHead}>
            <Leaf size={15} color={colors.forestStrong} />
            <Text style={styles.impactLabel}>Estimated impact</Text>
          </View>
          <Text style={styles.impactValue}>{formatKg(impact.co2eAvoidedKg)} COâ‚‚e</Text>
          <Text style={styles.impactSub}>{formatKg(impact.wasteDivertedKg)} kept out of waste (estimate)</Text>
        </View>
      </View>

      <View style={styles.quickRow}>
        <QuickTile Icon={Heart} label="Saved" onPress={() => router.push('/saved')} />
        <QuickTile Icon={Gavel} label="Disputes" onPress={() => router.push('/disputes')} />
        <QuickTile Icon={Settings} label="Settings" onPress={() => router.push('/settings')} />
      </View>

      <View style={styles.section}>
        <Text style={textStyles.h2}>Needs your action</Text>
        {todos.length === 0 ? (
          <Text style={textStyles.bodyMuted}>Nothing waiting on you right now.</Text>
        ) : (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {todos.map((t, idx) => (
              <View key={t.key} style={[styles.todoRow, idx > 0 && styles.todoBorder]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.todoTitle}>{t.title}</Text>
                  <Text style={styles.todoDetail}>{t.detail}</Text>
                </View>
                <Button label={t.cta} variant="secondary" size="sm" onPress={t.onPress} />
              </View>
            ))}
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={textStyles.h2}>Your listings</Text>
          {myListings.length > 3 ? (
            <Pressable onPress={() => router.push('/(tabs)/activity')}>
              <Text style={styles.linkText}>See all {myListings.length}</Text>
            </Pressable>
          ) : null}
        </View>
        {myListings.length === 0 ? (
          <EmptyState
            icon={<PackageOpen size={24} color={colors.forest} />}
            title="You havenâ€™t listed anything yet"
            message="Leaving soon? List the things you canâ€™t take home. Set a floor price and RIO handles the countdown."
            actionLabel="List your first item"
            onAction={() => router.push('/(tabs)/sell')}
          />
        ) : (
          <View style={{ gap: 14 }}>
            {myListings.slice(0, 3).map((l) => (
              <ListingCard
                key={l.id}
                item={l}
                now={now}
                showStatus
                onPress={() => router.push({ pathname: '/items/[id]', params: { id: l.id } })}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  )
}

function QuickTile({ Icon, label, onPress }: { Icon: typeof Heart; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.quickTile}>
      <Icon size={18} color={colors.forest} />
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 36,
    gap: 20,
  },
  heroBox: {
    gap: 14,
  },
  heroSub: {
    fontFamily: fonts.sansRegular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  searchInputWrap: {
    flex: 1,
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    top: 14,
    zIndex: 1,
  },
  rowBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  section: {
    gap: 12,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  linkText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.forest,
    textDecorationLine: 'underline',
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  catCard: {
    width: '48%',
    backgroundColor: colors.chalk,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  catArt: {
    aspectRatio: 4 / 3,
    width: '100%',
  },
  catName: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink,
    padding: 10,
  },
  ctaCard: {
    gap: 10,
  },
  ctaTitle: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 20,
    color: colors.ink,
  },
  ctaBody: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  greetingRow: {
    gap: 4,
  },
  roleTag: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.muted,
  },
  roleShortcuts: {
    gap: 8,
  },
  statsGrid: {
    gap: 12,
  },
  statCard: {
    backgroundColor: colors.chalk,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.card,
    padding: 16,
    gap: 6,
  },
  statTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.muted,
  },
  statValue: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 28,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  statSub: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.muted,
  },
  statLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLink: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.forest,
  },
  impactCard: {
    backgroundColor: colors.forestTint,
    borderWidth: 1,
    borderColor: colors.forestBorder,
    borderRadius: radii.card,
    padding: 16,
    gap: 6,
  },
  impactHead: {
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
    fontSize: 28,
    color: colors.forestStrong,
    fontVariant: ['tabular-nums'],
  },
  impactSub: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.forestStrong,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickTile: {
    flex: 1,
    backgroundColor: colors.chalk,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.card,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
  },
  quickLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.ink,
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  todoBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  todoTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.ink,
  },
  todoDetail: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.muted,
  },
})
