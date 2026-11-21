import React, { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { HandoverCodePanel } from '@/components/handover/HandoverCodePanel'
import { SandboxBadge, StatusBadge } from '@/components/ui/Badges'
import { Button } from '@/components/ui/Button'
import { Card, ConfirmModal, Notice, Skeleton } from '@/components/ui/Feedback'
import { formatINR } from '@/domain/money'
import { currentPricePaise } from '@/domain/pricing'
import { RENTAL_PERIODS, RENT_TO_OWN_CREDIT_BPS, quoteRentToOwn, settleDeposit } from '@/domain/rental'
import { useAuth } from '@/lib/auth-context'
import {
  cancelRental,
  convertRentalToPurchase,
  getNames,
  getRental,
  type RentalRow,
} from '@/lib/data/transactions'
import { formatDateTime, formatTime } from '@/lib/format'
import { colors, fonts, radii, textStyles } from '@/theme/tokens'

export default function RentalDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { viewer, refreshBalance } = useAuth()
  const [rental, setRental] = useState<RentalRow | null>(null)
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [rtoOpen, setRtoOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      setError(null)
      const r = await getRental(id)
      setRental(r)
      if (r) {
        setNames(await getNames([r.renter_id, r.listing.owner_id]))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t load rental.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  if (loading) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Skeleton height={160} />
        <Skeleton height={220} />
      </ScrollView>
    )
  }

  if (!rental || !viewer) {
    return (
      <View style={styles.container}>
        <Notice tone="error" title={error ?? 'Rental not found.'} />
      </View>
    )
  }

  const now = Date.now()
  const isRenter = rental.renter_id === viewer.id
  const isOwner = rental.listing.owner_id === viewer.id
  const current = currentPricePaise(
    {
      startPaise: rental.listing.start_price_paise,
      floorPaise: rental.listing.floor_price_paise,
      listedAt: new Date(rental.listing.listed_at),
      departureAt: rental.listing.departure_at ? new Date(rental.listing.departure_at) : null,
    },
    now,
  )
  const rto = quoteRentToOwn(current, rental.listing.floor_price_paise, rental.rent_paise)
  const damage = settleDeposit(rental.deposit_paise, true)

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
      {notice ? <Notice tone="success" title={notice} /> : null}
      {error ? <Notice tone="error" title={error} /> : null}

      <View style={styles.head}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={textStyles.caption}>{RENTAL_PERIODS[rental.period].label} rental</Text>
          <Pressable onPress={() => router.push({ pathname: '/items/[id]', params: { id: rental.listing.id } })}>
            <Text style={textStyles.h1}>{rental.listing.title}</Text>
          </Pressable>
          <Text style={textStyles.bodyMuted}>
            {isRenter ? `From ${names.get(rental.listing.owner_id) ?? 'the owner'}` : `Rented by ${names.get(rental.renter_id) ?? 'a student'}`}
          </Text>
        </View>
        <StatusBadge status={rental.status} />
      </View>

      <Card style={{ gap: 10 }}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardHeading}>Payments</Text>
          <SandboxBadge />
        </View>
        <MoneyRow term="Rent" value={formatINR(rental.rent_paise)} note={rental.picked_up_at ? 'Paid to the owner at pickup' : 'Held until pickup'} />
        <MoneyRow
          term="Deposit"
          value={formatINR(rental.deposit_paise)}
          note={rental.status === 'RETURNED' || rental.status === 'CONVERTED' ? 'Settled' : 'Held, refundable on return'}
        />
        {rental.damage_deduction_paise > 0 ? (
          <MoneyRow term="Damage deduction" value={`−${formatINR(rental.damage_deduction_paise)}`} note="Decided by a warden" />
        ) : null}
        {rental.converted_price_paise ? <MoneyRow term="Bought for" value={formatINR(rental.converted_price_paise)} note="Rent-to-own" /> : null}

        <View style={styles.datesBox}>
          <DateRow label="Booked" value={formatDateTime(rental.booked_at)} />
          {rental.picked_up_at ? <DateRow label="Picked up" value={formatDateTime(rental.picked_up_at)} /> : null}
          {rental.due_at ? <DateRow label="Due back" value={formatDateTime(rental.due_at)} strong /> : null}
          {rental.returned_at ? <DateRow label="Returned" value={formatDateTime(rental.returned_at)} /> : null}
        </View>

        {rental.status === 'ACTIVE' ? (
          <Text style={textStyles.caption}>
            If damage is reported on return, a warden decides. The most that can be deducted is 25% of the deposit ({formatINR(damage.deductionPaise)}).
          </Text>
        ) : null}
      </Card>

      {rental.status === 'ACTIVE' && isRenter ? (
        <View style={styles.rtoCard}>
          <Text style={styles.rtoHeading}>Keep it: rent-to-own</Text>
          <Text style={styles.rtoBody}>
            {RENT_TO_OWN_CREDIT_BPS / 100}% of the rent you paid comes off today’s price, but never below the seller’s floor.
          </Text>
          <DateRow label={`Current price (as of ${formatTime(now)})`} value={formatINR(rto.currentPricePaise)} dark />
          <DateRow
            label={`Credit earned (${RENT_TO_OWN_CREDIT_BPS / 100}% of ${formatINR(rto.rentPaidPaise)})`}
            value={`−${formatINR(rto.earnedCreditPaise)}`}
            dark
          />
          {rto.floorApplied ? <DateRow label="Floor applies; credit capped at" value={`−${formatINR(rto.appliedCreditPaise)}`} dark /> : null}
          <DateRow label="Seller’s floor" value={formatINR(rto.floorPaise)} dark />
          <View style={styles.rtoTotal}>
            <Text style={styles.rtoTotalLabel}>You pay</Text>
            <Text style={styles.rtoTotalVal}>{formatINR(rto.buyPricePaise)}</Text>
          </View>
          <DateRow label="Deposit refunded" value={`+${formatINR(rental.deposit_paise)}`} dark />
          <Button label={`Buy for about ${formatINR(rto.buyPricePaise)}`} onPress={() => setRtoOpen(true)} />
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
        <Text style={textStyles.h2}>Next step</Text>
        {rental.status === 'PENDING_PICKUP' && isOwner ? (
          <HandoverCodePanel purpose="RENTAL_PICKUP" subjectId={rental.id} onConsumed={() => void load()} />
        ) : null}
        {rental.status === 'PENDING_PICKUP' && isRenter ? (
          <Card style={{ gap: 10 }}>
            <Text style={textStyles.body}>When you collect the item, scan the owner’s pickup code on Handover.</Text>
            <Button label="Open Handover scanner" onPress={() => router.push('/(tabs)/handover')} />
          </Card>
        ) : null}
        {rental.status === 'ACTIVE' && isRenter ? (
          <HandoverCodePanel purpose="RENTAL_RETURN" subjectId={rental.id} onConsumed={() => void load()} />
        ) : null}
        {rental.status === 'ACTIVE' && isOwner ? (
          <Card style={{ gap: 10 }}>
            <Text style={textStyles.body}>When the item comes back, scan the renter’s return code on Handover. You can report damage there.</Text>
            <Button label="Open Handover scanner" onPress={() => router.push('/(tabs)/handover')} />
          </Card>
        ) : null}
        {rental.status === 'DISPUTED' ? (
          <Notice tone="warning" title="A warden is reviewing this rental. The deposit stays held until they decide." />
        ) : null}
        {['RETURNED', 'CANCELLED', 'CONVERTED'].includes(rental.status) ? (
          <Text style={textStyles.bodyMuted}>This rental is closed.</Text>
        ) : null}

        <View style={styles.rowBtns}>
          {rental.status === 'PENDING_PICKUP' ? (
            <Button label="Cancel rental" variant="ghost" onPress={() => setCancelOpen(true)} />
          ) : null}
          {rental.status === 'PENDING_PICKUP' || rental.status === 'ACTIVE' ? (
            <Button
              label="Report a problem"
              variant="ghost"
              onPress={() => router.push({ pathname: '/disputes/new', params: { rental: rental.id } })}
            />
          ) : null}
        </View>
      </View>

      <ConfirmModal
        visible={rtoOpen}
        title="Buy this item?"
        body="The final price is recalculated by the server at the moment you confirm, using the same rule shown here. Your deposit is refunded in the same step."
        confirmLabel="Buy it"
        loading={busy}
        onCancel={() => setRtoOpen(false)}
        onConfirm={async () => {
          setBusy(true)
          try {
            await convertRentalToPurchase(rental.id)
            setRtoOpen(false)
            await refreshBalance()
            setNotice('It’s yours. Your deposit was refunded and the purchase settled in sandbox money.')
            await load()
          } catch (e) {
            setRtoOpen(false)
            setError(e instanceof Error ? e.message : 'Conversion failed.')
          } finally {
            setBusy(false)
          }
        }}
      />

      <ConfirmModal
        visible={cancelOpen}
        title="Cancel this rental?"
        body="Rent and deposit go back to the renter, and the item returns to the marketplace."
        confirmLabel="Cancel rental"
        variant="danger"
        loading={busy}
        onCancel={() => setCancelOpen(false)}
        onConfirm={async () => {
          setBusy(true)
          try {
            await cancelRental(rental.id)
            setCancelOpen(false)
            await refreshBalance()
            setNotice('Rental cancelled. Rent and deposit were returned (sandbox).')
            await load()
          } catch (e) {
            setCancelOpen(false)
            setError(e instanceof Error ? e.message : 'Cancel failed.')
          } finally {
            setBusy(false)
          }
        }}
      />
    </ScrollView>
  )
}

