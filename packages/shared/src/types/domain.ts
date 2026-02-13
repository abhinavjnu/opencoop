/**
 * OpenFood Shared Types
 *
 * Domain types shared between backend and frontend.
 * These represent the public API contract.
 */

// ──────────────────────────────────────────────
// Enums / Literals
// ──────────────────────────────────────────────

export type UserRole = 'customer' | 'restaurant' | 'worker' | 'coop_admin';

export type OrderStatus =
  | 'created'
  | 'payment_held'
  | 'restaurant_accepted'
  | 'restaurant_rejected'
  | 'posted_to_board'
  | 'worker_claimed'
  | 'picked_up'
  | 'delivered'
  | 'settled'
  | 'cancelled'
  | 'disputed'
  | 'dispute_resolved';

export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'settled'
  | 'refunded'
  | 'partially_refunded'
  | 'failed';

export type VehicleType = 'bicycle' | 'motorcycle' | 'car' | 'walk';

export type ProposalStatus =
  | 'draft'
  | 'voting'
  | 'passed'
  | 'rejected'
  | 'executed'
  | 'expired';

export type ProposalCategory =
  | 'delivery_fee'
  | 'pool_rules'
  | 'dispute_policy'
  | 'membership'
  | 'other';

export type DisputeType =
  | 'quality'
  | 'missing_items'
  | 'wrong_order'
  | 'delivery_issue'
  | 'payment'
  | 'other';

export type DisputeResolution =
  | 'full_refund'
  | 'partial_refund'
  | 'no_refund'
  | 'redelivery';

// ──────────────────────────────────────────────
// Core Entities
// ──────────────────────────────────────────────

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface Address {
  street: string;
  city: string;
  postalCode: string;
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone: string;
  createdAt: string;
  isActive: boolean;
}

export interface Customer extends User {
  role: 'customer';
  defaultAddress: Address | null;
}

export interface Restaurant {
  id: string;
  userId: string;
  name: string;
  description: string;
  address: Address;
  phone: string;
  isOpen: boolean;
  openingHours: {
    [day: string]: { open: string; close: string } | null;
  };
  averagePrepTime: number; // minutes
  createdAt: string;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number; // smallest currency unit
  category: string;
  isAvailable: boolean;
  imageUrl: string | null;
}

export interface Worker {
  id: string;
  userId: string;
  name: string;
  phone: string;
  vehicleType: VehicleType;
  zone: string;
  isOnline: boolean;
  currentLocation: GeoLocation | null;
  totalDeliveries: number;
  averageRating: number;
  createdAt: string;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  customerId: string;
  restaurantId: string;
  workerId: string | null;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  tip: number;
  total: number;
  status: OrderStatus;
  deliveryAddress: Address;
  pickupAddress: Address;
  estimatedPrepTime: number | null;
  estimatedDeliveryTime: number | null;
  createdAt: string;
  updatedAt: string;
}

// ──────────────────────────────────────────────
// Job Board
// ──────────────────────────────────────────────

export interface JobBoardEntry {
  orderId: string;
  restaurantName: string;
  pickupLocation: GeoLocation;
  deliveryLocation: GeoLocation;
  estimatedDistance: number; // meters
  deliveryFee: number;
  tip: number;
  estimatedReadyAt: string;
  postedAt: string;
}

// ──────────────────────────────────────────────
// Payments / Escrow
// ──────────────────────────────────────────────

export interface EscrowRecord {
  id: string;
  orderId: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  restaurantPayout: number | null;
  workerPayout: number | null;
  coopFee: number | null;
  poolContribution: number | null;
  settledAt: string | null;
}

export interface FeeBreakdown {
  subtotal: number;
  deliveryFee: number;
  tip: number;
  total: number;
  /** Breakdown visible to customer */
  transparency: {
    restaurantReceives: number;
    workerReceives: number;
    coopInfraFee: number;
    poolContribution: number;
    paymentProcessing: number;
  };
}

// ──────────────────────────────────────────────
// Worker Pool / Economics
// ──────────────────────────────────────────────

export interface PoolState {
  balance: number;
  dailyMinimumGuarantee: number;
  contributionRate: number;  // percentage of delivery fee
  infraFeeRate: number;      // percentage of delivery fee
  lastUpdated: string;
}

export interface WorkerDailySummary {
  workerId: string;
  date: string;
  deliveriesCompleted: number;
  totalEarnings: number;
  deliveryFees: number;
  tips: number;
  poolTopup: number;
  hoursOnline: number;
}

// ──────────────────────────────────────────────
// Governance
// ──────────────────────────────────────────────

export interface Proposal {
  id: string;
  proposedBy: string;
  proposerRole: 'worker' | 'restaurant';
  title: string;
  description: string;
  category: ProposalCategory;
  parameterChange: {
    parameter: string;
    currentValue: unknown;
    proposedValue: unknown;
  } | null;
  status: ProposalStatus;
  votesFor: number;
  votesAgainst: number;
  abstentions: number;
  quorumRequired: number;
  votingStartedAt: string;
  votingEndsAt: string;
  executedAt: string | null;
  createdAt: string;
}

export interface Vote {
  id: string;
  proposalId: string;
  voterId: string;
  voterRole: 'worker' | 'restaurant';
  vote: 'for' | 'against' | 'abstain';
  castAt: string;
}

// ──────────────────────────────────────────────
// Reputation
// ──────────────────────────────────────────────

export interface Rating {
  id: string;
  orderId: string;
  raterId: string;
  raterRole: 'customer' | 'restaurant' | 'worker';
  targetId: string;
  targetRole: 'restaurant' | 'worker';
  score: number;
  comment: string | null;
  isAppealed: boolean;
  appealResolution: 'upheld' | 'removed' | 'modified' | null;
  createdAt: string;
}

// ──────────────────────────────────────────────
// System Parameters (governed by cooperative)
// ──────────────────────────────────────────────

export interface SystemParameters {
  /** Base delivery fee in smallest currency unit */
  baseDeliveryFee: number;
  /** Per-km rate added to base fee */
  perKmRate: number;
  /** Percentage of delivery fee going to worker guarantee pool (0-100) */
  poolContributionRate: number;
  /** Percentage of delivery fee going to cooperative infrastructure (0-100) */
  infraFeeRate: number;
  /** Daily minimum earnings guarantee for workers */
  dailyMinimumGuarantee: number;
  /** Quorum required for governance votes (percentage 0-100) */
  defaultQuorum: number;
  /** Voting period in hours */
  votingPeriodHours: number;
  /** Maximum time for restaurant to accept order (minutes) */
  restaurantAcceptTimeout: number;
  /** Maximum time for worker to pick up after claiming (minutes) */
  workerPickupTimeout: number;
}
