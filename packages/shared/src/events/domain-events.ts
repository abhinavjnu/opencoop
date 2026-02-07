/**
 * OpenCoop Domain Events
 *
 * Every state change in the system is captured as an immutable event.
 * Events are hash-chained for tamper-evidence.
 *
 * Naming convention: <aggregate>.<past_tense_verb>
 * All events are facts — they describe something that HAS happened.
 */

// ──────────────────────────────────────────────
// Base Event Structure
// ──────────────────────────────────────────────

export interface BaseEvent {
  /** Unique event ID (ULID for time-ordering) */
  id: string;
  /** Event type (e.g., 'order.created') */
  type: string;
  /** Aggregate ID this event belongs to */
  aggregateId: string;
  /** Aggregate type (e.g., 'order', 'payment') */
  aggregateType: string;
  /** Monotonically increasing version within the aggregate */
  version: number;
  /** ISO 8601 timestamp */
  occurredAt: string;
  /** Actor who caused this event */
  actor: {
    id: string;
    role: 'customer' | 'restaurant' | 'worker' | 'system' | 'coop_admin';
  };
  /** Event-specific payload */
  data: Record<string, unknown>;
  /** Previous event hash (for chain integrity) */
  previousHash: string | null;
  /** SHA-256 hash of this event (computed from type + data + previousHash + occurredAt) */
  hash: string;
}

// ──────────────────────────────────────────────
// Order Events
// ──────────────────────────────────────────────

export interface OrderCreatedEvent extends BaseEvent {
  type: 'order.created';
  aggregateType: 'order';
  data: {
    customerId: string;
    restaurantId: string;
    items: Array<{
      menuItemId: string;
      name: string;
      quantity: number;
      unitPrice: number;  // in smallest currency unit (paise/cents)
    }>;
    subtotal: number;
    deliveryFee: number;
    tip: number;
    total: number;
    deliveryAddress: {
      street: string;
      city: string;
      postalCode: string;
      lat: number;
      lng: number;
    };
    estimatedPrepTime: number; // minutes
  };
}

export interface OrderPaymentHeldEvent extends BaseEvent {
  type: 'order.payment_held';
  aggregateType: 'order';
  data: {
    paymentIntentId: string;
    amountHeld: number;
    currency: string;
  };
}

export interface OrderRestaurantAcceptedEvent extends BaseEvent {
  type: 'order.restaurant_accepted';
  aggregateType: 'order';
  data: {
    estimatedPrepTime: number;
    acceptedAt: string;
  };
}

export interface OrderRestaurantRejectedEvent extends BaseEvent {
  type: 'order.restaurant_rejected';
  aggregateType: 'order';
  data: {
    reason: string;
    rejectedAt: string;
  };
}

export interface OrderPostedToBoardEvent extends BaseEvent {
  type: 'order.posted_to_board';
  aggregateType: 'order';
  data: {
    pickupLocation: { lat: number; lng: number };
    deliveryLocation: { lat: number; lng: number };
    estimatedDistance: number; // meters
    deliveryFee: number;
    estimatedReadyAt: string;
  };
}

export interface OrderWorkerClaimedEvent extends BaseEvent {
  type: 'order.worker_claimed';
  aggregateType: 'order';
  data: {
    workerId: string;
    claimedAt: string;
    workerLocation: { lat: number; lng: number };
  };
}

export interface OrderPickedUpEvent extends BaseEvent {
  type: 'order.picked_up';
  aggregateType: 'order';
  data: {
    pickedUpAt: string;
    workerLocation: { lat: number; lng: number };
  };
}

export interface OrderDeliveredEvent extends BaseEvent {
  type: 'order.delivered';
  aggregateType: 'order';
  data: {
    deliveredAt: string;
    workerLocation: { lat: number; lng: number };
    /** Base64-encoded delivery proof photo, or null if signed */
    proofPhotoUrl: string | null;
    /** Customer's signature confirmation */
    signatureConfirmation: boolean;
  };
}

export interface OrderSettledEvent extends BaseEvent {
  type: 'order.settled';
  aggregateType: 'order';
  data: {
    restaurantPayout: number;
    workerPayout: number;
    coopInfraFee: number;
    poolContribution: number;
    tip: number;
    paymentCaptureId: string;
    settledAt: string;
  };
}

