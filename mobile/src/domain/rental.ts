import { applyBps, roundHalfUpDiv, BPS_DENOMINATOR, type Paise } from './money'
import { HOUR_MS } from './pricing'

export const RENTAL_PERIODS = {
  DAY: { bps: 200, hours: 24, label: 'Day' },
  WEEK: { bps: 1_000, hours: 168, label: 'Week' },
  MONTH: { bps: 2_500, hours: 720, label: 'Month' },
} as const

export type RentalPeriod = keyof typeof RENTAL_PERIODS
export const RENTAL_PERIOD_KEYS = Object.keys(RENTAL_PERIODS) as RentalPeriod[]

export const DEPOSIT_BPS = 2_000
export const RENT_TO_OWN_CREDIT_BPS = 5_000
export const DAMAGE_DEDUCTION_BPS = 2_500
export const RENTAL_RETURN_BUFFER_MS = 24 * HOUR_MS

export function rentalCostPaise(startPaise: Paise, period: RentalPeriod): Paise {
  return applyBps(startPaise, RENTAL_PERIODS[period].bps)
}

export function rentalDepositPaise(startPaise: Paise): Paise {
  return applyBps(startPaise, DEPOSIT_BPS)
}

export function rentalDurationMs(period: RentalPeriod): number {
  return RENTAL_PERIODS[period].hours * HOUR_MS
}

export type RentEligibility = { ok: true } | { ok: false; reason: string; neededHours: number; remainingHours: number }

export function canRentBeforeDeparture(departureAt: Date | number | null, now: Date | number, period: RentalPeriod): RentEligibility {
  if (departureAt === null) return { ok: true }
  const remaining = +departureAt - +now
  const needed = rentalDurationMs(period) + RENTAL_RETURN_BUFFER_MS
  if (remaining >= needed) return { ok: true }
  const neededHours = needed / HOUR_MS
  const remainingHours = Math.max(0, Math.floor(remaining / HOUR_MS))
  return {
    ok: false,
    neededHours,
    remainingHours,
    reason: `The owner leaves too soon for a ${RENTAL_PERIODS[period].label.toLowerCase()} rental: ${neededHours}h needed, ${remainingHours}h left.`,
  }
}

export interface RentalQuote {
  period: RentalPeriod
  rentPaise: Paise
  depositPaise: Paise
  totalDuePaise: Paise
}

export function quoteRental(startPaise: Paise, period: RentalPeriod): RentalQuote {
  const rentPaise = rentalCostPaise(startPaise, period)
  const depositPaise = rentalDepositPaise(startPaise)
  return { period, rentPaise, depositPaise, totalDuePaise: rentPaise + depositPaise }
}

export interface RentToOwnQuote {
  currentPricePaise: Paise
  floorPaise: Paise
  rentPaidPaise: Paise
  earnedCreditPaise: Paise
  appliedCreditPaise: Paise
  buyPricePaise: Paise
  floorApplied: boolean
}

export function quoteRentToOwn(currentPricePaise: Paise, floorPaise: Paise, rentPaidPaise: Paise): RentToOwnQuote {
  const earnedCreditPaise = roundHalfUpDiv(rentPaidPaise * RENT_TO_OWN_CREDIT_BPS, BPS_DENOMINATOR)
  const uncapped = currentPricePaise - earnedCreditPaise
  const buyPricePaise = Math.max(floorPaise, uncapped)
  return {
    currentPricePaise,
    floorPaise,
    rentPaidPaise,
    earnedCreditPaise,
    appliedCreditPaise: Math.max(0, currentPricePaise - buyPricePaise),
    buyPricePaise,
    floorApplied: uncapped < floorPaise,
  }
}

export interface DepositSettlement {
  depositPaise: Paise
  deductionPaise: Paise
  refundPaise: Paise
}

export function settleDeposit(depositPaise: Paise, damaged: boolean): DepositSettlement {
  const deductionPaise = damaged ? Math.min(depositPaise, applyBps(depositPaise, DAMAGE_DEDUCTION_BPS)) : 0
  return { depositPaise, deductionPaise, refundPaise: depositPaise - deductionPaise }
}
