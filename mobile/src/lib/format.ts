const TZ = 'Asia/Kolkata'
const IST_OFFSET_MS = 5.5 * 3_600_000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function safeFormatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat | null {
  try {
    return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, ...options })
  } catch {
    return null
  }
}

const dateTimeFmt = safeFormatter({ day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const dateOnlyFmt = safeFormatter({ day: 'numeric', month: 'short', year: 'numeric' })
const timeOnlyFmt = safeFormatter({ hour: 'numeric', minute: '2-digit' })

function istParts(d: Date) {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS)
  const year = shifted.getUTCFullYear()
  const month = shifted.getUTCMonth()
  const day = shifted.getUTCDate()
  const hour24 = shifted.getUTCHours()
  const minute = shifted.getUTCMinutes()
  const ampm = hour24 >= 12 ? 'pm' : 'am'
  const hour12 = hour24 % 12 || 12
  return {
    year,
    monthNum: String(month + 1).padStart(2, '0'),
    monthShort: MONTHS[month],
    day,
    dayPad: String(day).padStart(2, '0'),
    hour24Pad: String(hour24).padStart(2, '0'),
    hour12,
    minPad: String(minute).padStart(2, '0'),
    ampm,
  }
}

export function formatDateTime(d: Date | string | number): string {
  const date = new Date(d)
  if (dateTimeFmt) {
    try {
      return `${dateTimeFmt.format(date)} IST`
    } catch {
      // fall through
    }
  }
  const p = istParts(date)
  return `${p.day} ${p.monthShort}, ${p.hour12}:${p.minPad} ${p.ampm} IST`
}

export function formatDate(d: Date | string | number): string {
  const date = new Date(d)
  if (dateOnlyFmt) {
    try {
      return dateOnlyFmt.format(date)
    } catch {
      // fall through
    }
  }
  const p = istParts(date)
  return `${p.day} ${p.monthShort} ${p.year}`
}

export function formatTime(d: Date | string | number): string {
  const date = new Date(d)
  if (timeOnlyFmt) {
    try {
      return `${timeOnlyFmt.format(date)} IST`
    } catch {
      // fall through
    }
  }
  const p = istParts(date)
  return `${p.hour12}:${p.minPad} ${p.ampm} IST`
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return hours ? `${days}d ${hours}h` : `${days}d`
  if (hours > 0) return minutes ? `${hours}h ${minutes}m` : `${hours}h`
  return `${minutes}m`
}

/** Value for IST input string ("YYYY-MM-DDTHH:mm"). */
export function toISTLocalInput(d: Date | string): string {
  const p = istParts(new Date(d))
  return `${p.year}-${p.monthNum}-${p.dayPad}T${p.hour24Pad}:${p.minPad}`
}

/** Parses an IST input string ("YYYY-MM-DDTHH:mm" or "YYYY-MM-DD HH:mm") into a Date. */
export function fromISTLocalInput(value: string): Date | null {
  const normalized = value.trim().replace(' ', 'T')
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) return null
  const d = new Date(`${normalized}:00+05:30`)
  return Number.isNaN(d.getTime()) ? null : d
}
