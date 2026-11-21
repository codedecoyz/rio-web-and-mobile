export const LISTING_STATUSES = [
  'ACTIVE',
  'RESERVED',
  'RENTED',
  'SOLD',
  'STAFF_PENDING',
  'STAFF_CUSTODY',
  'WITHDRAWN',
  'DISPUTED',
] as const
export type ListingStatus = (typeof LISTING_STATUSES)[number]

export const CLAIM_STATUSES = ['PENDING_HANDOVER', 'COMPLETED', 'CANCELLED', 'DISPUTED', 'REFUNDED'] as const
export type ClaimStatus = (typeof CLAIM_STATUSES)[number]

export const RENTAL_STATUSES = ['PENDING_PICKUP', 'ACTIVE', 'RETURNED', 'CANCELLED', 'CONVERTED', 'DISPUTED'] as const
export type RentalStatus = (typeof RENTAL_STATUSES)[number]

export const DISPUTE_STATUSES = ['OPEN', 'RESOLVED_REFUND', 'RESOLVED_RELEASE', 'RESOLVED_DAMAGE'] as const
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number]

export const STAFF_TRANSFER_STATUSES = ['PENDING', 'ACCEPTED'] as const
export type StaffTransferStatus = (typeof STAFF_TRANSFER_STATUSES)[number]

export const STATUS_LABELS: Record<ListingStatus | ClaimStatus | RentalStatus | DisputeStatus | StaffTransferStatus, string> = {
  ACTIVE: 'Active',
  RESERVED: 'Reserved',
  RENTED: 'On rent',
  SOLD: 'Sold',
  STAFF_PENDING: 'Routed to staff',
  STAFF_CUSTODY: 'In staff custody',
  WITHDRAWN: 'Withdrawn',
  DISPUTED: 'Disputed',
  PENDING_HANDOVER: 'Awaiting handover',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  PENDING_PICKUP: 'Awaiting pickup',
  RETURNED: 'Returned',
  CONVERTED: 'Bought (rent-to-own)',
  OPEN: 'Open',
  RESOLVED_REFUND: 'Resolved · refunded',
  RESOLVED_RELEASE: 'Resolved · released',
  RESOLVED_DAMAGE: 'Resolved · damage deducted',
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
}
