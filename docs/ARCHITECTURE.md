# OpenCoop: Decentralised Food Delivery Platform

## Architecture Document v1.0

---

## Philosophy

OpenCoop is a trust-minimised food delivery protocol designed around three axioms:

1. **No extraction** — Restaurants pay zero commission. Workers earn dignified income.
2. **No coercion** — Workers choose jobs freely. No hidden rankings or penalties.
3. **No opacity** — Every money flow, every decision, every dispute is auditable.

The system is designed as a **protocol**, not a platform. Any cooperative can run
an instance. Future federation (via BECKN or similar) enables interoperability.

---

## System Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │              CLIENT LAYER                   │
                    │                                             │
                    │  ┌──────────┐ ┌────────────┐ ┌──────────┐  │
                    │  │ Customer │ │ Restaurant │ │  Worker  │  │
                    │  │ Web App  │ │ Dashboard  │ │   App    │  │
                    │  │ (Next.js)│ │ (Next.js)  │ │(Next.js) │  │
                    │  └────┬─────┘ └─────┬──────┘ └────┬─────┘  │
                    └───────┼─────────────┼─────────────┼────────┘
                            │             │             │
                            ▼             ▼             ▼
                    ┌─────────────────────────────────────────────┐
                    │              API GATEWAY                    │
                    │         (Express + Auth Middleware)         │
                    └────────────────────┬────────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────────┐
                    │         MODULAR MONOLITH (Node.js/TS)       │
                    │                                             │
                    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
                    │  │  Order   │  │  Escrow  │  │  Worker  │  │
                    │  │ Service  │  │ Service  │  │ Matching │  │
                    │  │          │  │          │  │ Service  │  │
                    │  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
                    │       │             │             │         │
                    │  ┌────┴─────┐  ┌────┴─────┐  ┌───┴──────┐ │
                    │  │Restaurant│  │Governance│  │Reputation│ │
                    │  │ Service  │  │ Service  │  │ Service  │ │
                    │  └──────────┘  └──────────┘  └──────────┘ │
                    │                                             │
                    │       ┌─────────────────────────┐          │
                    │       │   EVENT BUS (in-process) │          │
                    │       │  EventEmitter + DB write │          │
                    │       └────────────┬────────────┘          │
                    └────────────────────┼────────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────────┐
                    │              DATA LAYER                     │
                    │                                             │
                    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
                    │  │PostgreSQL│  │  Redis   │  │  Event   │  │
                    │  │(Entities)│  │(Job Board│  │   Log    │  │
                    │  │          │  │ + Cache) │  │(Append-  │  │
                    │  │          │  │          │  │  only)   │  │
                    │  └──────────┘  └──────────┘  └──────────┘  │
                    └─────────────────────────────────────────────┘
```

---

## Key Architecture Decisions

### 1. Modular Monolith (not Microservices)

**Decision**: Single deployable with strict module boundaries.

**Rationale**: For ~100 restaurants and ~300 workers, microservices add
operational complexity (k8s, service mesh, distributed tracing) without benefit.
Clear module boundaries allow extraction later if needed.

Each module:
- Has its own directory under `src/modules/`
- Exports only through a public API (`index.ts`)
- Communicates with other modules ONLY through the event bus
- Has its own database tables (logical separation)

### 2. Hybrid Event Architecture (not full Event Sourcing)

**Decision**: CRUD for operational state + append-only event log for audit trail.

**Rationale**: Full event sourcing (deriving all state from events) is powerful
but adds significant complexity for a pilot. Instead:

- **Operational tables** (orders, users, etc.) use standard CRUD
- **Event log** is append-only, records every state change
- **Hash chain** links events cryptographically for tamper-evidence
- Events are the **source of truth for auditing**, not for state

This gives us 80% of event sourcing's auditability at 30% of the complexity.

### 3. Escrow as a State Machine (within Order Service)

**Decision**: Escrow is a state within the order lifecycle, not a separate service.

**Rationale**: At pilot scale, a separate escrow service is over-engineering.
The order's payment state machine handles:

```
CREATED → PAYMENT_HELD → RESTAURANT_ACCEPTED → WORKER_ASSIGNED →
PICKED_UP → DELIVERED → SETTLED
                     ↘ DISPUTED → RESOLVED → SETTLED/REFUNDED
