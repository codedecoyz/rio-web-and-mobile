import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { CATEGORIES, CONDITION_KEYS, type Condition } from '@/domain/catalog'
import { STAFF_CUTOFF_BEFORE_DEPARTURE_MS } from '@/domain/pricing'
import type { ListingStatus } from '@/domain/stateMachine'
import { rpcErrorMessage } from '@/lib/rpc-errors'
import { supabase } from '@/lib/supabase'
import { randomUuid } from '@/lib/uuid'

export const PAGE_SIZE = 12
export const MAX_PHOTOS = 5

export const SORTS = {
  ending: 'Leaving soonest',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  newest: 'Newest',
} as const
export type Sort = keyof typeof SORTS

export interface MarketplaceFilters {
  q?: string
  category?: string
  condition?: Condition
  min?: number
  max?: number
  rentable?: boolean
  sort: Sort
  page: number
}

export interface ListingCardData {
  id: string
  title: string
  status: ListingStatus
  condition: Condition
  is_rentable: boolean
  category_slug: string
  category_name: string
  start_price_paise: number
  floor_price_paise: number
  current_price_paise: number
  listed_at: string
  departure_at: string | null
  hostel_name: string | null
  cover_path: string | null
  cover_alt: string | null
  cover_thumb_path: string | null
}

export interface ListingDetail {
  id: string
  owner_id: string
  title: string
  description: string | null
  status: ListingStatus
  condition: Condition
  is_rentable: boolean
  category_slug: string
  start_price_paise: number
  floor_price_paise: number
  listed_at: string
  departure_at: string | null
  hostel_id: string | null
  category: { name: string; embodied_co2e_kg: number; tare_kg: number; volume_m3: number }
  hostel: { name: string } | null
  media: { id: string; storage_path: string; thumb_path: string | null; alt_text: string; position: number }[]
}

export interface PickedPhoto {
  uri: string
  width?: number
  height?: number
}

const CARD_COLUMNS =
  'id, title, status, condition, is_rentable, category_slug, category_name, start_price_paise, floor_price_paise, current_price_paise, listed_at, departure_at, hostel_name, cover_path, cover_alt, cover_thumb_path'

function normaliseCard(r: Record<string, unknown>): ListingCardData {
  return {
    ...(r as unknown as ListingCardData),
    start_price_paise: Number(r.start_price_paise),
    floor_price_paise: Number(r.floor_price_paise),
    current_price_paise: Number(r.current_price_paise),
  }
}

export async function getMarketplace(filters: MarketplaceFilters, now = Date.now()) {
  const cutoff = new Date(now + STAFF_CUTOFF_BEFORE_DEPARTURE_MS).toISOString()
  let query = supabase
    .from('listing_cards')
    .select(CARD_COLUMNS, { count: 'exact' })
    .eq('status', 'ACTIVE')
    .or(`departure_at.is.null,departure_at.gt.${cutoff}`)

  const q = filters.q?.trim()
  if (q) query = query.textSearch('search', q, { type: 'websearch', config: 'simple' })
  if (filters.category && CATEGORIES.some((c) => c.slug === filters.category)) {
    query = query.eq('category_slug', filters.category)
  }
  if (filters.condition && CONDITION_KEYS.includes(filters.condition)) {
    query = query.eq('condition', filters.condition)
  }
  if (filters.rentable) query = query.eq('is_rentable', true)
  if (filters.min !== undefined) query = query.gte('current_price_paise', filters.min * 100)
  if (filters.max !== undefined) query = query.lte('current_price_paise', filters.max * 100)

  switch (filters.sort) {
    case 'price_asc':
      query = query.order('current_price_paise', { ascending: true }).order('id')
      break
    case 'price_desc':
      query = query.order('current_price_paise', { ascending: false }).order('id')
      break
    case 'newest':
      query = query.order('listed_at', { ascending: false }).order('id')
      break
    default:
      query = query.order('departure_at', { ascending: true, nullsFirst: false }).order('id')
  }

  const from = (filters.page - 1) * PAGE_SIZE
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1)
  if (error) {
    if (error.code === 'PGRST103') return { items: [] as ListingCardData[], total: count ?? 0 }
    throw new Error(rpcErrorMessage(error))
  }
  return { items: (data ?? []).map(normaliseCard), total: count ?? 0 }
}

