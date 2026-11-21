export const HANDOVER_CODE_LENGTH = 16
export const HANDOVER_TTL_MINUTES = 10
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export const QR_PREFIX = 'RIO:'

export function normalizeHandoverCode(input: string): string | null {
  let s = input.trim()
  if (s.toUpperCase().startsWith(QR_PREFIX)) s = s.slice(QR_PREFIX.length)
  s = s.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
  if (s.length !== HANDOVER_CODE_LENGTH) return null
  for (const ch of s) if (!ALPHABET.includes(ch)) return null
  return s
}

export function formatHandoverCode(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code
}

export function handoverQrPayload(code: string): string {
  return `${QR_PREFIX}${code}`
}