export interface OrderCancelledEvent extends BaseEvent {
  type: 'order.cancelled';
  aggregateType: 'order';
  data: {
    cancelledBy: 'customer' | 'restaurant' | 'worker' | 'system';
    reason: string;
    refundAmount: number;
    cancelledAt: string;
  };
}

export interface OrderDisputedEvent extends BaseEvent {
  type: 'order.disputed';
  aggregateType: 'order';
  data: {
    disputedBy: string;
    disputeType: 'quality' | 'missing_items' | 'wrong_order' | 'delivery_issue' | 'payment' | 'other';
    description: string;
    evidence: string[];
  };
}

export interface OrderDisputeResolvedEvent extends BaseEvent {
  type: 'order.dispute_resolved';
  aggregateType: 'order';
  data: {
    resolution: 'full_refund' | 'partial_refund' | 'no_refund' | 'redelivery';
    resolvedBy: string;
    refundAmount: number;
    notes: string;
  };
}

// ──────────────────────────────────────────────
// Payment Events
// ──────────────────────────────────────────────

export interface PaymentAuthorizedEvent extends BaseEvent {
  type: 'payment.authorized';
  aggregateType: 'payment';
  data: {
    orderId: string;
    paymentIntentId: string;
    amount: number;
    currency: string;
    customerId: string;
  };
}

export interface PaymentCapturedEvent extends BaseEvent {
  type: 'payment.captured';
  aggregateType: 'payment';
  data: {
    orderId: string;
    paymentIntentId: string;
    amountCaptured: number;
  };
}

export interface PaymentRestaurantTransferredEvent extends BaseEvent {
  type: 'payment.restaurant_transferred';
  aggregateType: 'payment';
  data: {
    orderId: string;
    restaurantId: string;
    amount: number;
    transferId: string;
  };
}

export interface PaymentWorkerTransferredEvent extends BaseEvent {
  type: 'payment.worker_transferred';
  aggregateType: 'payment';
  data: {
    orderId: string;
    workerId: string;
    amount: number;
    transferId: string;
    includesTip: boolean;
    tipAmount: number;
  };
}

export interface PaymentPoolContributionEvent extends BaseEvent {
  type: 'payment.pool_contribution';
  aggregateType: 'payment';
  data: {
    orderId: string;
    amount: number;
    poolBalanceAfter: number;
  };
}

export interface PaymentPoolTopupEvent extends BaseEvent {
  type: 'payment.pool_topup';
  aggregateType: 'payment';
  data: {
    workerId: string;
    amount: number;
    dailyEarnings: number;
    dailyMinimum: number;
    poolBalanceAfter: number;
    date: string; // YYYY-MM-DD
  };
}

export interface PaymentRefundedEvent extends BaseEvent {
  type: 'payment.refunded';
  aggregateType: 'payment';
  data: {
    orderId: string;
    refundId: string;
    amount: number;
    reason: string;
  };
}

// ──────────────────────────────────────────────
// Worker Events
// ──────────────────────────────────────────────

export interface WorkerRegisteredEvent extends BaseEvent {
  type: 'worker.registered';
  aggregateType: 'worker';
  data: {
    name: string;
    phone: string;
    vehicleType: 'bicycle' | 'motorcycle' | 'car' | 'walk';
    zone: string;
  };
}

export interface WorkerWentOnlineEvent extends BaseEvent {
  type: 'worker.went_online';
  aggregateType: 'worker';
  data: {
    location: { lat: number; lng: number };
    zone: string;
  };
}

export interface WorkerWentOfflineEvent extends BaseEvent {
  type: 'worker.went_offline';
  aggregateType: 'worker';
  data: {
    reason: 'manual' | 'inactivity' | 'end_of_shift';
  };
}

export interface WorkerDailySettledEvent extends BaseEvent {
  type: 'worker.daily_settled';
  aggregateType: 'worker';
  data: {
    date: string;
    deliveriesCompleted: number;
    totalEarnings: number;
    deliveryFees: number;
    tips: number;
    poolTopup: number;
    hoursOnline: number;
  };
}

// ──────────────────────────────────────────────
// Governance Events
// ──────────────────────────────────────────────

