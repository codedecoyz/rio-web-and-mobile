import QRCode from 'qrcode'
import { handoverQrPayload, normalizeHandoverCode } from '@/domain/handoverCode'
import type { RentalPeriod } from '@/domain/rental'
import type { ClaimStatus, ListingStatus, RentalStatus, StaffTransferStatus } from '@/domain/stateMachine'
import { rpcErrorMessage } from '@/lib/rpc-errors'
import { supabase } from '@/lib/supabase'

export type HandoverPurpose = 'CLAIM' | 'RENTAL_PICKUP' | 'RENTAL_RETURN' | 'STAFF_CUSTODY'

interface ListingRef {
  id: string
  title: string
  category_slug: string
  owner_id: string
  status: ListingStatus
  start_price_paise: number
  floor_price_paise: number
  listed_at: string
  departure_at: string | null
}

export interface ClaimRow {
  id: string
  status: ClaimStatus
  amount_paise: number
  claimed_at: string
  completed_at: string | null
  claimer_id: string
  listing: ListingRef
}

export interface RentalRow {
  id: string
  status: RentalStatus
  period: RentalPeriod
  rent_paise: number
  deposit_paise: number
  booked_at: string
  picked_up_at: string | null
  due_at: string | null
  returned_at: string | null
  damage_deduction_paise: number
  converted_price_paise: number | null
  renter_id: string
  listing: ListingRef
}

export interface StaffTransferRow {
  id: string
  status: StaffTransferStatus
  routed_at: string
  accepted_at: string | null
  owner_id: string
  hostel_id: string | null
  listing: { id: string; title: string; category_slug: string; departure_at: string | null }
}

export interface LedgerRow {
  id: string
  type: string
  amount_paise: number
  balance_after_paise: number
  note: string | null
  listing_id: string | null
  created_at: string
}

export interface IssuedCode {
  tokenId: string
  code: string
  expiresAt: string
  qr: { size: number; bits: string }
}

export interface ConsumeResult {
  purpose: HandoverPurpose
  listingId: string
  disputeId?: string
  message: string
}

const LISTING_REF = 'id, title, category_slug, owner_id, status, start_price_paise, floor_price_paise, listed_at, departure_at'
const CLAIM_COLS = `id, status, amount_paise, claimed_at, completed_at, claimer_id, listing:listings!listing_id!inner(${LISTING_REF})`
const RENTAL_COLS = `id, status, period, rent_paise, deposit_paise, booked_at, picked_up_at, due_at, returned_at, damage_deduction_paise, converted_price_paise, renter_id, listing:listings!listing_id!inner(${LISTING_REF})`

function num<T extends Record<string, unknown>>(row: T, keys: (keyof T)[]): T {
  const out = { ...row }
  for (const k of keys) {
    if (out[k] !== null && out[k] !== undefined) {
      ;(out as Record<keyof T, unknown>)[k] = Number(out[k])
    }
  }
  return out
}

const normListing = (l: ListingRef): ListingRef =>
  num(l as unknown as Record<string, unknown>, ['start_price_paise', 'floor_price_paise']) as unknown as ListingRef

function normClaim(r: Record<string, unknown>): ClaimRow {
  const c = num(r, ['amount_paise']) as unknown as ClaimRow
  return { ...c, listing: normListing(c.listing) }
}

function normRental(r: Record<string, unknown>): RentalRow {
  const x = num(r, ['rent_paise', 'deposit_paise', 'damage_deduction_paise', 'converted_price_paise']) as unknown as RentalRow
  return { ...x, listing: normListing(x.listing) }
}

export async function getActivity(userId: string) {
  const [bought, sold, renting, lending, transfers] = await Promise.all([
    supabase.from('claims').select(CLAIM_COLS).eq('claimer_id', userId).order('claimed_at', { ascending: false }).limit(50),
    supabase.from('claims').select(CLAIM_COLS).eq('listing.owner_id', userId).order('claimed_at', { ascending: false }).limit(50),
    supabase.from('rentals').select(RENTAL_COLS).eq('renter_id', userId).order('booked_at', { ascending: false }).limit(50),
    supabase.from('rentals').select(RENTAL_COLS).eq('listing.owner_id', userId).order('booked_at', { ascending: false }).limit(50),
    supabase
      .from('staff_transfers')
      .select('id, status, routed_at, accepted_at, owner_id, hostel_id, listing:listings!listing_id!inner(id, title, category_slug, departure_at)')
      .eq('owner_id', userId)
      .order('routed_at', { ascending: false })
      .limit(20),
  ])
  for (const r of [bought, sold, renting, lending, transfers]) {
    if (r.error) throw new Error(rpcErrorMessage(r.error))
  }
  return {
    bought: (bought.data ?? []).map(normClaim),
    sold: (sold.data ?? []).map(normClaim),
    renting: (renting.data ?? []).map(normRental),
    lending: (lending.data ?? []).map(normRental),
    transfers: (transfers.data ?? []) as unknown as StaffTransferRow[],
  }
}

