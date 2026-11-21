import React, { useCallback, useState } from 'react'
import { Modal, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Flag, Heart, Leaf, MapPin, Share2, Star, X } from 'lucide-react-native'
import { CategoryArt } from '@/components/brand/CategoryArt'
import { PriceTag } from '@/components/brand/PriceTag'
import { Badge, SandboxBadge, StatusBadge, UrgencyBadge } from '@/components/ui/Badges'
import { Button } from '@/components/ui/Button'
import { Card, ConfirmModal, Notice, Skeleton } from '@/components/ui/Feedback'
import { ChipSelect, Field, TextInputField } from '@/components/ui/Field'
import { CONDITIONS } from '@/domain/catalog'
import { estimateRentalImpact, estimateTransferImpact, formatKg, hasImpactEstimate } from '@/domain/impact'
import { formatINR } from '@/domain/money'
import {
  DECAY_END_BEFORE_DEPARTURE_MS,
  STAFF_CUTOFF_BEFORE_DEPARTURE_MS,
  currentPricePaise,
  isStaffRoutable,
  isWithinTradingWindow,
  urgency,
} from '@/domain/pricing'
import {
  DAMAGE_DEDUCTION_BPS,
  RENTAL_PERIODS,
  RENTAL_PERIOD_KEYS,
  RENT_TO_OWN_CREDIT_BPS,
  canRentBeforeDeparture,
  quoteRental,
  type RentalPeriod,
} from '@/domain/rental'
import { hasRole, useAuth } from '@/lib/auth-context'
import {
  getListing,
  getOwnerName,
  getSavedIds,
  setListingAvailability,
  toggleSaved,
  type ListingDetail,
} from '@/lib/data/listings'
import {
  REPORT_REASONS,
  claimListing,
  getMyInvolvement,
  getSellerRating,
  reportListing,
  startRental,
} from '@/lib/data/transactions'
import { routeToStaff } from '@/lib/data/warden'
import { listingMediaUrl } from '@/lib/env'
import { formatDateTime, formatTime } from '@/lib/format'
import { colors, fonts, radii, textStyles } from '@/theme/tokens'