```

Payment processor (Stripe Connect) handles actual fund holding via
`capture_method: 'manual'`. We capture only on delivery confirmation.

### 4. Redis Job Board (not Queue)

**Decision**: Redis sorted set as a real-time job board, not a queue.

**Rationale**: A queue implies jobs are "assigned" — the opposite of worker
autonomy. Instead:
- Available jobs sit in a Redis sorted set (scored by creation time)
- ALL workers see ALL available jobs in their zone
- Workers explicitly claim a job (optimistic locking via Redis WATCH)
- Race conditions resolved by first-successful-claim wins
- No hidden priority, no penalty for not claiming

### 5. SHA-256 Hash Chain for Auditability

**Decision**: Linear hash chain in PostgreSQL, not Merkle trees.

**Rationale**: Merkle trees are useful for partial verification (like Bitcoin
SPV). We don't need partial verification — auditors read the full log.
A simple chain where each event's hash includes the previous hash is:
- Trivial to implement
- Trivial to verify (iterate and re-hash)
- Sufficient for tamper-evidence

### 6. Cooperative Governance as Code

**Decision**: On-chain-style governance with proposal/vote/execute pattern.

**Rationale**: Governance decisions (fee changes, pool rules, dispute policies)
must be:
- Proposed by any member
- Voted on with 1-member-1-vote
- Executed automatically if quorum + majority reached
- Logged immutably in the event log

---

## Order Lifecycle

```
  Customer                    System                Restaurant              Worker
     │                          │                       │                     │
     │  1. Place Order          │                       │                     │
     │─────────────────────────>│                       │                     │
     │                          │                       │                     │
     │  2. Hold Payment         │                       │                     │
     │  (Stripe manual capture) │                       │                     │
     │<─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│                       │                     │
     │                          │                       │                     │
     │                          │  3. Notify Restaurant │                     │
     │                          │──────────────────────>│                     │
     │                          │                       │                     │
     │                          │  4. Accept/Reject     │                     │
     │                          │<──────────────────────│                     │
     │                          │                       │                     │
     │                          │  5. Post to Job Board │                     │
     │                          │  (Redis sorted set)   │                     │
     │                          │──────────────────────────────────────────> │
     │                          │                       │                     │
     │                          │  6. Worker Claims Job │                     │
     │                          │<──────────────────────────────────────────│
     │                          │                       │                     │
     │                          │  7. Worker Picks Up   │                     │
     │                          │<──────────────────────────────────────────│
     │                          │                       │                     │
     │                          │  8. Delivery Confirmed│                     │
     │                          │  (timestamp + geo +   │                     │
     │                          │   photo/signature)    │                     │
     │                          │<──────────────────────────────────────────│
     │                          │                       │                     │
     │                          │  9. Auto-Settle       │                     │
     │                          │  ┌─────────────────┐  │                     │
     │                          │  │ Restaurant: 100% │  │                     │
     │                          │  │ menu price       │──>                     │
     │                          │  │ Worker: delivery │                       │
     │                          │  │ fee + pool top-up│──────────────────────>│
     │                          │  │ Coop: infra fee  │  │                     │
     │                          │  └─────────────────┘  │                     │
     │                          │                       │                     │
```

---

## Money Flow (Zero Commission Model)

```
Customer pays: ₹500 (food) + ₹50 (delivery fee) + ₹10 (tip) = ₹560

Settlement breakdown:
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Restaurant receives: ₹500 (100% of menu price)         │
│                                                          │
│  Worker receives: ₹40 (base delivery fee)                │
│                 + ₹10 (tip, 100% pass-through)           │
│                 + ₹X  (pool top-up if below daily min)   │
│                                                          │
│  Cooperative pool:                                       │
│    ₹5 (10% of delivery fee → worker guarantee pool)     │
│    ₹5 (10% of delivery fee → infrastructure fund)       │
│                                                          │
│  Payment processor: ~₹16 (2.9% + ₹0.30 per txn)        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Pool Economics

The **Worker Guarantee Pool** ensures daily minimum earnings:

1. Each delivery contributes 10% of delivery fee to the pool
2. At end of day, workers below the minimum threshold get topped up
3. Pool balance is publicly visible
4. Pool rules are governed by cooperative vote

```
Daily Minimum = ₹600 (governed by cooperative vote)

Worker A earned: ₹800 → no top-up needed
Worker B earned: ₹450 → pool tops up ₹150
Worker C earned: ₹550 → pool tops up ₹50

Pool debit today: ₹200
Pool contributions today: ~₹1500 (from 300 deliveries)
Net pool growth: ₹1300
```

---

## Event Types (Domain Events)

