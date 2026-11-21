import React, { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { ArrowLeftRight, CheckCircle2 } from 'lucide-react-native'
import { RatingForm } from '@/components/activity/RatingForm'
import { HandoverCodePanel } from '@/components/handover/HandoverCodePanel'
import { ListingCard } from '@/components/listings/ListingCard'
import { SandboxBadge, StatusBadge } from '@/components/ui/Badges'
import { Button } from '@/components/ui/Button'
import { Card, ConfirmModal, EmptyState, Notice, Skeleton } from '@/components/ui/Feedback'
import { formatINR, formatSignedINR } from '@/domain/money'
import { RENTAL_PERIODS } from '@/domain/rental'
import { useAuth } from '@/lib/auth-context'
import { getMyListings, type ListingCardData } from '@/lib/data/listings'
import {
  cancelClaim,
  getActivity,
  getLedger,
  getMyRatedTransactions,
  getNames,
  type ClaimRow,
  type LedgerRow,
  type RentalRow,
  type StaffTransferRow,
} from '@/lib/data/transactions'
import { formatDateTime } from '@/lib/format'
import { colors, fonts, radii, textStyles } from '@/theme/tokens'

const LEDGER_LABELS: Record<string, string> = {
  OPENING_CREDIT: 'Sandbox opening credit',
  MIGRATED_BALANCE: 'Migrated sandbox balance',
  CLAIM_HOLD: 'Purchase held in escrow',
  CLAIM_REFUND: 'Escrow refunded',
  SALE_PAYOUT: 'Sale payout',
  RENT_CHARGE: 'Rent held',
  RENT_REFUND: 'Rent refunded',
  RENT_PAYOUT: 'Rental income',
  DEPOSIT_HOLD: 'Deposit held',
  DEPOSIT_REFUND: 'Deposit refunded',
  DAMAGE_PAYOUT: 'Damage deduction received',
  RTO_CHARGE: 'Rent-to-own purchase',
  RTO_PAYOUT: 'Rent-to-own sale',
}

type Segment = 'transactions' | 'listings' | 'wallet'

export default function ActivityScreen() {
  const router = useRouter()
  const { viewer, balance, refreshBalance } = useAuth()
  const [segment, setSegment] = useState<Segment>('transactions')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [activity, setActivity] = useState<{
    bought: ClaimRow[]
    sold: ClaimRow[]
    renting: RentalRow[]
    lending: RentalRow[]
    transfers: StaffTransferRow[]
  } | null>(null)
  const [listings, setListings] = useState<ListingCardData[]>([])
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [rated, setRated] = useState<{ claims: Set<string>; rentals: Set<string> }>({ claims: new Set(), rentals: new Set() })
  const [cancelTarget, setCancelTarget] = useState<ClaimRow | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const load = useCallback(async () => {
    if (!viewer) {
      setLoading(false)
      return
    }
    try {
      setError(null)
      const [act, mine, led, ratedRes] = await Promise.all([
        getActivity(viewer.id),
        getMyListings(viewer.id),
        getLedger(100),
        getMyRatedTransactions().catch(() => ({ claims: new Set<string>(), rentals: new Set<string>() })),
      ])
      const nameMap = await getNames([
        ...act.sold.map((c) => c.claimer_id),
        ...act.bought.map((c) => c.listing.owner_id),
        ...act.lending.map((r) => r.renter_id),
      ])
      setActivity(act)
      setListings(mine)
      setLedger(led)
      setRated(ratedRes)
      setNames(nameMap)
      await refreshBalance()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Activity couldnâ€™t be loaded.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [viewer, refreshBalance])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  if (!viewer) {
    return (
      <View style={styles.gate}>
        <EmptyState
          icon={<ArrowLeftRight size={24} color={colors.forest} />}
          title="Sign in to view your activity"
          message="See your purchases, sales, rentals, handover QR codes, and sandbox wallet ledger."
          actionLabel="Sign in"
          onAction={() => router.push('/auth/login')}
        />
      </View>
    )
  }

  const now = Date.now()

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
      <Text style={textStyles.h1}>My activity</Text>
      <Text style={textStyles.bodyMuted}>Purchases, sales, rentals and every sandbox transaction, in one place.</Text>

      <View style={styles.segments}>
        {(
          [
            { key: 'transactions', label: 'Transactions' },
            { key: 'listings', label: `Listings (${listings.length})` },
            { key: 'wallet', label: 'Wallet' },
          ] as { key: Segment; label: string }[]
        ).map((s) => {
          const active = segment === s.key
          return (
            <Pressable key={s.key} onPress={() => setSegment(s.key)} style={[styles.segBtn, active && styles.segBtnOn]}>
              <Text style={[styles.segText, active && styles.segTextOn]}>{s.label}</Text>
            </Pressable>
          )
        })}
      </View>

      {notice ? <Notice tone="success" title={notice} /> : null}
      {error ? <Notice tone="error" title={error} /> : null}

      {loading && !activity ? (
        <View style={{ gap: 12 }}>
          <Skeleton height={120} />
          <Skeleton height={180} />
        </View>
      ) : segment === 'transactions' && activity ? (
        <View style={{ gap: 22 }}>
          <Section title="Buying">
            {activity.bought.length === 0 ? (
              <EmptyBox text="You havenâ€™t claimed anything yet." />
            ) : (
              activity.bought.map((c) => (
                <ClaimCard
                  key={c.id}
                  claim={c}
                  counterparty={names.get(c.listing.owner_id)}
                  role="buyer"
                  rating={c.status !== 'COMPLETED' ? 'none' : rated.claims.has(c.id) ? 'done' : 'can'}
                  onOpenItem={() => router.push({ pathname: '/items/[id]', params: { id: c.listing.id } })}
                  onOpenHandover={() => router.push('/(tabs)/handover')}
                  onCancel={() => setCancelTarget(c)}
                  onReport={() => router.push({ pathname: '/disputes/new', params: { claim: c.id } })}
                  onReload={() => void load()}
                />
              ))
            )}
          </Section>

          <Section title="Selling">
            {activity.sold.length === 0 ? (
              <EmptyBox text="No one has claimed your items yet." />
            ) : (
              activity.sold.map((c) => (
                <ClaimCard
                  key={c.id}
                  claim={c}
                  counterparty={names.get(c.claimer_id)}
                  role="seller"
                  onOpenItem={() => router.push({ pathname: '/items/[id]', params: { id: c.listing.id } })}
                  onCancel={() => setCancelTarget(c)}
                  onReport={() => router.push({ pathname: '/disputes/new', params: { claim: c.id } })}
                  onReload={() => void load()}
                />
              ))
            )}
          </Section>

          <Section title="Rentals">
            {activity.renting.length + activity.lending.length === 0 ? (
              <EmptyBox text="No rentals yet. Items marked â€œAlso for rentâ€ can be borrowed by the day, week or month." />
            ) : (
              <>
                {activity.renting.map((r) => (
                  <RentalCard
                    key={r.id}
                    rental={r}
                    label="Youâ€™re renting"
                    rating={r.status !== 'RETURNED' && r.status !== 'CONVERTED' ? 'none' : rated.rentals.has(r.id) ? 'done' : 'can'}
                    onOpen={() => router.push({ pathname: '/rentals/[id]', params: { id: r.id } })}
                    onReload={() => void load()}
                  />
                ))}
                {activity.lending.map((r) => (
                  <RentalCard
                    key={r.id}
                    rental={r}
                    label={`Rented by ${names.get(r.renter_id) ?? 'a student'}`}
                    onOpen={() => router.push({ pathname: '/rentals/[id]', params: { id: r.id } })}
                    onReload={() => void load()}
                  />
                ))}
              </>
            )}
          </Section>

          {activity.transfers.length > 0 ? (
            <Section title="Handed to campus staff">
              {activity.transfers.map((t) => (
                <Card key={t.id} style={{ gap: 10 }}>
                  <View style={styles.cardTop}>
                    <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/items/[id]', params: { id: t.listing.id } })}>
                      <Text style={styles.itemTitle}>{t.listing.title}</Text>
                    </Pressable>
                    <StatusBadge status={t.status} />
                  </View>
                  <Text style={textStyles.caption}>Routed to staff {formatDateTime(t.routed_at)}.</Text>
                  {t.status === 'PENDING' ? (
                    <HandoverCodePanel purpose="STAFF_CUSTODY" subjectId={t.id} onConsumed={() => void load()} />
                  ) : null}
                </Card>
              ))}
            </Section>
          ) : null}
        </View>
      ) : segment === 'listings' ? (
        <View style={{ gap: 14 }}>
          <View style={styles.sectionHead}>
            <Text style={textStyles.h2}>My listings</Text>
            <Button label="List an item" size="sm" onPress={() => router.push('/(tabs)/sell')} />
          </View>
          {listings.length === 0 ? (
            <EmptyBox text="Nothing listed yet." />
          ) : (
            listings.map((l) => (
              <ListingCard
                key={l.id}
                item={l}
                now={now}
                showStatus
                onPress={() => router.push({ pathname: '/items/[id]', params: { id: l.id } })}
              />
            ))
          )}
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <View style={styles.sectionHead}>
            <Text style={textStyles.h2}>Sandbox wallet</Text>
            <SandboxBadge />
          </View>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <View style={styles.walletHead}>
              <Text style={textStyles.bodyMuted}>Current balance</Text>
              <Text style={styles.walletBig}>{balance === null ? 'Unavailable' : formatINR(balance)}</Text>
            </View>
            <View style={styles.walletBanner}>
              <Text style={styles.walletBannerText}>
                Simulated money for the Level 1 pilot. Nothing here is a real payment, payout or refund.
              </Text>
            </View>
            {ledger.length === 0 ? (
              <Text style={[textStyles.bodyMuted, { padding: 16 }]}>No transactions yet.</Text>
            ) : (
              ledger.map((e, i) => (
                <View key={e.id} style={[styles.ledgerRow, i > 0 && styles.ledgerBorder]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.ledgerTitle}>{LEDGER_LABELS[e.type] ?? e.type}</Text>
                    {e.note ? <Text style={textStyles.caption}>{e.note}</Text> : null}
                    <Text style={textStyles.caption}>{formatDateTime(e.created_at)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text style={[styles.ledgerAmt, e.amount_paise > 0 && { color: colors.forest }]}>
                      {formatSignedINR(e.amount_paise)}
                    </Text>
                    <Text style={styles.ledgerBal}>Bal {formatINR(e.balance_after_paise)}</Text>
                  </View>
                </View>
              ))
            )}
          </Card>
        </View>
      )}

      <ConfirmModal
        visible={Boolean(cancelTarget)}
        title="Cancel this claim?"
        body={
          cancelTarget
            ? `The ${formatINR(cancelTarget.amount_paise)} held in sandbox escrow goes back to the buyer and the item returns to the marketplace.`
            : undefined
        }
        confirmLabel="Cancel claim"
        variant="danger"
        loading={cancelling}
        onCancel={() => setCancelTarget(null)}
        onConfirm={async () => {
          if (!cancelTarget) return
          setCancelling(true)
          try {
            await cancelClaim(cancelTarget.id)
            setNotice('Claim cancelled. The sandbox escrow has been returned to the buyer.')
            setCancelTarget(null)
            await load()
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Couldnâ€™t cancel claim.')
            setCancelTarget(null)
          } finally {
            setCancelling(false)
          }
        }}
      />
    </ScrollView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={textStyles.h2}>{title}</Text>
      {children}
    </View>
  )
}

function EmptyBox({ text }: { text: string }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={textStyles.bodyMuted}>{text}</Text>
    </View>
  )
}

function ClaimCard({
  claim,
  counterparty,
  role,
  rating = 'none',
  onOpenItem,
  onOpenHandover,
  onCancel,
  onReport,
  onReload,
}: {
  claim: ClaimRow
  counterparty?: string
  role: 'buyer' | 'seller'
  rating?: 'none' | 'can' | 'done'
  onOpenItem: () => void
  onOpenHandover?: () => void
  onCancel: () => void
  onReport: () => void
  onReload: () => void
}) {
  const pending = claim.status === 'PENDING_HANDOVER'
  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1, gap: 2 }}>
          <Pressable onPress={onOpenItem}>
            <Text style={styles.itemTitle}>{claim.listing.title}</Text>
          </Pressable>
          <Text style={textStyles.caption}>
            {role === 'buyer' ? `From ${counterparty ?? 'the seller'}` : `Claimed by ${counterparty ?? 'a student'}`},{' '}
            {formatDateTime(claim.claimed_at)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={styles.amount}>{formatINR(claim.amount_paise)}</Text>
          <StatusBadge status={claim.status} />
        </View>
      </View>

      {pending ? (
        <View style={styles.pendingBox}>
          {role === 'seller' ? (
            <HandoverCodePanel purpose="CLAIM" subjectId={claim.id} onConsumed={onReload} />
          ) : (
            <View style={{ gap: 8 }}>
              <Text style={textStyles.body}>When you meet the seller, scan their code on Handover. Payment is released only then.</Text>
              {onOpenHandover ? <Button label="Open Handover scanner" size="sm" onPress={onOpenHandover} /> : null}
            </View>
          )}
          <View style={styles.actionRow}>
            <Button label="Cancel claim" variant="ghost" size="sm" onPress={onCancel} />
            <Button label="Report a problem" variant="ghost" size="sm" onPress={onReport} />
          </View>
        </View>
      ) : null}

      {rating === 'can' ? <RatingForm claimId={claim.id} onSubmitted={onReload} /> : null}
      {rating === 'done' ? (
        <View style={styles.ratedRow}>
          <CheckCircle2 size={16} color={colors.forest} />
          <Text style={styles.ratedText}>You rated this seller. Thanks.</Text>
        </View>
      ) : null}
    </Card>
  )
}

