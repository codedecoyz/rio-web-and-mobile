import type { Role, Viewer } from '@/lib/auth-context'
import { rpcErrorMessage } from '@/lib/rpc-errors'
import { supabase } from '@/lib/supabase'

export interface Hostel {
  id: string
  name: string
  campus: string
}

export interface QueueItem {
  id: string
  title: string
  status: string
  departure_at: string
  owner_id: string
  category_slug: string
}

export interface ScopedStaffTransfer {
  id: string
  status: 'PENDING' | 'ACCEPTED'
  routed_at: string
  accepted_at: string | null
  owner_id: string
  accepted_by: string | null
  hostel_id: string
  listing: { id: string; title: string; category_slug: string }
}

export interface OpenReport {
  id: string
  reason: string
  details: string | null
  created_at: string
  listing: { id: string; title: string; status: string; hostel_id: string | null }
}

export interface NoDuesRow {
  user_id: string
  full_name: string
  departure_at: string | null
  open_listings: number
  open_rentals: number
  open_disputes: number
  cleared: boolean
}

export async function getAllHostels(): Promise<Hostel[]> {
  const { data } = await supabase.from('hostels').select('id, name, campus:campuses!campus_id(name)').order('name')
  return (data ?? []).map((h) => ({ id: h.id, name: h.name, campus: (h.campus as unknown as { name: string } | null)?.name ?? '' }))
}

export async function getScopedHostels(viewer: Viewer): Promise<Hostel[]> {
  let ids: string[] | null = null
  if (viewer.role !== 'admin') {
    const { data } = await supabase.from('hostel_assignments').select('hostel_id').eq('user_id', viewer.id)
    ids = (data ?? []).map((r) => r.hostel_id)
    if (!ids.length) return []
  }
  let q = supabase.from('hostels').select('id, name, campus:campuses!campus_id(name)').order('name')
  if (ids) q = q.in('id', ids)
  const { data, error } = await q
  if (error) throw new Error(rpcErrorMessage(error))
  return (data ?? []).map((h) => ({ id: h.id, name: h.name, campus: (h.campus as unknown as { name: string } | null)?.name ?? '' }))
}

export async function getDepartureQueue(hostelId: string, now = Date.now(), withinHours = 24): Promise<QueueItem[]> {
  const { data, error } = await supabase
    .from('listings')
    .select('id, title, status, departure_at, owner_id, category_slug')
    .eq('hostel_id', hostelId)
    .in('status', ['ACTIVE', 'WITHDRAWN'])
    .not('departure_at', 'is', null)
    .lte('departure_at', new Date(now + withinHours * 3_600_000).toISOString())
    .order('departure_at')
    .limit(100)
  if (error) throw new Error(rpcErrorMessage(error))
  return (data ?? []) as QueueItem[]
}

export async function getStaffTransfers(hostelIds: string[]): Promise<ScopedStaffTransfer[]> {
  if (!hostelIds.length) return []
  const { data, error } = await supabase
    .from('staff_transfers')
    .select('id, status, routed_at, accepted_at, owner_id, accepted_by, hostel_id, listing:listings!listing_id!inner(id, title, category_slug)')
    .in('hostel_id', hostelIds)
    .order('routed_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(rpcErrorMessage(error))
  return (data ?? []) as unknown as ScopedStaffTransfer[]
}

export async function routeToStaff(listingId: string): Promise<void> {
  const { error } = await supabase.rpc('route_to_staff', { p_listing: listingId })
  if (error) throw new Error(rpcErrorMessage(error))
}

export async function getImpact(hostelId: string) {
  const { data, error } = await supabase.rpc('impact_summary', { p_hostel: hostelId })
  if (error) return null
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, string | number> | undefined
  if (!r) return null
  return {
    itemsDiverted: Number(r.items_diverted),
    rentalsCompleted: Number(r.rentals_completed),
    co2eKg: Number(r.co2e_avoided_kg),
    wasteKg: Number(r.waste_diverted_kg),
  }
}

export async function getNoDues(hostelId: string): Promise<NoDuesRow[]> {
  const { data, error } = await supabase.rpc('no_dues_report', { p_hostel: hostelId })
  if (error) return []
  return (data ?? []) as NoDuesRow[]
}

export async function getOpenReports(hostelIds: string[]): Promise<OpenReport[]> {
  if (!hostelIds.length) return []
  const { data, error } = await supabase
    .from('listing_reports')
    .select('id, reason, details, created_at, listing:listings!listing_id!inner(id, title, status, hostel_id)')
    .eq('status', 'OPEN')
    .in('listing.hostel_id', hostelIds)
    .order('created_at', { ascending: true })
    .limit(100)
  if (error) throw new Error(rpcErrorMessage(error))
  return (data ?? []) as unknown as OpenReport[]
}

export async function getProfilePrivate(userId: string) {
  const { data, error } = await supabase
    .from('profile_private')
    .select('block, room, phone, departure_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(rpcErrorMessage(error))
  return data
}

export async function saveSettings(
  userId: string,
  input: {
    fullName: string
    hostelId: string | null
    block: string | null
    room: string | null
    phone: string | null
    departureAt: string | null
  },
) {
  const [p1, p2] = await Promise.all([
    supabase.from('profiles').update({ full_name: input.fullName.trim(), hostel_id: input.hostelId }).eq('id', userId),
    supabase
      .from('profile_private')
      .update({
        block: input.block?.trim() || null,
        room: input.room?.trim() || null,
        phone: input.phone?.trim() || null,
        departure_at: input.departureAt,
      })
      .eq('user_id', userId),
  ])
  if (p1.error || p2.error) throw new Error(rpcErrorMessage(p1.error ?? p2.error))
}

export async function getAdminRolesData(viewerId: string) {
  const [hostels, people, assignments, audit] = await Promise.all([
    getAllHostels(),
    supabase.from('profiles').select('id, full_name, role').neq('id', viewerId).order('full_name').limit(500),
    supabase.from('hostel_assignments').select('user_id, hostel_id'),
    supabase
      .from('audit_events')
      .select('id, action, entity_id, details, created_at')
      .eq('action', 'role.set')
      .order('created_at', { ascending: false })
      .limit(20),
  ])
  return {
    hostels,
    people: (people.data ?? []) as { id: string; full_name: string; role: Role }[],
    assignments: (assignments.data ?? []) as { user_id: string; hostel_id: string }[],
    audit: (audit.data ?? []) as { id: string; action: string; entity_id: string | null; details: { from?: string; to?: string }; created_at: string }[],
  }
}

export async function adminSetRole(userId: string, role: Role, hostels: string[]) {
  const { error } = await supabase.rpc('admin_set_role', { p_user: userId, p_role: role, p_hostels: hostels })
  if (error) throw new Error(rpcErrorMessage(error))
}
