import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import type { DisputeStatus } from '@/domain/stateMachine'
import { rpcErrorMessage } from '@/lib/rpc-errors'
import { supabase } from '@/lib/supabase'
import { randomUuid } from '@/lib/uuid'
import { getNames } from './transactions'

export interface DisputeRow {
  id: string
  status: DisputeStatus
  reason: string
  evidence_path: string | null
  resolution_note: string | null
  created_at: string
  resolved_at: string | null
  reporter_id: string
  claim_id: string | null
  rental_id: string | null
  item_returned: boolean
  prev_subject_status: string | null
  deduction_paise: number
  listing: { id: string; title: string; owner_id: string; hostel_id: string | null }
}

export interface DisputeDetail {
  dispute: DisputeRow
  names: Map<string, string>
  counterpartyId?: string
  amountPaise?: number
  depositPaise?: number
  rentPaise?: number
  evidenceUrl: string | null
}

const DISPUTE_COLS =
  'id, status, reason, evidence_path, resolution_note, created_at, resolved_at, reporter_id, claim_id, rental_id, item_returned, prev_subject_status, deduction_paise, listing:listings!listing_id!inner(id, title, owner_id, hostel_id)'

export async function getDisputes(opts: { status?: 'OPEN' | 'CLOSED'; hostelIds?: string[] } = {}): Promise<DisputeRow[]> {
  let q = supabase.from('disputes').select(DISPUTE_COLS).order('created_at', { ascending: false }).limit(100)
  if (opts.status === 'OPEN') q = q.eq('status', 'OPEN')
  if (opts.status === 'CLOSED') q = q.neq('status', 'OPEN')
  if (opts.hostelIds?.length) q = q.in('listing.hostel_id', opts.hostelIds)
  const { data, error } = await q
  if (error) throw new Error(rpcErrorMessage(error))
  return (data ?? []).map((d) => ({ ...d, deduction_paise: Number(d.deduction_paise) }) as unknown as DisputeRow)
}

export async function getDisputeDetail(id: string): Promise<DisputeDetail | null> {
  const { data, error } = await supabase.from('disputes').select(DISPUTE_COLS).eq('id', id).maybeSingle()
  if (error) throw new Error(rpcErrorMessage(error))
  if (!data) return null
  const dispute = { ...data, deduction_paise: Number(data.deduction_paise) } as unknown as DisputeRow

  const [subject, names, evidenceUrl] = await Promise.all([
    dispute.claim_id
      ? supabase.from('claims').select('claimer_id, amount_paise').eq('id', dispute.claim_id).maybeSingle()
      : supabase.from('rentals').select('renter_id, deposit_paise, rent_paise').eq('id', dispute.rental_id!).maybeSingle(),
    getNames([dispute.reporter_id, dispute.listing.owner_id]),
    dispute.evidence_path
      ? supabase.storage
          .from('dispute-evidence')
          .createSignedUrl(dispute.evidence_path, 300)
          .then((r) => r.data?.signedUrl ?? null)
      : Promise.resolve(null),
  ])

  const s = (subject.data ?? {}) as { claimer_id?: string; renter_id?: string; amount_paise?: number; deposit_paise?: number; rent_paise?: number }
  const counterpartyId = s.claimer_id ?? s.renter_id
  const allNames = counterpartyId ? new Map([...names, ...(await getNames([counterpartyId]))]) : names

  return {
    dispute,
    names: allNames,
    counterpartyId,
    amountPaise: s.amount_paise !== undefined ? Number(s.amount_paise) : undefined,
    depositPaise: s.deposit_paise !== undefined ? Number(s.deposit_paise) : undefined,
    rentPaise: s.rent_paise !== undefined ? Number(s.rent_paise) : undefined,
    evidenceUrl,
  }
}

export async function openDispute(
  userId: string,
  params: { claimId?: string; rentalId?: string; reason: string; evidenceUri?: string },
): Promise<string> {
  let evidencePath: string | null = null
  if (params.evidenceUri) {
    const ref = await ImageManipulator.manipulate(params.evidenceUri).resize({ width: 1200 }).renderAsync()
    const saved = await ref.saveAsync({ compress: 0.82, format: SaveFormat.JPEG })
    const buf = await (await fetch(saved.uri)).arrayBuffer()
    evidencePath = `${userId}/${randomUuid()}.jpg`
    const { error: upErr } = await supabase.storage.from('dispute-evidence').upload(evidencePath, buf, { contentType: 'image/jpeg' })
    if (upErr) throw new Error('The evidence photo couldn’t be uploaded. Try again or submit without it.')
  }

  const { data, error } = await supabase.rpc('open_dispute', {
    p_claim: params.claimId ?? null,
    p_rental: params.rentalId ?? null,
    p_reason: params.reason.trim(),
    p_evidence_path: evidencePath,
  })
  if (error || !data) {
    if (evidencePath) await supabase.storage.from('dispute-evidence').remove([evidencePath])
    throw new Error(rpcErrorMessage(error))
  }
  return data as string
}

export async function resolveDispute(disputeId: string, outcome: 'RESOLVED_REFUND' | 'RESOLVED_RELEASE' | 'RESOLVED_DAMAGE', note: string): Promise<void> {
  const { error } = await supabase.rpc('resolve_dispute', {
    p_dispute: disputeId,
    p_outcome: outcome,
    p_note: note.trim(),
  })
  if (error) throw new Error(rpcErrorMessage(error))
}