### Order Events
- `order.created` — Customer placed order
- `order.payment_held` — Payment authorized (not captured)
- `order.restaurant_accepted` — Restaurant confirmed
- `order.restaurant_rejected` — Restaurant declined
- `order.posted_to_board` — Available for worker pickup
- `order.worker_claimed` — Worker accepted delivery
- `order.picked_up` — Worker collected from restaurant
- `order.delivered` — Delivery confirmed with proof
- `order.settled` — All payments distributed
- `order.cancelled` — Order cancelled (various reasons)
- `order.disputed` — Dispute raised
- `order.dispute_resolved` — Dispute settled

### Payment Events
- `payment.authorized` — Funds held in escrow
- `payment.captured` — Funds captured from customer
- `payment.restaurant_transferred` — Restaurant paid
- `payment.worker_transferred` — Worker paid
- `payment.coop_fee_collected` — Infrastructure fee collected
- `payment.refunded` — Full or partial refund
- `payment.pool_contribution` — Delivery fee portion to pool
- `payment.pool_topup` — Worker minimum guarantee payout

### Worker Events
- `worker.registered` — New worker joined
- `worker.went_online` — Started accepting jobs
- `worker.went_offline` — Stopped accepting jobs
- `worker.job_viewed` — Viewed job details (no tracking, just analytics)
- `worker.daily_settled` — End-of-day earnings finalized
- `worker.pool_topup_received` — Minimum guarantee paid

### Governance Events
- `governance.proposal_created` — New proposal submitted
- `governance.vote_cast` — Member voted
- `governance.proposal_passed` — Quorum + majority reached
- `governance.proposal_rejected` — Failed to pass
- `governance.proposal_executed` — Changes applied
- `governance.parameter_changed` — System parameter updated

### Reputation Events
- `reputation.rating_submitted` — Rating given
- `reputation.appeal_filed` — Rating appealed
- `reputation.appeal_resolved` — Appeal outcome

---

## Module Boundaries

```
src/modules/
├── order/           # Order lifecycle, state machine
│   ├── order.service.ts
│   ├── order.routes.ts
│   ├── order.events.ts
│   └── order.types.ts
│
├── escrow/          # Payment hold, capture, settle, refund
│   ├── escrow.service.ts
│   ├── escrow.routes.ts
│   └── escrow.types.ts
│
├── worker/          # Worker profiles, job board, matching
│   ├── worker.service.ts
│   ├── worker.routes.ts
│   ├── jobboard.service.ts
│   └── worker.types.ts
│
├── restaurant/      # Restaurant profiles, menus, availability
│   ├── restaurant.service.ts
│   ├── restaurant.routes.ts
│   └── restaurant.types.ts
│
├── customer/        # Customer profiles, addresses
│   ├── customer.service.ts
│   ├── customer.routes.ts
│   └── customer.types.ts
│
├── governance/      # Proposals, voting, parameter management
│   ├── governance.service.ts
│   ├── governance.routes.ts
│   └── governance.types.ts
│
├── reputation/      # Ratings, appeals, transparency
│   ├── reputation.service.ts
│   ├── reputation.routes.ts
│   └── reputation.types.ts
│
└── events/          # Event log, hash chain, audit
    ├── eventlog.service.ts
    ├── hashchain.service.ts
    └── event.types.ts
```

---

## Security Model

### No God Mode
- No admin endpoint can modify settled transactions
- No admin can override governance votes
- No admin can manipulate worker rankings (there are no rankings)

### Authentication
- JWT tokens with role-based access (customer, restaurant, worker, coop_admin)
- `coop_admin` can only manage operational concerns (not financial)

### Auditability
- Every state change emits an event
- Events are hash-chained (SHA-256)
- Hash chain can be independently verified by any member
- Event log is read-accessible to all cooperative members

### Dispute Resolution
- Any party can raise a dispute
- Disputes freeze the relevant escrow
- Resolution requires evidence submission + coop_admin review
- Resolution is logged and appealable
- No automatic penalties — human review required

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Runtime | Node.js 20 LTS + TypeScript | Type safety, ecosystem |
| Framework | Express.js | Simple, proven, no magic |
| Database | PostgreSQL 16 | JSONB, constraints, reliability |
| Cache/Queue | Redis 7 | Job board, real-time state |
| ORM | Drizzle ORM | Type-safe, SQL-first |
| Validation | Zod | Runtime type validation |
| Auth | JWT + bcrypt | Simple, stateless |
| Payments | Stripe Connect | Escrow via manual capture |
| WebSocket | Socket.io | Real-time job board updates |
| Client | Next.js 14 | SSR, good DX |
| Containerization | Docker Compose | Local development |
