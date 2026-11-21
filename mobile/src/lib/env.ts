export function publicEnv() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in RIO/mobile/.env')
  }
  return {
    EXPO_PUBLIC_SUPABASE_URL: url.replace(/\/$/, ''),
    EXPO_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  }
}

export function listingMediaUrl(path: string): string {
  const base = publicEnv().EXPO_PUBLIC_SUPABASE_URL
  return `${base}/storage/v1/object/public/listing-media/${path.split('/').map(encodeURIComponent).join('/')}`
}