export default function ItemDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { viewer, refreshBalance } = useAuth()

  const [listing, setListing] = useState<ListingDetail | null>(null)
  const [ownerName, setOwnerName] = useState<string | null>(null)
  const [involvement, setInvolvement] = useState<Awaited<ReturnType<typeof getMyInvolvement>> | null>(null)
  const [saved, setSaved] = useState(false)
  const [rating, setRating] = useState<{ ratings: number; average: number | null } | null>(null)
  const [now, setNow] = useState(Date.now())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [claimOpen, setClaimOpen] = useState(false)
  const [hideOpen, setHideOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState<string>('misleading')
  const [reportDetails, setReportDetails] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState<RentalPeriod>('DAY')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      setError(null)
      const data = await getListing(id)
      setListing(data)
      setNow(Date.now())
      if (!data) {
        setLoading(false)
        setRefreshing(false)
        return
      }
      const [ownerRes, invRes, savedSet, ratingRes] = await Promise.all([
        viewer ? getOwnerName(data.owner_id) : Promise.resolve(null),
        viewer ? getMyInvolvement(data.id, viewer.id) : Promise.resolve(null),
        viewer ? getSavedIds([data.id]) : Promise.resolve(new Set<string>()),
        getSellerRating(data.owner_id).catch(() => null),
      ])
      setOwnerName(ownerRes)
      setInvolvement(invRes)
      setSaved(savedSet.has(data.id))
      setRating(ratingRes)

      const dep = data.departure_at ? new Date(data.departure_at).getTime() : null
      const eligible = RENTAL_PERIOD_KEYS.find((p) => canRentBeforeDeparture(dep, Date.now(), p).ok)
      if (eligible) setSelectedPeriod(eligible)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This item couldn’t be loaded.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id, viewer])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  if (loading) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Skeleton height={240} />
        <Skeleton height={48} style={{ width: '75%' }} />
        <Skeleton height={120} />
      </ScrollView>
    )
  }

  if (!listing) {
    return (
      <View style={[styles.container, { flex: 1, justifyContent: 'center' }]}>
        <Notice tone="error" title={error ?? 'We couldn’t find this item.'} />
      </View>
    )
  }

  const dep = listing.departure_at ? new Date(listing.departure_at).getTime() : null
  const current = currentPricePaise(
    {
      startPaise: listing.start_price_paise,
      floorPaise: listing.floor_price_paise,
      listedAt: new Date(listing.listed_at),
      departureAt: dep,
    },
    now,
  )
  const isOwner = viewer?.id === listing.owner_id
  const trading = isWithinTradingWindow(dep, now)
  const rentalOptions = RENTAL_PERIOD_KEYS.map((p) => ({
    p,
    quote: quoteRental(listing.start_price_paise, p),
    eligible: canRentBeforeDeparture(dep, now, p),
  }))
  const anyRentEligible = rentalOptions.some((o) => o.eligible.ok)

  const handleToggleSave = async () => {
    if (!viewer) {
      router.push('/auth/login')
      return
    }
    const prev = saved
    setSaved(!prev)
    try {
      await toggleSaved(listing.id, prev)
    } catch {
      setSaved(prev)
    }
  }

  const handleShare = async () => {
    try {
      await Share.share({
        title: listing.title,
        message: `${listing.title} — currently ${formatINR(current)} on RIO`,
      })
    } catch {
      // cancelled
    }
  }

  const handleClaim = async () => {
    setBusy(true)
    setError(null)
    try {
      await claimListing(listing.id)
      setClaimOpen(false)
      await refreshBalance()
      setNotice('Claimed! Payment is held in sandbox escrow. Open Activity or Handover to complete.')
      await load()
    } catch (e) {
      setClaimOpen(false)
      setError(e instanceof Error ? e.message : 'Claim failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleRent = async () => {
    setBusy(true)
    setError(null)
    try {
      const rentalId = await startRental(listing.id, selectedPeriod)
      await refreshBalance()
      router.push({ pathname: '/rentals/[id]', params: { id: rentalId } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not book rental.')
    } finally {
      setBusy(false)
    }
  }

  const handleAvailability = async (available: boolean) => {
    setBusy(true)
    setError(null)
    try {
      await setListingAvailability(listing.id, available)
      setHideOpen(false)
      setNotice(available ? 'Your item is back on the marketplace.' : 'Your item is hidden from the marketplace.')
      await load()
    } catch (e) {
      setHideOpen(false)
      setError(e instanceof Error ? e.message : 'Action failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleRouteToStaff = async () => {
    setBusy(true)
    setError(null)
    try {
      await routeToStaff(listing.id)
      setNotice('Routed to staff. The owner can now show a custody code to campus staff.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Routing failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleReport = async () => {
    setBusy(true)
    setError(null)
    try {
      await reportListing(listing.id, reportReason, reportDetails)
      setReportOpen(false)
      setReportDetails('')
      setNotice('Thanks. A warden for this hostel will review the listing. The seller won’t see who reported it.')
    } catch (e) {
      setReportOpen(false)
      setError(e instanceof Error ? e.message : 'Could not send report.')
    } finally {
      setBusy(false)
    }
  }

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
      {listing.media.length === 0 ? (
        <CategoryArt slug={listing.category_slug} label={listing.category.name} style={styles.heroMedia} />
      ) : (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.gallery}>
          {listing.media.map((m) => (
            <Image
              key={m.id}
              source={{ uri: listingMediaUrl(m.storage_path) }}
              style={styles.galleryImg}
              contentFit="cover"
              accessibilityLabel={m.alt_text}
            />
          ))}
        </ScrollView>
      )}

      {notice ? <Notice tone="success" title={notice} /> : null}
      {error ? <Notice tone="error" title={error} /> : null}

      <View style={{ gap: 8 }}>
        <View style={styles.badgeRow}>
          {listing.status !== 'ACTIVE' ? <StatusBadge status={listing.status} /> : <UrgencyBadge urgency={urgency(dep, now)} />}
          <Badge>{CONDITIONS[listing.condition].label}</Badge>
          {listing.is_rentable ? <Badge tone="forest">Also for rent</Badge> : null}
        </View>
        <Text style={textStyles.h1}>{listing.title}</Text>
        <View style={styles.metaRow}>
          <Text style={textStyles.bodyMuted}>{listing.category.name}</Text>
          {listing.hostel ? (
            <View style={styles.inlineIcon}>
              <MapPin size={14} color={colors.muted} />
              <Text style={textStyles.bodyMuted}>{listing.hostel.name}</Text>
            </View>
          ) : null}
          {ownerName ? <Text style={textStyles.bodyMuted}>Listed by {isOwner ? 'you' : ownerName}</Text> : null}
          {rating ? (
            <View style={styles.inlineIcon}>
              <Star size={14} color={colors.clay} />
              <Text style={textStyles.bodyMuted}>
                {rating.ratings ? `${rating.average}/5 (${rating.ratings})` : 'No ratings yet'}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <PriceTag
        size="detail"
        currentPaise={current}
        startPaise={listing.start_price_paise}
        floorPaise={listing.floor_price_paise}
        listedAt={listing.listed_at}
        departureAt={listing.departure_at}
        now={now}
      />
      <Text style={[textStyles.caption, { marginTop: -8 }]}>
        Price as of {formatTime(now)}. The exact price is fixed by the server at the moment you claim.
      </Text>

      {/* Actions Panel */}
      {!viewer ? (
        <View style={styles.rowBtns}>
          <Button label="Sign in to claim" size="lg" onPress={() => router.push('/auth/login')} style={{ flex: 1 }} />
          <Button label="Create account" variant="secondary" size="lg" onPress={() => router.push('/auth/signup')} style={{ flex: 1 }} />
        </View>
      ) : isOwner ? (
        <Card style={{ gap: 10 }}>
          <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink }}>This is your listing.</Text>
          <View style={styles.rowBtns}>
            {(listing.status === 'ACTIVE' || listing.status === 'WITHDRAWN') ? (
              <Button
                label="Edit listing"
                variant="secondary"
                onPress={() => router.push({ pathname: '/items/[id]/edit', params: { id: listing.id } })}
                style={{ flex: 1 }}
              />
            ) : null}
            {listing.status === 'ACTIVE' ? (
              <Button label="Hide listing" variant="ghost" onPress={() => setHideOpen(true)} />
            ) : null}
            {listing.status === 'WITHDRAWN' && trading ? (
              <Button label="Put back on market" loading={busy} onPress={() => void handleAvailability(true)} />
            ) : null}
          </View>
          {listing.status !== 'ACTIVE' && listing.status !== 'WITHDRAWN' ? (
            <Button label="Manage handovers in Activity" variant="secondary" onPress={() => router.push('/(tabs)/activity')} />
          ) : null}
        </Card>
      ) : involvement?.claim?.mine || involvement?.rental?.mine ? (
        <Notice
          tone="info"
          title={involvement.claim?.mine ? 'You’ve claimed this item.' : 'You’re renting this item.'}
        >
          <Button
            label={involvement.rental?.mine ? 'Open your rental' : 'Go to My activity'}
            size="sm"
            variant="secondary"
            onPress={() =>
              involvement.rental?.mine
                ? router.push({ pathname: '/rentals/[id]', params: { id: involvement.rental.id } })
                : router.push('/(tabs)/activity')
            }
            style={{ marginTop: 6 }}
          />
        </Notice>
      ) : hasRole(viewer, ['warden']) && viewer.role !== 'student' ? (
        isStaffRoutable(dep, now) && listing.status === 'ACTIVE' ? (
          <Button label="Route to campus staff" variant="clay" loading={busy} onPress={() => void handleRouteToStaff()} />
        ) : (
          <Text style={textStyles.bodyMuted}>Wardens and staff can’t buy or rent. Staff routing opens in the owner’s final hour.</Text>
        )
      ) : viewer.role !== 'student' ? (
        <Text style={textStyles.bodyMuted}>Only student accounts can buy or rent items.</Text>
      ) : listing.status !== 'ACTIVE' ? (
        <Notice tone="info" title="This item isn’t available right now." />
      ) : !trading ? (
        <Notice tone="warning" title="Trading has closed for this item.">
          The owner leaves within the hour, so it goes to campus staff instead of being sold.
        </Notice>
      ) : (
        <View style={{ gap: 14 }}>
          <View style={styles.claimRow}>
            <Button label={`Claim for ${formatINR(current)}`} size="lg" onPress={() => setClaimOpen(true)} style={{ flex: 1 }} />
            <SandboxBadge />
          </View>

          {listing.is_rentable ? (
            anyRentEligible ? (
              <Card style={{ gap: 12 }}>
                <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink }}>Rent instead</Text>
                <Text style={textStyles.caption}>
                  Rent and deposit are held now; rent goes to the owner at pickup. The deposit comes back when you return it.
                </Text>
                <View style={{ gap: 8 }}>
                  {rentalOptions.map(({ p, quote, eligible }) => {
                    const active = selectedPeriod === p
                    return (
                      <Pressable
                        key={p}
                        disabled={!eligible.ok}
                        onPress={() => setSelectedPeriod(p)}
                        style={[
                          styles.rentOption,
                          active && styles.rentOptionActive,
                          !eligible.ok && { opacity: 0.5 },
                        ]}
                      >
                        <Text style={styles.rentTitle}>{RENTAL_PERIODS[p].label}</Text>
                        <Text style={styles.rentPrice}>
                          {formatINR(quote.rentPaise)} rent + {formatINR(quote.depositPaise)} deposit
                        </Text>
                        {!eligible.ok ? <Text style={styles.rentBlocked}>Owner leaves too soon</Text> : null}
                      </Pressable>
                    )
                  })}
                </View>
                <Button label={busy ? 'Booking…' : 'Rent instead'} variant="secondary" loading={busy} onPress={() => void handleRent()} />
              </Card>
            ) : (
              <Text style={textStyles.caption}>
                Renting isn’t possible any more: the owner leaves too soon for even a one-day rental plus the 24-hour return buffer.
              </Text>
            )
          ) : null}
        </View>
      )}

      {/* Utility row: Save, Share, Report */}
      <View style={styles.utilityRow}>
        {!isOwner ? (
          <Button
            label={saved ? 'Saved' : 'Save'}
            variant="secondary"
            size="sm"
            icon={<Heart size={15} color={saved ? colors.clay : colors.ink} fill={saved ? colors.clay : 'none'} />}
            onPress={() => void handleToggleSave()}
          />
        ) : null}
        <Button label="Share" variant="secondary" size="sm" icon={<Share2 size={15} color={colors.ink} />} onPress={() => void handleShare()} />
        {viewer && !isOwner ? (
          <Button label="Report" variant="ghost" size="sm" icon={<Flag size={15} color={colors.forest} />} onPress={() => setReportOpen(true)} />
        ) : null}
      </View>

      {/* Auction timeline */}
      {dep !== null ? (
        <Card style={{ gap: 10 }}>
          <Text style={styles.sectionTitle}>Auction timeline</Text>
          <TimelineRow label="Listed" when={formatDateTime(listing.listed_at)} />
          <TimelineRow label="Reaches floor price" when={formatDateTime(dep - DECAY_END_BEFORE_DEPARTURE_MS)} />
          <TimelineRow label="Claims close; staff routing opens" when={formatDateTime(dep - STAFF_CUTOFF_BEFORE_DEPARTURE_MS)} />
          <TimelineRow label="Owner departs" when={formatDateTime(dep)} />
        </Card>
      ) : (
        <Text style={textStyles.caption}>No departure set: this item keeps its price until the owner changes it.</Text>
      )}

      {/* About */}
      <View style={{ gap: 8 }}>
        <Text style={textStyles.h2}>About this item</Text>
        <Text style={textStyles.body}>{listing.description || 'The owner hasn’t added a description.'}</Text>
        <Text style={textStyles.caption}>
          Condition: <Text style={{ color: colors.ink, fontFamily: fonts.sansMedium }}>{CONDITIONS[listing.condition].label}</Text>.{' '}
          {CONDITIONS[listing.condition].description}
        </Text>
      </View>

      {/* Rental terms */}
      {listing.is_rentable ? (
        <Card style={{ gap: 10 }}>
          <Text style={styles.sectionTitle}>Rental terms</Text>
          {RENTAL_PERIOD_KEYS.map((p) => {
            const q = quoteRental(listing.start_price_paise, p)
            return (
              <View key={p} style={styles.termRow}>
                <Text style={styles.termLabel}>{RENTAL_PERIODS[p].label}</Text>
                <Text style={styles.termVal}>
                  {formatINR(q.rentPaise)} rent · {formatINR(q.depositPaise)} deposit
                </Text>
              </View>
            )
          })}
          <Text style={textStyles.caption}>
            Like it? Buy it while renting: {RENT_TO_OWN_CREDIT_BPS / 100}% of the rent you paid comes off the current price, never below the floor.
          </Text>
          <Text style={textStyles.caption}>
            Damage on return can cost up to {DAMAGE_DEDUCTION_BPS / 100}% of the deposit, decided by a warden.
          </Text>
        </Card>
      ) : null}

      {/* Impact */}
      {hasImpactEstimate(listing.category_slug) ? (
        <View style={styles.impactCard}>
          <View style={styles.inlineIcon}>
            <Leaf size={16} color={colors.forestStrong} />
            <Text style={styles.impactHeading}>Estimated impact</Text>
          </View>
          <Text style={styles.impactBody}>
            Buying this instead of new avoids about {formatKg(estimateTransferImpact(listing.category_slug).co2eAvoidedKg)} CO₂e and keeps{' '}
            {formatKg(estimateTransferImpact(listing.category_slug).wasteDivertedKg)} out of waste.
            {listing.is_rentable
              ? ` A completed rental is estimated at ${formatKg(estimateRentalImpact(listing.category_slug).co2eAvoidedKg)} CO₂e.`
              : ''}
          </Text>
          <Text style={styles.impactNote}>Estimates from category averages, not measurements of this item.</Text>
        </View>
      ) : null}

      <ConfirmModal
        visible={claimOpen}
        title="Claim this item?"
        body={`About ${formatINR(current)} of sandbox money will be held in escrow. The seller is paid only when you scan their handover code. You can cancel before then for a full refund.`}
        confirmLabel="Claim and hold payment"
        loading={busy}
        onCancel={() => setClaimOpen(false)}
        onConfirm={() => void handleClaim()}
      />

      <ConfirmModal
        visible={hideOpen}
        title="Hide this listing?"
        body="Buyers won’t see it until you put it back. You can relist any time before your final hour."
        confirmLabel="Hide listing"
        loading={busy}
        onCancel={() => setHideOpen(false)}
        onConfirm={() => void handleAvailability(false)}
      />

      <Modal visible={reportOpen} transparent animationType="slide" onRequestClose={() => setReportOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={textStyles.h2}>Report this listing</Text>
              <Pressable onPress={() => setReportOpen(false)}>
                <X size={22} color={colors.muted} />
              </Pressable>
            </View>
            <Text style={textStyles.caption}>A warden for this hostel reviews every report. The seller won’t see who reported it.</Text>
            <Field label="Reason">
              <ChipSelect value={reportReason} onChange={setReportReason} options={REPORT_REASONS} />
            </Field>
            <Field label="Details" optional>
              <TextInputField value={reportDetails} onChangeText={setReportDetails} multiline maxLength={500} placeholder="What looks wrong?" />
            </Field>
            <Button label={busy ? 'Sending…' : 'Send report'} variant="clay" loading={busy} onPress={() => void handleReport()} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

function TimelineRow({ label, when }: { label: string; when: string }) {
  return (
    <View style={styles.timelineRow}>
      <Text style={textStyles.caption}>{label}</Text>
      <Text style={[textStyles.caption, { color: colors.ink, fontFamily: fonts.sansMedium, fontVariant: ['tabular-nums'] }]}>{when}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  heroMedia: {
    aspectRatio: 4 / 3,
    width: '100%',
    borderRadius: radii.card,
  },
  gallery: {
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  galleryImg: {
    width: 340,
    height: 255,
    marginRight: 8,
    borderRadius: radii.card,
    backgroundColor: colors.forestTint,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  inlineIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  claimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rentOption: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.chalk,
    borderRadius: radii.media,
    padding: 12,
    gap: 2,
  },
  rentOptionActive: {
    borderColor: colors.forest,
    backgroundColor: colors.forestTint,
  },
  rentTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.ink,
  },
  rentPrice: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  rentBlocked: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.clay,
  },
  utilityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.ink,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  termRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  termLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.ink,
  },
  termVal: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  impactCard: {
    backgroundColor: colors.forestTint,
    borderWidth: 1,
    borderColor: colors.forestBorder,
    borderRadius: radii.card,
    padding: 16,
    gap: 8,
  },
  impactHeading: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.forestStrong,
  },
  impactBody: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.forestStrong,
  },
  impactNote: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.forestStrong,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(27, 36, 32, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.chalk,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    gap: 14,
  },
  modalHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
})