function RentalCard({
  rental,
  label,
  rating = 'none',
  onOpen,
  onReload,
}: {
  rental: RentalRow
  label: string
  rating?: 'none' | 'can' | 'done'
  onOpen: () => void
  onReload: () => void
}) {
  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.itemTitle}>{rental.listing.title}</Text>
          <Text style={textStyles.caption}>
            {label}, {RENTAL_PERIODS[rental.period].label.toLowerCase()} rental. {formatINR(rental.rent_paise)} rent,{' '}
            {formatINR(rental.deposit_paise)} deposit.
          </Text>
        </View>
        <StatusBadge status={rental.status} />
      </View>
      <View style={styles.actionRow}>
        <Button label="Open rental" variant="secondary" size="sm" onPress={onOpen} />
      </View>
      {rating === 'can' ? <RatingForm rentalId={rental.id} onSubmitted={onReload} /> : null}
      {rating === 'done' ? (
        <View style={styles.ratedRow}>
          <CheckCircle2 size={16} color={colors.forest} />
          <Text style={styles.ratedText}>You rated this seller. Thanks.</Text>
        </View>
      ) : null}
    </Card>
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
  segments: {
    flexDirection: 'row',
    backgroundColor: colors.chalk,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.card,
    padding: 4,
    gap: 4,
  },
  segBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.media,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segBtnOn: {
    backgroundColor: colors.forest,
  },
  segText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.muted,
  },
  segTextOn: {
    color: colors.chalk,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptyBox: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    padding: 16,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  itemTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.ink,
  },
  amount: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 19,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  pendingBox: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12,
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ratedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  ratedText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.forest,
  },
  walletHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  walletBig: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 28,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  walletBanner: {
    backgroundColor: colors.amberTint,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  walletBannerText: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.amber,
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
  },
  ledgerBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  ledgerTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.ink,
  },
  ledgerAmt: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  ledgerBal: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
  },
})
