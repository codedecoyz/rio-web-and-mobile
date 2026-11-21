import React, { useCallback, useState } from 'react'
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { FileText } from 'lucide-react-native'
import { SandboxBadge, StatusBadge } from '@/components/ui/Badges'
import { Button } from '@/components/ui/Button'
import { Card, Notice, Skeleton } from '@/components/ui/Feedback'
import { Field, TextInputField } from '@/components/ui/Field'
import { formatINR } from '@/domain/money'
import { settleDeposit } from '@/domain/rental'
import { useAuth } from '@/lib/auth-context'
import { getDisputeDetail, resolveDispute, type DisputeDetail } from '@/lib/data/disputes'
import { formatDateTime } from '@/lib/format'
import { colors, fonts, radii, textStyles } from '@/theme/tokens'

type Outcome = 'RESOLVED_REFUND' | 'RESOLVED_RELEASE' | 'RESOLVED_DAMAGE'

export default function DisputeDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { viewer, refreshBalance } = useAuth()
  const [detail, setDetail] = useState<DisputeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [outcome, setOutcome] = useState<Outcome>('RESOLVED_REFUND')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      setError(null)
      setDetail(await getDisputeDetail(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dispute couldn’t be loaded.')
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
        <Skeleton height={180} />
      </ScrollView>
    )
  }

  if (!detail || !viewer) {
    return (
      <View style={styles.container}>
        <Notice tone="error" title={error ?? 'Dispute not found.'} />
      </View>
    )
  }

  const { dispute, names, counterpartyId, amountPaise, depositPaise, rentPaise, evidenceUrl } = detail
  const isParty = [dispute.reporter_id, dispute.listing.owner_id, counterpartyId].includes(viewer.id)
  const canDecide = !isParty && (viewer.role === 'warden' || viewer.role === 'admin') && dispute.status === 'OPEN'
  const deposit = depositPaise ?? 0

  const options: { value: Outcome; label: string; detail: string }[] = dispute.claim_id
    ? [
        {
          value: 'RESOLVED_REFUND',
          label: 'Refund the buyer',
          detail: `${formatINR(amountPaise ?? 0)} returns to the buyer; the item goes back on the marketplace.`,
        },
        {
          value: 'RESOLVED_RELEASE',
          label: 'Release payment to the seller',
          detail: 'Use when the handover did happen as agreed. The item is marked sold.',
        },
      ]
    : dispute.prev_subject_status === 'PENDING_PICKUP'
      ? [
          {
            value: 'RESOLVED_REFUND',
            label: 'Cancel and refund',
            detail: `Rent and deposit (${formatINR((rentPaise ?? 0) + deposit)}) return to the renter.`,
          },
          {
            value: 'RESOLVED_RELEASE',
            label: 'Dismiss: continue to pickup',
            detail: 'The rental goes back to waiting for pickup.',
          },
        ]
      : [
          {
            value: 'RESOLVED_REFUND',
            label: 'No damage: refund the full deposit',
            detail: `${formatINR(deposit)} back to the renter. The rental closes as returned.`,
          },
          {
            value: 'RESOLVED_DAMAGE',
            label: 'Damage: deduct 25% of the deposit',
            detail: `${formatINR(settleDeposit(deposit, true).deductionPaise)} to the owner, ${formatINR(settleDeposit(deposit, true).refundPaise)} back to the renter.`,
          },
          ...(!dispute.item_returned
            ? [{ value: 'RESOLVED_RELEASE' as Outcome, label: 'Dismiss: rental continues', detail: 'The rental goes back to active.' }]
            : []),
        ]

  const handleResolve = async () => {
    setError(null)
    if (note.trim().length < 5) {
      setError('Explain the decision (at least 5 characters).')
      return
    }
    setBusy(true)
    try {
      await resolveDispute(dispute.id, outcome, note)
      await refreshBalance()
      setNotice('Decision recorded. Sandbox balances have been updated.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record decision.')
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
      {notice ? <Notice tone="success" title={notice} /> : null}
      {error ? <Notice tone="error" title={error} /> : null}

      <View style={styles.head}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={textStyles.caption}>{dispute.claim_id ? 'Purchase' : 'Rental'} dispute</Text>
          <Pressable onPress={() => router.push({ pathname: '/items/[id]', params: { id: dispute.listing.id } })}>
            <Text style={textStyles.h1}>{dispute.listing.title}</Text>
          </Pressable>
        </View>
        <StatusBadge status={dispute.status} />
      </View>

      <Card style={{ gap: 10 }}>
        <Text style={styles.cardHeading}>Report</Text>
        <Text style={textStyles.caption}>
          By {names.get(dispute.reporter_id) ?? 'a participant'} on {formatDateTime(dispute.created_at)}
          {dispute.item_returned ? ', when the item was returned' : ''}
        </Text>
        <Text style={textStyles.body}>{dispute.reason}</Text>

        {evidenceUrl ? (
          <Button
            label="View evidence (valid 5 min)"
            variant="secondary"
            size="sm"
            icon={<FileText size={15} color={colors.ink} />}
            onPress={() => void Linking.openURL(evidenceUrl)}
          />
        ) : null}

        <View style={styles.partiesRow}>
          <View style={{ flex: 1 }}>
            <Text style={textStyles.caption}>Owner</Text>
            <Text style={styles.partyName}>{names.get(dispute.listing.owner_id) ?? '—'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={textStyles.caption}>{dispute.claim_id ? 'Buyer' : 'Renter'}</Text>
            <Text style={styles.partyName}>{counterpartyId ? (names.get(counterpartyId) ?? '—') : '—'}</Text>
          </View>
        </View>
      </Card>

      {dispute.status !== 'OPEN' ? (
        <View style={styles.decisionCard}>
          <View style={styles.head}>
            <Text style={styles.decisionHeading}>Warden decision</Text>
            <SandboxBadge />
          </View>
          <Text style={styles.decisionBody}>{dispute.resolution_note}</Text>
          {dispute.deduction_paise > 0 ? (
            <Text style={styles.decisionMeta}>Damage deduction: {formatINR(dispute.deduction_paise)}</Text>
          ) : null}
          {dispute.resolved_at ? <Text style={styles.decisionMeta}>Decided {formatDateTime(dispute.resolved_at)}</Text> : null}
        </View>
      ) : canDecide ? (
        <Card style={{ gap: 14 }}>
          <Text style={textStyles.h2}>Decide</Text>
          <Text style={textStyles.caption}>Balances move immediately in sandbox money. This can’t be undone.</Text>
          <View style={{ gap: 8 }}>
            {options.map((o) => {
              const active = outcome === o.value
              return (
                <Pressable
                  key={o.value}
                  onPress={() => setOutcome(o.value)}
                  style={[styles.optionBox, active && styles.optionActive]}
                >
                  <Text style={styles.optionLabel}>{o.label}</Text>
                  <Text style={textStyles.caption}>{o.detail}</Text>
                </Pressable>
              )
            })}
          </View>
          <Field label="Reason for the decision" hint="Both parties will see this.">
            <TextInputField value={note} onChangeText={setNote} multiline maxLength={1000} placeholder="Explain the decision" />
          </Field>
          <Button label={busy ? 'Recording…' : 'Record decision'} loading={busy} onPress={handleResolve} />
        </Card>
      ) : (
        <Notice tone="info" title="Waiting for a warden">
          {isParty && (viewer.role === 'warden' || viewer.role === 'admin')
            ? 'You’re involved in this dispute, so another warden must decide it.'
            : 'A warden from this hostel will review the report. Any sandbox money involved stays held until then.'}
        </Notice>
      )}
    </ScrollView>
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
  cardHeading: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.ink,
  },
  partiesRow: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
  },
  partyName: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.ink,
  },
  decisionCard: {
    backgroundColor: colors.forestTint,
    borderWidth: 1,
    borderColor: colors.forestBorder,
    borderRadius: radii.card,
    padding: 16,
    gap: 8,
  },
  decisionHeading: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.forestStrong,
  },
  decisionBody: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.forestStrong,
  },
  decisionMeta: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.forestStrong,
  },
  optionBox: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.media,
    backgroundColor: colors.chalk,
    padding: 12,
    gap: 3,
  },
  optionActive: {
    borderColor: colors.forest,
    backgroundColor: colors.forestTint,
  },
  optionLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.ink,
  },
})