export async function getRental(id: string): Promise<RentalRow | null> {
  const { data, error } = await supabase.from('rentals').select(RENTAL_COLS).eq('id', id).maybeSingle()
  if (error) throw new Error(rpcErrorMessage(error))
  return data ? normRental(data) : null
}

export async function getMyInvolvement(listingId: string, userId: string) {
  const [claims, rentals] = await Promise.all([
    supabase.from('claims').select('id, status, amount_paise, claimer_id').eq('listing_id', listingId).in('status', ['PENDING_HANDOVER', 'DISPUTED']).limit(1),
    supabase.from('rentals').select('id, status, renter_id').eq('listing_id', listingId).in('status', ['PENDING_PICKUP', 'ACTIVE', 'DISPUTED']).limit(1),
  ])
  const claim = claims.data?.[0] ?? null
  const rental = rentals.data?.[0] ?? null
  return {
    claim: claim ? { ...claim, amount_paise: Number(claim.amount_paise), mine: claim.claimer_id === userId } : null,
    rental: rental ? { ...rental, mine: rental.renter_id === userId } : null,
  }
}

export async function getNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return new Map()
  const { data } = await supabase.from('profiles').select('id, full_name').in('id', unique)
  return new Map((data ?? []).map((p) => [p.id, p.full_name]))
}

