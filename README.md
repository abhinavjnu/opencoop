# OpenCoop — Decentralised, Non-Extractive Food Delivery

A cooperative food delivery platform where restaurants pay **zero commission**, workers earn **dignified income with daily minimum guarantees**, and every rupee is **publicly auditable**.

Inspired by Bitcoin's trust-minimised design: open protocols over closed platforms, local governance with global interoperability.

---

## Why OpenCoop?

Platform capitalism extracts 25–35% commission from restaurants, suppresses worker earnings through algorithmic coercion, and hides money flows behind opaque systems. OpenCoop replaces this with:

| Platform Model | OpenCoop Model |
|---|---|
| 25–35% restaurant commission | **0% commission** — restaurants receive 100% of menu price |
| Algorithmic job assignment + penalties | **Open job board** — workers see ALL jobs, reject unlimited, zero penalties |
| Hidden pricing & surge | **Transparent fees** — every charge breakdown visible |
| Investor-driven governance | **Cooperative governance** — one member, one vote |
| Opaque operations | **Immutable event log** — SHA-256 hash chain, auditable by anyone |

---

## Architecture

**Modular monolith** with strict module boundaries, designed for a pilot city (~100 restaurants, ~300 workers).

```
┌──────────────────────────────────────────────┐
│                CLIENT LAYER                   │
│  Customer App · Restaurant Dashboard · Worker │
│               (Next.js 14)                    │
└───────────────────┬──────────────────────────┘
                    │ REST API
┌───────────────────┼──────────────────────────┐
│          MODULAR MONOLITH (Node.js/TS)        │
│                                               │
│  Order · Escrow · Worker · Restaurant         │
│  Governance · Reputation · Events             │
│                                               │
│       Event Bus (in-process EventEmitter)      │
│       → persists to append-only event log     │
└───────────────────┼──────────────────────────┘
                    │
┌───────────────────┼──────────────────────────┐
│              DATA LAYER                       │
│  PostgreSQL 16 · Redis 7 · Event Log          │
└──────────────────────────────────────────────┘
```

Key decisions:
- **Modular monolith** over microservices — right-sized for pilot scale
- **Hybrid events** — CRUD for operational state, append-only log for audit trail
- **Redis job board** — sorted set, not a queue (workers choose, not the algorithm)
- **SHA-256 hash chain** — each event links to the previous, tamper-evident by design
- **Governance as code** — proposal → vote → auto-execute pattern

Full architecture details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

---

## Economics — Where the Money Goes

```
Customer pays: ₹500 (food) + ₹50 (delivery) + ₹10 (tip) = ₹560

 ┌─────────────────────────────────────────────────────┐
 │  Restaurant receives:  ₹500  (100% of food price)   │
 │  Worker receives:      ₹40   (80% of delivery fee)  │
 │                      + ₹10   (100% of tip)           │
 │  Worker guarantee pool: ₹5   (10% of delivery fee)  │
 │  Coop infrastructure:   ₹5   (10% of delivery fee)  │
 └─────────────────────────────────────────────────────┘
```

### Worker Guarantee Pool

Workers are guaranteed a **daily minimum** (₹600, governed by cooperative vote):

- Each delivery contributes 10% of delivery fee to a shared pool
- At end of day, workers earning below the minimum are topped up from the pool
- Pool balance, transactions, and rules are publicly visible on the Transparency Dashboard
- Pool parameters are governed by cooperative vote — not by management

### Delivery Fee Calculation

```
deliveryFee = baseFee + (perKmRate × distance_in_km)
```

All values (baseFee, perKmRate) are system parameters governed by cooperative vote.

---

## Running Locally

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ and npm 9+

### Quick Start

```bash
# 1. Clone and install
git clone <repo>
cd opencoop
npm install

# 2. Start infrastructure (PostgreSQL + Redis)
docker compose up -d postgres redis

# 3. Set up environment
cp packages/backend/.env.example packages/backend/.env

# 4. Run database migrations + seed data
npm run -w packages/backend migrate

# 5. Start the backend
npm run -w packages/backend dev

# 6. Start the frontend (separate terminal)
npm run -w packages/web dev
```

Backend runs on `http://localhost:4000`, frontend on `http://localhost:3000`.

### Docker Compose (full stack)

```bash
docker compose up
```

This starts PostgreSQL, Redis, and the backend service.

### Test Accounts (seeded)

| Role | Email | Password |
|------|-------|----------|
| Customer | customer@example.com | password123 |
| Restaurant | restaurant@example.com | password123 |
| Worker | worker@example.com | password123 |
| Admin | admin@example.com | password123 |

---

## API Reference

All endpoints are prefixed with `/api`.

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login, returns JWT |

