export type Paise = number

export const PAISE_PER_RUPEE = 100
export const BPS_DENOMINATOR = 10_000
export const MAX_PRICE_PAISE = 100_000 * PAISE_PER_RUPEE

export function assertPaise(value: number, label = 'amount'): asserts value is Paise {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be an integer number of paise, got ${value}`)
  }
}

export function roundHalfUpDiv(numerator: number, denominator: number): number {
  if (denominator <= 0) throw new RangeError('denominator must be positive')
  if (numerator < 0) throw new RangeError('numerator must be non-negative')
  return Math.floor((2 * numerator + denominator) / (2 * denominator))
}

export function applyBps(amount: Paise, bps: number, stepPaise: Paise = PAISE_PER_RUPEE): Paise {
  assertPaise(amount)
  return roundHalfUpDiv(amount * bps, BPS_DENOMINATOR * stepPaise) * stepPaise
}

export function rupeesToPaise(rupees: number): Paise {
  const paise = Math.round(rupees * PAISE_PER_RUPEE)
  assertPaise(paise, 'rupees')
  return paise
}

function formatIndianNumber(rupees: number): string {
  const abs = Math.abs(rupees)
  const fixed = Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace(/\.?0+$/, '')
  const [intPart, decPart] = fixed.split('.')
  let formatted = intPart
  if (intPart.length > 3) {
    const lastThree = intPart.slice(-3)
    const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')
    formatted = `${rest},${lastThree}`
  }
  return `${rupees < 0 ? '-' : ''}₹${decPart ? `${formatted}.${decPart}` : formatted}`
}

let inrFormatter: Intl.NumberFormat | null = null
try {
  inrFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })
} catch {
  inrFormatter = null
}

export function formatINR(paise: Paise): string {
  const rupees = paise / PAISE_PER_RUPEE
  if (inrFormatter) {
    try {
      return inrFormatter.format(rupees)
    } catch {
      return formatIndianNumber(rupees)
    }
  }
  return formatIndianNumber(rupees)
}

export function formatSignedINR(paise: Paise): string {
  if (paise === 0) return formatINR(0)
  return `${paise > 0 ? '+' : '−'}${formatINR(Math.abs(paise))}`
}