export async function getMyListings(ownerId: string): Promise<ListingCardData[]> {
  const { data, error } = await supabase
    .from('listing_cards')
    .select(CARD_COLUMNS)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(rpcErrorMessage(error))
  return (data ?? []).map(normaliseCard)
}

export async function getListing(id: string): Promise<ListingDetail | null> {
  const { data, error } = await supabase
    .from('listings')
    .select(
      `id, owner_id, title, description, status, condition, is_rentable, category_slug, start_price_paise, floor_price_paise,
       listed_at, departure_at, hostel_id,
       category:categories!category_slug(name, embodied_co2e_kg, tare_kg, volume_m3),
       hostel:hostels!hostel_id(name),
       media:listing_media!listing_id(id, storage_path, thumb_path, alt_text, position)`,
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(rpcErrorMessage(error))
  if (!data) return null
  const d = data as unknown as ListingDetail
  return {
    ...d,
    start_price_paise: Number(d.start_price_paise),
    floor_price_paise: Number(d.floor_price_paise),
    category: {
      name: d.category.name,
      embodied_co2e_kg: Number(d.category.embodied_co2e_kg),
      tare_kg: Number(d.category.tare_kg),
      volume_m3: Number(d.category.volume_m3),
    },
    media: [...(d.media ?? [])].sort((a, b) => a.position - b.position),
  }
}

export async function getOwnerName(ownerId: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('full_name').eq('id', ownerId).maybeSingle()
  if (!data) return null
  const [first, ...rest] = data.full_name.trim().split(/\s+/)
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first
}

export async function getSavedIds(listingIds: string[]): Promise<Set<string>> {
  if (!listingIds.length) return new Set()
  const { data, error } = await supabase.from('favorites').select('listing_id').in('listing_id', listingIds)
  if (error) return new Set()
  return new Set((data ?? []).map((r) => r.listing_id as string))
}

export async function getSavedListings(): Promise<ListingCardData[]> {
  const { data: favs, error } = await supabase.from('favorites').select('listing_id, created_at').order('created_at', { ascending: false }).limit(100)
  if (error) throw new Error(rpcErrorMessage(error))
  const ids = (favs ?? []).map((f) => f.listing_id as string)
  if (!ids.length) return []
  const { data, error: e2 } = await supabase.from('listing_cards').select(CARD_COLUMNS).in('id', ids)
  if (e2) throw new Error(rpcErrorMessage(e2))
  const byId = new Map((data ?? []).map((r) => [r.id as string, normaliseCard(r)]))
  return ids.map((id) => byId.get(id)).filter((c): c is ListingCardData => Boolean(c))
}

export async function toggleSaved(listingId: string, currentlySaved: boolean): Promise<boolean> {
  const { error } = currentlySaved
    ? await supabase.from('favorites').delete().eq('listing_id', listingId)
    : await supabase.from('favorites').insert({ listing_id: listingId })
  if (error && error.code !== '23505') {
    throw new Error('Couldn’t update your saved items. Try again.')
  }
  return !currentlySaved
}

async function compressPhoto(photo: PickedPhoto, maxWidth: number, compress: number) {
  const ctx = ImageManipulator.manipulate(photo.uri)
  if (!photo.width || photo.width > maxWidth) {
    ctx.resize({ width: maxWidth })
  }
  const ref = await ctx.renderAsync()
  const saved = await ref.saveAsync({ compress, format: SaveFormat.JPEG })
  const response = await fetch(saved.uri)
  return response.arrayBuffer()
}

export async function uploadListingPhotos(
  userId: string,
  listingId: string,
  photos: PickedPhoto[],
  alt: string,
  title: string,
  startPosition: number,
): Promise<string[]> {
  const errors: string[] = []
  let position = startPosition
  const bucket = supabase.storage.from('listing-media')

  for (const photo of photos) {
    try {
      const [fullBuf, thumbBuf] = await Promise.all([compressPhoto(photo, 1200, 0.82), compressPhoto(photo, 480, 0.78)])
      const id = randomUuid()
      const path = `${userId}/${listingId}/${id}.jpg`
      const thumbPath = `${userId}/${listingId}/${id}-thumb.jpg`

      const { error: upErr } = await bucket.upload(path, fullBuf, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' })
      if (upErr) {
        errors.push(`Photo ${position + 1} couldn’t be uploaded.`)
        continue
      }

      const { error: thumbErr } = await bucket.upload(thumbPath, thumbBuf, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' })
      const finalThumbPath = thumbErr ? null : thumbPath

      const baseAlt = (alt || title).trim().slice(0, 180)
      const altText = baseAlt + (photos.length > 1 ? ` (photo ${position + 1})` : '')
      const { error: rowErr } = await supabase.from('listing_media').insert({
        listing_id: listingId,
        storage_path: path,
        thumb_path: finalThumbPath,
        alt_text: altText.length >= 3 ? altText : `${title} photo`,
        position,
      })

      if (rowErr) {
        await bucket.remove([path, ...(finalThumbPath ? [finalThumbPath] : [])])
        errors.push(`Photo ${position + 1} couldn’t be attached.`)
        continue
      }
      position++
    } catch {
      errors.push(`Photo ${position + 1} couldn’t be processed.`)
    }
  }
  return errors
}

export interface ListingMutationPayload {
  title: string
  description: string | null
  category_slug: string
  condition: Condition
  start_price_paise: number
  floor_price_paise: number
  departure_at: string | null
  is_rentable: boolean
  photoAlt: string
  photos: PickedPhoto[]
}

export async function createListing(userId: string, payload: ListingMutationPayload): Promise<{ id: string; uploadErrors: string[] }> {
  const { photoAlt, photos, ...row } = payload
  const { data, error } = await supabase.from('listings').insert(row).select('id').single()
  if (error || !data) throw new Error(rpcErrorMessage(error))
  const uploadErrors = photos.length ? await uploadListingPhotos(userId, data.id, photos, photoAlt, row.title, 0) : []
  return { id: data.id, uploadErrors }
}

export async function updateListing(userId: string, listingId: string, payload: ListingMutationPayload): Promise<{ uploadErrors: string[] }> {
  const { photoAlt, photos, ...row } = payload
  const { count } = await supabase.from('listing_media').select('id', { count: 'exact', head: true }).eq('listing_id', listingId)
  if ((count ?? 0) + photos.length > MAX_PHOTOS) {
    throw new Error(`You can add up to ${MAX_PHOTOS} photos.`)
  }

  const { data, error } = await supabase.from('listings').update(row).eq('id', listingId).select('id')
  if (error) throw new Error(rpcErrorMessage(error))
  if (!data?.length) throw new Error('This listing can’t be edited now (it may be in a transaction).')

  const { data: positions } = await supabase.from('listing_media').select('position').eq('listing_id', listingId)
  const next = Math.max(-1, ...(positions ?? []).map((p) => p.position)) + 1
  const uploadErrors = photos.length ? await uploadListingPhotos(userId, listingId, photos, photoAlt, row.title, next) : []
  return { uploadErrors }
}

export async function deleteListingPhoto(mediaId: string): Promise<void> {
  const { data, error } = await supabase.from('listing_media').delete().eq('id', mediaId).select('storage_path, thumb_path')
  if (error || !data?.length) throw new Error('That photo can’t be removed.')
  const paths = data.flatMap((d) => [d.storage_path, d.thumb_path].filter((p): p is string => Boolean(p)))
  if (paths.length) await supabase.storage.from('listing-media').remove(paths)
}

export async function setListingAvailability(listingId: string, available: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_listing_availability', { p_listing: listingId, p_available: available })
  if (error) throw new Error(rpcErrorMessage(error))
}
