import {
  pgTable,
  text,
  varchar,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
  serial,
  doublePrecision,
  date,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['customer', 'restaurant', 'worker', 'coop_admin']);

export const orderStatusEnum = pgEnum('order_status', [
  'created', 'payment_held', 'restaurant_accepted', 'restaurant_rejected',
  'posted_to_board', 'worker_claimed', 'picked_up', 'delivered',
  'settled', 'cancelled', 'disputed', 'dispute_resolved',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending', 'authorized', 'captured', 'settled', 'refunded',
  'partially_refunded', 'failed',
]);

export const vehicleTypeEnum = pgEnum('vehicle_type', ['bicycle', 'motorcycle', 'car', 'walk']);

export const proposalStatusEnum = pgEnum('proposal_status', [
  'draft', 'voting', 'passed', 'rejected', 'executed', 'expired',
]);

export const proposalCategoryEnum = pgEnum('proposal_category', [
  'delivery_fee', 'pool_rules', 'dispute_policy', 'membership', 'other',
]);

export const voteChoiceEnum = pgEnum('vote_choice', ['for', 'against', 'abstain']);

// ─── Users ──────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  roleIdx: index('users_role_idx').on(table.role),
  emailIdx: index('users_email_idx').on(table.email),
}));

// ─── Restaurants ────────────────────────────────────

export const restaurants = pgTable('restaurants', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull().default(''),
  street: text('street').notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  postalCode: varchar('postal_code', { length: 20 }).notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  isOpen: boolean('is_open').notNull().default(false),
  openingHours: jsonb('opening_hours').notNull().default({}),
  averagePrepTime: integer('average_prep_time').notNull().default(20),
  averageRating: doublePrecision('average_rating').notNull().default(0),
  ratingCount: integer('rating_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: uniqueIndex('restaurants_user_id_idx').on(table.userId),
  cityIdx: index('restaurants_city_idx').on(table.city),
  locationIdx: index('restaurants_location_idx').on(table.lat, table.lng),
}));

// ─── Menu Items ─────────────────────────────────────

export const menuItems = pgTable('menu_items', {
  id: text('id').primaryKey(),
  restaurantId: text('restaurant_id').notNull().references(() => restaurants.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull().default(''),
  price: integer('price').notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  isAvailable: boolean('is_available').notNull().default(true),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  restaurantIdx: index('menu_items_restaurant_idx').on(table.restaurantId),
  categoryIdx: index('menu_items_category_idx').on(table.restaurantId, table.category),
}));

// ─── Workers ────────────────────────────────────────

export const workers = pgTable('workers', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  vehicleType: vehicleTypeEnum('vehicle_type').notNull(),
  zone: varchar('zone', { length: 100 }).notNull(),
  isOnline: boolean('is_online').notNull().default(false),
  currentLat: doublePrecision('current_lat'),
  currentLng: doublePrecision('current_lng'),
  totalDeliveries: integer('total_deliveries').notNull().default(0),
  averageRating: doublePrecision('average_rating').notNull().default(0),
  ratingCount: integer('rating_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: uniqueIndex('workers_user_id_idx').on(table.userId),
  zoneIdx: index('workers_zone_idx').on(table.zone),
  onlineIdx: index('workers_online_idx').on(table.isOnline),
  locationIdx: index('workers_location_idx').on(table.currentLat, table.currentLng),
}));

// ─── Orders ─────────────────────────────────────────

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => users.id),
  restaurantId: text('restaurant_id').notNull().references(() => restaurants.id),
  workerId: text('worker_id').references(() => workers.id),
  items: jsonb('items').notNull(),
  subtotal: integer('subtotal').notNull(),
  deliveryFee: integer('delivery_fee').notNull(),
  tip: integer('tip').notNull().default(0),
  total: integer('total').notNull(),
  status: orderStatusEnum('status').notNull().default('created'),
  deliveryStreet: text('delivery_street').notNull(),
  deliveryCity: varchar('delivery_city', { length: 100 }).notNull(),
  deliveryPostalCode: varchar('delivery_postal_code', { length: 20 }).notNull(),
  deliveryLat: doublePrecision('delivery_lat').notNull(),
  deliveryLng: doublePrecision('delivery_lng').notNull(),
  estimatedPrepTime: integer('estimated_prep_time'),
  estimatedDeliveryTime: integer('estimated_delivery_time'),
  restaurantAcceptedAt: timestamp('restaurant_accepted_at', { withTimezone: true }),
  workerClaimedAt: timestamp('worker_claimed_at', { withTimezone: true }),
  pickedUpAt: timestamp('picked_up_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  settledAt: timestamp('settled_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancellationReason: text('cancellation_reason'),
  proofPhotoUrl: text('proof_photo_url'),
  signatureConfirmation: boolean('signature_confirmation').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  customerIdx: index('orders_customer_idx').on(table.customerId),
  restaurantIdx: index('orders_restaurant_idx').on(table.restaurantId),
  workerIdx: index('orders_worker_idx').on(table.workerId),
  statusIdx: index('orders_status_idx').on(table.status),
  createdAtIdx: index('orders_created_at_idx').on(table.createdAt),
}));

