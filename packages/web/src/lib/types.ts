/**
 * OpenCoop Frontend Types
 *
 * Duplicated from @opencoop/shared for frontend independence.
 * These match the backend API contract exactly.
 */

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

export interface Restaurant {
  id: string;
  userId: string;
  name: string;
  description: string;
  address: Address;
  phone: string;
  isOpen: boolean;
  openingHours: Record<string, { open: string; close: string } | null>;
  averagePrepTime: number;
  createdAt: string;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
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

export interface JobBoardEntry {
  orderId: string;
  restaurantName: string;
  pickupLocation: GeoLocation;
  deliveryLocation: GeoLocation;
  estimatedDistance: number;
  deliveryFee: number;
  tip: number;
  estimatedReadyAt: string;
  postedAt: string;
}

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

export interface PoolState {
  balance: number;
  dailyMinimumGuarantee: number;
  contributionRate: number;
  infraFeeRate: number;
  lastUpdated: string;
}

export interface PoolLedgerEntry {
  id: string;
  type: string;
  amount: number;
  description: string;
  orderId: string | null;
  workerId: string | null;
  createdAt: string;
}

export interface WorkerDailyEarnings {
  deliveriesCompleted: number;
  totalEarnings: number;
  deliveryFees: number;
  tips: number;
  poolTopup: number;
  hoursOnline: number;
}

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

export interface SystemParameters {
  baseDeliveryFee: number;
  perKmRate: number;
  poolContributionRate: number;
  infraFeeRate: number;
  dailyMinimumGuarantee: number;
  defaultQuorum: number;
  votingPeriodHours: number;
  restaurantAcceptTimeout: number;
  workerPickupTimeout: number;
}

export interface EventLogEntry {
  id: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  hash: string;
  previousHash: string | null;
}

export interface AuthResponse {
  userId: string;
  email: string;
  name?: string;
  role: UserRole;
  token: string;
}
