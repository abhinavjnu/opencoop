export const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  created:              ['payment_held', 'cancelled'],
  payment_held:         ['restaurant_accepted', 'restaurant_rejected', 'cancelled'],
  restaurant_accepted:  ['posted_to_board', 'cancelled'],
  restaurant_rejected:  ['cancelled'],
  posted_to_board:      ['worker_claimed', 'cancelled'],
  worker_claimed:       ['picked_up', 'posted_to_board', 'cancelled'],
  picked_up:            ['delivered', 'cancelled'],
  delivered:            ['settled', 'disputed'],
  settled:              ['disputed'],
  cancelled:            [],
  disputed:             ['dispute_resolved'],
  dispute_resolved:     ['settled'],
};

export const DEFAULT_SYSTEM_PARAMETERS = {
  baseDeliveryFee: 4000,       // 40.00 in smallest unit
  perKmRate: 1000,             // 10.00 per km
  poolContributionRate: 10,    // 10% of delivery fee
  infraFeeRate: 10,            // 10% of delivery fee
  dailyMinimumGuarantee: 60000, // 600.00 daily minimum
  defaultQuorum: 30,           // 30% quorum
  votingPeriodHours: 72,       // 3 days
  restaurantAcceptTimeout: 10, // 10 minutes
  workerPickupTimeout: 30,     // 30 minutes
} as const;

export const CURRENCY = 'INR';
export const CURRENCY_UNIT = 100; // 1 INR = 100 paise