// ─── Escrow / Payments ──────────────────────────────

export const escrowRecords = pgTable('escrow_records', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id).unique(),
  paymentIntentId: text('payment_intent_id').notNull(),
  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('INR'),
  status: paymentStatusEnum('status').notNull().default('pending'),
  restaurantPayout: integer('restaurant_payout'),
  workerPayout: integer('worker_payout'),
  coopFee: integer('coop_fee'),
  poolContribution: integer('pool_contribution'),
  tipAmount: integer('tip_amount').default(0),
  restaurantTransferId: text('restaurant_transfer_id'),
  workerTransferId: text('worker_transfer_id'),
  refundId: text('refund_id'),
  refundAmount: integer('refund_amount'),
  settledAt: timestamp('settled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderIdx: index('escrow_order_idx').on(table.orderId),
  statusIdx: index('escrow_status_idx').on(table.status),
}));

// ─── Worker Daily Earnings ──────────────────────────

export const workerDailyEarnings = pgTable('worker_daily_earnings', {
  id: serial('id').primaryKey(),
  workerId: text('worker_id').notNull().references(() => workers.id),
  date: date('date').notNull(),
  deliveriesCompleted: integer('deliveries_completed').notNull().default(0),
  deliveryFees: integer('delivery_fees').notNull().default(0),
  tips: integer('tips').notNull().default(0),
  poolTopup: integer('pool_topup').notNull().default(0),
  totalEarnings: integer('total_earnings').notNull().default(0),
  hoursOnline: doublePrecision('hours_online').notNull().default(0),
  isSettled: boolean('is_settled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  workerDateUnique: uniqueIndex('worker_daily_unique').on(table.workerId, table.date),
  dateIdx: index('worker_daily_date_idx').on(table.date),
}));

// ─── Worker Guarantee Pool ──────────────────────────

export const poolLedger = pgTable('pool_ledger', {
  id: serial('id').primaryKey(),
  transactionType: varchar('transaction_type', { length: 50 }).notNull(),
  amount: integer('amount').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  orderId: text('order_id').references(() => orders.id),
  workerId: text('worker_id').references(() => workers.id),
  description: text('description').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  typeIdx: index('pool_ledger_type_idx').on(table.transactionType),
  createdIdx: index('pool_ledger_created_idx').on(table.createdAt),
}));