export interface GovernanceProposalCreatedEvent extends BaseEvent {
  type: 'governance.proposal_created';
  aggregateType: 'governance';
  data: {
    proposalId: string;
    proposedBy: string;
    proposerRole: 'worker' | 'restaurant';
    title: string;
    description: string;
    category: 'delivery_fee' | 'pool_rules' | 'dispute_policy' | 'membership' | 'other';
    /** What parameter to change, if applicable */
    parameterChange: {
      parameter: string;
      currentValue: unknown;
      proposedValue: unknown;
    } | null;
    votingEndsAt: string;
    quorumRequired: number; // percentage 0-100
  };
}

export interface GovernanceVoteCastEvent extends BaseEvent {
  type: 'governance.vote_cast';
  aggregateType: 'governance';
  data: {
    proposalId: string;
    voterId: string;
    voterRole: 'worker' | 'restaurant';
    vote: 'for' | 'against' | 'abstain';
  };
}

export interface GovernanceProposalPassedEvent extends BaseEvent {
  type: 'governance.proposal_passed';
  aggregateType: 'governance';
  data: {
    proposalId: string;
    votesFor: number;
    votesAgainst: number;
    abstentions: number;
    quorumReached: boolean;
    passedAt: string;
  };
}

export interface GovernanceProposalRejectedEvent extends BaseEvent {
  type: 'governance.proposal_rejected';
  aggregateType: 'governance';
  data: {
    proposalId: string;
    votesFor: number;
    votesAgainst: number;
    abstentions: number;
    reason: 'majority_against' | 'quorum_not_reached' | 'expired';
  };
}

export interface GovernanceProposalExecutedEvent extends BaseEvent {
  type: 'governance.proposal_executed';
  aggregateType: 'governance';
  data: {
    proposalId: string;
    parameterChanged: string;
    oldValue: unknown;
    newValue: unknown;
    executedAt: string;
  };
}

// ──────────────────────────────────────────────
// Reputation Events
// ──────────────────────────────────────────────

export interface ReputationRatingSubmittedEvent extends BaseEvent {
  type: 'reputation.rating_submitted';
  aggregateType: 'reputation';
  data: {
    orderId: string;
    raterId: string;
    raterRole: 'customer' | 'restaurant' | 'worker';
    targetId: string;
    targetRole: 'restaurant' | 'worker';
    score: number; // 1-5
    comment: string | null;
  };
}

export interface ReputationAppealFiledEvent extends BaseEvent {
  type: 'reputation.appeal_filed';
  aggregateType: 'reputation';
  data: {
    ratingId: string;
    appealedBy: string;
    reason: string;
  };
}

export interface ReputationAppealResolvedEvent extends BaseEvent {
  type: 'reputation.appeal_resolved';
  aggregateType: 'reputation';
  data: {
    ratingId: string;
    resolution: 'upheld' | 'removed' | 'modified';
    resolvedBy: string;
    newScore: number | null;
    notes: string;
  };
}

// ──────────────────────────────────────────────
// Union type for all events
// ──────────────────────────────────────────────

export type DomainEvent =
  | OrderCreatedEvent
  | OrderPaymentHeldEvent
  | OrderRestaurantAcceptedEvent
  | OrderRestaurantRejectedEvent
  | OrderPostedToBoardEvent
  | OrderWorkerClaimedEvent
  | OrderPickedUpEvent
  | OrderDeliveredEvent
  | OrderSettledEvent
  | OrderCancelledEvent
  | OrderDisputedEvent
  | OrderDisputeResolvedEvent
  | PaymentAuthorizedEvent
  | PaymentCapturedEvent
  | PaymentRestaurantTransferredEvent
  | PaymentWorkerTransferredEvent
  | PaymentPoolContributionEvent
  | PaymentPoolTopupEvent
  | PaymentRefundedEvent
  | WorkerRegisteredEvent
  | WorkerWentOnlineEvent
  | WorkerWentOfflineEvent
  | WorkerDailySettledEvent
  | GovernanceProposalCreatedEvent
  | GovernanceVoteCastEvent
  | GovernanceProposalPassedEvent
  | GovernanceProposalRejectedEvent
  | GovernanceProposalExecutedEvent
  | ReputationRatingSubmittedEvent
  | ReputationAppealFiledEvent
  | ReputationAppealResolvedEvent;

export type EventType = DomainEvent['type'];