export async function getLedger(limit = 100): Promise<LedgerRow[]> {
  const { data, error } = await supabase
    .from('ledger_entries')
    .select('id, type, amount_paise, balance_after_paise, note, listing_id, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(rpcErrorMessage(error))
  return (data ?? []).map((r) => ({ ...r, amount_paise: Number(r.amount_paise), balance_after_paise: Number(r.balance_after_paise) }))
}

export async function claimListing(listingId: string): Promise<string> {
  const { data, error } = await supabase.rpc('claim_listing', { p_listing: listingId })
  if (error || !data) throw new Error(rpcErrorMessage(error))
  return data as string
}

export async function cancelClaim(claimId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_claim', { p_claim: claimId })
  if (error) throw new Error(rpcErrorMessage(error))
}

export async function startRental(listingId: string, period: RentalPeriod): Promise<string> {
  const { data, error } = await supabase.rpc('start_rental', { p_listing: listingId, p_period: period })
  if (error || !data) throw new Error(rpcErrorMessage(error))
  return data as string
}

export async function cancelRental(rentalId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_rental', { p_rental: rentalId })
  if (error) throw new Error(rpcErrorMessage(error))
}

export async function convertRentalToPurchase(rentalId: string): Promise<void> {
  const { error } = await supabase.rpc('convert_rental_to_purchase', { p_rental: rentalId })
  if (error) throw new Error(rpcErrorMessage(error))
}

export async function issueHandoverToken(purpose: HandoverPurpose, subjectId: string): Promise<IssuedCode> {
  const { data, error } = await supabase.rpc('issue_handover_token', { p_purpose: purpose, p_subject: subjectId })
  if (error || !data) throw new Error(rpcErrorMessage(error))
  const row = (Array.isArray(data) ? data[0] : data) as { token_id: string; code: string; expires_at: string }
  const matrix = QRCode.create(handoverQrPayload(row.code), { errorCorrectionLevel: 'M' }).modules
  const bits = Array.from(matrix.data, (b) => (b ? '1' : '0')).join('')
  return {
    tokenId: row.token_id,
    code: row.code,
    expiresAt: row.expires_at,
    qr: { size: matrix.size, bits },
  }
}

export async function getHandoverTokenStatus(tokenId: string): Promise<'pending' | 'consumed' | 'expired' | 'revoked' | 'unknown'> {
  const { data } = await supabase.from('handover_tokens').select('consumed_at, revoked_at, expires_at').eq('id', tokenId).maybeSingle()
  if (!data) return 'unknown'
  if (data.consumed_at) return 'consumed'
  if (data.revoked_at) return 'revoked'
  if (new Date(data.expires_at).getTime() <= Date.now()) return 'expired'
  return 'pending'
}

export async function consumeHandoverToken(rawCode: string, reportDamage: boolean, damageNote?: string): Promise<ConsumeResult> {
  const code = normalizeHandoverCode(rawCode)
  if (!code) {
    throw new Error('Codes are 16 letters and numbers, like ABCD-EFGH-JKMN-PQRS.')
  }
  const trimmedNote = damageNote?.trim() ?? ''
  if (reportDamage && trimmedNote.length < 10) {
    throw new Error('Describe the damage in at least 10 characters.')
  }
  const { data, error } = await supabase.rpc('consume_handover_token', {
    p_code: code,
    p_report_damage: reportDamage,
    p_damage_note: trimmedNote || null,
  })
  if (error || !data) throw new Error(rpcErrorMessage(error))
  const res = data as { purpose: HandoverPurpose; listing_id: string; dispute_id: string | null }
  const messages: Record<HandoverPurpose, string> = {
    CLAIM: 'Handover confirmed. The sale is settled and the seller has been paid (sandbox).',
    RENTAL_PICKUP: 'Pickup confirmed. Your rental has started and the rent was released to the owner (sandbox).',
    RENTAL_RETURN: res.dispute_id
      ? 'Return recorded with a damage report. A warden will review it; the deposit stays held until then.'
      : 'Return confirmed. The renter’s deposit has been refunded (sandbox).',
    STAFF_CUSTODY: 'Custody accepted. The item is now with campus staff.',
  }
  return {
    purpose: res.purpose,
    listingId: res.listing_id,
    disputeId: res.dispute_id ?? undefined,
    message: messages[res.purpose],
  }
}

export const REPORT_REASONS = [
  { value: 'misleading', label: 'Photos or description are misleading' },
  { value: 'scam', label: 'Looks like a scam' },
  { value: 'prohibited', label: 'Item isn’t allowed in hostels' },
  { value: 'duplicate', label: 'Duplicate listing' },
  { value: 'offensive', label: 'Offensive content' },
  { value: 'other', label: 'Something else' },
] as const

export async function reportListing(listingId: string, reason: string, details?: string): Promise<void> {
  const { error } = await supabase.rpc('report_listing', {
    p_listing: listingId,
    p_reason: reason,
    p_details: details?.trim() || null,
  })
  if (error) throw new Error(rpcErrorMessage(error))
}

export async function reviewReport(reportId: string, decision: 'dismiss' | 'remove'): Promise<void> {
  const { error } = await supabase.rpc('review_report', { p_report: reportId, p_action: decision })
  if (error) throw new Error(rpcErrorMessage(error))
}

export async function rateTransaction(subject: { claimId?: string; rentalId?: string }, stars: number, comment?: string): Promise<void> {
  const { error } = await supabase.rpc('rate_transaction', {
    p_claim: subject.claimId ?? null,
    p_rental: subject.rentalId ?? null,
    p_stars: stars,
    p_comment: comment?.trim() || null,
  })
  if (error) throw new Error(rpcErrorMessage(error))
}

export async function getSellerRating(sellerId: string): Promise<{ ratings: number; average: number | null }> {
  const { data, error } = await supabase.rpc('seller_rating', { p_seller: sellerId })
  if (error) throw new Error(rpcErrorMessage(error))
  const row = (Array.isArray(data) ? data[0] : data) as { ratings: number | string; average: number | string | null } | undefined
  const ratings = Number(row?.ratings ?? 0)
  return { ratings, average: ratings ? Number(row?.average) : null }
}

export async function getMyRatedTransactions(): Promise<{ claims: Set<string>; rentals: Set<string> }> {
  const { data, error } = await supabase.rpc('my_rated_transactions')
  if (error) throw new Error(rpcErrorMessage(error))
  const rows = (data ?? []) as { claim_id: string | null; rental_id: string | null }[]
  return {
    claims: new Set(rows.flatMap((r) => (r.claim_id ? [r.claim_id] : []))),
    rentals: new Set(rows.flatMap((r) => (r.rental_id ? [r.rental_id] : []))),
  }
}