export const poolState = pgTable('pool_state', {
  id: integer('id').primaryKey().default(1),
  balance: bigint('balance', { mode: 'number' }).notNull().default(0),
  totalContributions: bigint('total_contributions', { mode: 'number' }).notNull().default(0),
  totalTopups: bigint('total_topups', { mode: 'number' }).notNull().default(0),
  lastUpdated: timestamp('last_updated', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Governance ─────────────────────────────────────

export const proposals = pgTable('proposals', {
  id: text('id').primaryKey(),
  proposedBy: text('proposed_by').notNull().references(() => users.id),
  proposerRole: varchar('proposer_role', { length: 20 }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description').notNull(),
  category: proposalCategoryEnum('category').notNull(),
  parameterChange: jsonb('parameter_change'),
  status: proposalStatusEnum('status').notNull().default('draft'),
  votesFor: integer('votes_for').notNull().default(0),
  votesAgainst: integer('votes_against').notNull().default(0),
  abstentions: integer('abstentions').notNull().default(0),
  quorumRequired: integer('quorum_required').notNull().default(30),
  votingStartedAt: timestamp('voting_started_at', { withTimezone: true }),
  votingEndsAt: timestamp('voting_ends_at', { withTimezone: true }),
  executedAt: timestamp('executed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('proposals_status_idx').on(table.status),
  categoryIdx: index('proposals_category_idx').on(table.category),
}));

export const votes = pgTable('votes', {
  id: text('id').primaryKey(),
  proposalId: text('proposal_id').notNull().references(() => proposals.id),
  voterId: text('voter_id').notNull().references(() => users.id),
  voterRole: varchar('voter_role', { length: 20 }).notNull(),
  vote: voteChoiceEnum('vote').notNull(),
  castAt: timestamp('cast_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueVoter: uniqueIndex('votes_unique_voter').on(table.proposalId, table.voterId),
  proposalIdx: index('votes_proposal_idx').on(table.proposalId),
}));

// ─── Reputation ─────────────────────────────────────

export const ratings = pgTable('ratings', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id),
  raterId: text('rater_id').notNull().references(() => users.id),
  raterRole: varchar('rater_role', { length: 20 }).notNull(),
  targetId: text('target_id').notNull(),
  targetRole: varchar('target_role', { length: 20 }).notNull(),
  score: integer('score').notNull(),
  comment: text('comment'),
  isAppealed: boolean('is_appealed').notNull().default(false),
  appealResolution: varchar('appeal_resolution', { length: 20 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  targetIdx: index('ratings_target_idx').on(table.targetId, table.targetRole),
  orderIdx: index('ratings_order_idx').on(table.orderId),
  uniquePerOrder: uniqueIndex('ratings_unique_per_order').on(table.orderId, table.raterId, table.targetId),
}));

// ─── Disputes ───────────────────────────────────────

export const disputes = pgTable('disputes', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id),
  raisedBy: text('raised_by').notNull().references(() => users.id),
  disputeType: varchar('dispute_type', { length: 50 }).notNull(),
  description: text('description').notNull(),
  evidence: jsonb('evidence').notNull().default([]),
  resolution: varchar('resolution', { length: 50 }),
  resolvedBy: text('resolved_by').references(() => users.id),
  refundAmount: integer('refund_amount'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (table) => ({
  orderIdx: index('disputes_order_idx').on(table.orderId),
  statusIdx: index('disputes_status_idx').on(table.resolution),
}));

// ─── Event Log (Append-Only + Hash Chain) ───────────

export const eventLog = pgTable('event_log', {
  id: text('id').primaryKey(),
  sequenceNumber: serial('sequence_number').notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  aggregateId: text('aggregate_id').notNull(),
  aggregateType: varchar('aggregate_type', { length: 50 }).notNull(),
  version: integer('version').notNull(),
  actorId: text('actor_id').notNull(),
  actorRole: varchar('actor_role', { length: 20 }).notNull(),
  data: jsonb('data').notNull(),
  previousHash: text('previous_hash'),
  hash: text('hash').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  aggregateIdx: index('event_log_aggregate_idx').on(table.aggregateId, table.aggregateType),
  typeIdx: index('event_log_type_idx').on(table.eventType),
  sequenceIdx: index('event_log_sequence_idx').on(table.sequenceNumber),
  aggregateVersionUnique: uniqueIndex('event_log_aggregate_version').on(table.aggregateId, table.aggregateType, table.version),
}));

// ─── System Parameters ──────────────────────────────

export const systemParameters = pgTable('system_parameters', {
  id: integer('id').primaryKey().default(1),
  baseDeliveryFee: integer('base_delivery_fee').notNull().default(4000),
  perKmRate: integer('per_km_rate').notNull().default(1000),
  poolContributionRate: integer('pool_contribution_rate').notNull().default(10),
  infraFeeRate: integer('infra_fee_rate').notNull().default(10),
  dailyMinimumGuarantee: integer('daily_minimum_guarantee').notNull().default(60000),
  defaultQuorum: integer('default_quorum').notNull().default(30),
  votingPeriodHours: integer('voting_period_hours').notNull().default(72),
  restaurantAcceptTimeout: integer('restaurant_accept_timeout').notNull().default(10),
  workerPickupTimeout: integer('worker_pickup_timeout').notNull().default(30),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedByProposal: text('updated_by_proposal'),
});