### Restaurants
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/restaurants` | List all restaurants |
| GET | `/restaurants/:id` | Get restaurant details |
| GET | `/restaurants/:id/menu` | Get restaurant menu |
| PUT | `/restaurants/:id/status` | Toggle open/closed |
| POST | `/restaurants/:id/menu` | Add menu item |
| PUT | `/restaurants/:id/menu/:itemId` | Update menu item |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/orders` | Create order (customer) |
| GET | `/orders` | List user's orders |
| GET | `/orders/:id` | Get order details |
| POST | `/orders/:id/accept` | Restaurant accepts |
| POST | `/orders/:id/reject` | Restaurant rejects |
| POST | `/orders/:id/claim` | Worker claims delivery |
| POST | `/orders/:id/pickup` | Worker confirms pickup |
| POST | `/orders/:id/deliver` | Worker confirms delivery |
| POST | `/orders/:id/cancel` | Cancel order |

### Workers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workers/me` | Get worker profile |
| GET | `/workers/jobs` | Browse available jobs |
| POST | `/workers/online` | Go online |
| POST | `/workers/offline` | Go offline |
| POST | `/workers/location` | Update location |
| GET | `/workers/earnings` | Earnings history |
| GET | `/workers/earnings/today` | Today's earnings |

### Governance
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/governance/proposals` | All proposals |
| GET | `/governance/proposals/active` | Active proposals |
| GET | `/governance/proposals/:id` | Proposal detail + votes |
| POST | `/governance/proposals` | Create proposal |
| POST | `/governance/proposals/:id/vote` | Cast vote |
| POST | `/governance/proposals/:id/tally` | Tally & execute |
| GET | `/governance/parameters` | Current system parameters |

### Transparency
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/escrow/pool` | Pool state (balance, rates) |
| GET | `/escrow/pool/ledger` | Pool transaction ledger |
| GET | `/escrow/order/:orderId` | Escrow record for order |
| GET | `/events/recent` | Recent events |
| GET | `/events/aggregate/:type/:id` | Events for entity |
| GET | `/events/verify/:type/:id` | Verify hash chain |

---

## Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Node.js 20 LTS + TypeScript | Type safety, ecosystem |
| API | Express.js | Simple, proven |
| Database | PostgreSQL 16 | JSONB, constraints, reliability |
| Cache | Redis 7 | Job board, real-time state |
| ORM | Drizzle ORM | Type-safe, SQL-first |
| Validation | Zod | Runtime type validation |
| Auth | JWT + bcrypt | Stateless, simple |
| Payments | Stripe Connect | Escrow via manual capture |
| Frontend | Next.js 14 + Tailwind CSS | SSR, rapid UI development |
| Containers | Docker Compose | Local development |

---

## Project Structure

```
opencoop/
├── docs/ARCHITECTURE.md         # Full architecture document
├── docker-compose.yml            # PostgreSQL, Redis, backend
├── packages/
│   ├── backend/                  # Express API server
│   │   ├── src/
│   │   │   ├── server.ts         # Entry point
│   │   │   ├── config/           # Environment config
│   │   │   ├── db/               # Schema, migrations, seed
│   │   │   ├── middleware/       # JWT auth + role-based access
│   │   │   └── modules/
│   │   │       ├── order/        # Order lifecycle
│   │   │       ├── escrow/       # Payment + pool
│   │   │       ├── worker/       # Job board + profiles
│   │   │       ├── restaurant/   # Menus + status
│   │   │       ├── governance/   # Proposals + voting
│   │   │       ├── customer/     # Auth
│   │   │       └── events/       # Event log + hash chain
│   │   ├── Dockerfile
│   │   └── .env.example
│   ├── shared/                   # Shared types + constants
│   │   └── src/
│   │       ├── types/            # Domain types
│   │       ├── events/           # Domain event definitions
│   │       └── constants/        # State machine, defaults
│   └── web/                      # Next.js frontend
│       └── src/
│           ├── lib/              # API client, auth, utils, types
│           ├── components/       # Shared UI components
│           └── app/
│               ├── customer/     # Browse, order, track
│               ├── restaurant/   # Dashboard, menu management
│               ├── worker/       # Job board, active delivery, earnings
│               ├── governance/   # Proposals, voting
│               └── transparency/ # Pool, parameters, event log
```

---

## Design Principles

1. **No extraction** — Zero restaurant commissions. Workers keep 80%+ of delivery fees plus 100% of tips.
2. **No coercion** — Workers see all jobs, reject unlimited, no hidden rankings, no penalties.
3. **No opacity** — Every money flow, every vote, every state change is in the immutable event log.
4. **No god mode** — No admin can modify settled transactions, override governance, or manipulate rankings.
5. **Protocol, not platform** — Any cooperative can run an instance. The code is the protocol.
6. **Governed by members** — Fee rates, pool rules, dispute policies — all set by cooperative vote.

---

## License

This is a cooperative protocol. The code belongs to the commons.