function MoneyRow({ term, value, note }: { term: string; value: string; note: string }) {
  return (
    <View style={styles.moneyRow}>
      <Text style={styles.moneyTerm}>{term}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.moneyVal}>{value}</Text>
        <Text style={textStyles.caption}>{note}</Text>
      </View>
    </View>
  )
}

function DateRow({ label, value, strong, dark }: { label: string; value: string; strong?: boolean; dark?: boolean }) {
  return (
    <View style={styles.rowBetween}>
      <Text style={[textStyles.caption, dark && { color: colors.forestStrong }]}>{label}</Text>
      <Text
        style={[
          textStyles.caption,
          { fontVariant: ['tabular-nums'] },
          strong && { color: colors.ink, fontFamily: fonts.sansMedium },
          dark && { color: colors.forestStrong, fontFamily: fonts.sansMedium },
        ]}
      >
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  cardHeading: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.ink,
  },
  moneyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  moneyTerm: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.ink,
  },
  moneyVal: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  datesBox: {
    gap: 4,
    paddingTop: 6,
  },
  rtoCard: {
    backgroundColor: colors.forestTint,
    borderWidth: 1,
    borderColor: colors.forestBorder,
    borderRadius: radii.card,
    padding: 16,
    gap: 8,
  },
  rtoHeading: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.forestStrong,
  },
  rtoBody: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.forestStrong,
  },
  rtoTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.forestBorder,
    paddingTop: 8,
  },
  rtoTotalLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.forestStrong,
  },
  rtoTotalVal: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 18,
    color: colors.forestStrong,
    fontVariant: ['tabular-nums'],
  },
  rowBtns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
})
