# AGENTS.md — OpenFood Code Guidelines

Guidelines for AI agents working on the OpenFood cooperative food delivery platform.

## Project Overview

OpenFood is a decentralized, non-extractive food delivery platform. Zero restaurant commission, dignified worker income with daily guarantees, fully auditable operations via immutable event logs.

**Monorepo structure:**
- `packages/backend/` — Express.js API (Node.js 20, TypeScript)
- `packages/web/` — Next.js 14 frontend
- `packages/shared/` — Shared types, events, constants

---

## Build, Test & Lint Commands

### Root Level (from `openfood/`)
```bash
# Development
npm run dev              # Start backend dev server
npm run build            # Build backend
npm run test             # Run all backend tests
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed test data
```

### Backend (from `packages/backend/`)
```bash
# Development
npm run dev              # tsx watch src/server.ts
npm run build            # tsc compile to dist/

# Testing
npm run test             # Run all tests once (vitest run)
npm run test:watch       # Watch mode (vitest)
npx vitest run src/tests/api.integration.test.ts  # Single test file
npx vitest run -t "Health"                        # Run tests matching pattern

# Database
npm run db:migrate       # Run migrations
npm run db:seed          # Seed test accounts
```

### Web (from `packages/web/`)
```bash
npm run dev              # Next.js dev server (port 3000)
npm run build            # Next.js build
npm run lint             # Next.js lint
```

### Shared (from `packages/shared/`)
```bash
npm run build            # tsc compile
npm run test             # vitest run
```

### Infrastructure
```bash
# Start PostgreSQL + Redis
docker compose up -d postgres redis

# Full stack
docker compose up
```

---

## Code Style Guidelines

### TypeScript Configuration
- **Target**: ES2022 (backend), ES2017 (web)
- **Module**: NodeNext (backend), ESNext (web)
- **Strict mode**: Enabled with `noUncheckedIndexedAccess`, `noUnusedLocals`
- Always use `.js` extension on imports (even for TypeScript files)

### Imports & Exports
```typescript
// External imports first
import express from 'express';
import { eq } from 'drizzle-orm';

// Internal imports with .js extension
import { db } from '../../db/index.js';
import { orders } from '../../db/schema.js';

// Type imports with `type` keyword
import type { OrderStatus } from '@openfood/shared';

// Barrel exports from index.ts
export * from './types/domain.js';
export * from './events/domain-events.js';
```

### Naming Conventions
- **Interfaces/Types**: PascalCase (`OrderStatus`, `CreateOrderInput`)
- **Functions/Variables**: camelCase (`createOrder`, `orderId`)
- **Constants**: UPPER_SNAKE_CASE (`ORDER_STATUS_TRANSITIONS`, `CURRENCY`)
- **Files**: kebab-case for multi-word (`order.service.ts`, `domain-events.ts`)
- **Events**: `<aggregate>.<past_tense_verb>` (`order.created`, `payment.captured`)

### Formatting
- 2-space indentation
- Single quotes for strings
- Semicolons required
- 100 character line limit (soft)
- Trailing commas in multi-line objects/arrays

### Error Handling
```typescript
// Use explicit error messages
if (!order) throw new Error('Order not found');
if (!restaurant[0]?.isOpen) throw new Error('Restaurant is currently closed');

// Service-level errors bubble up; routes handle HTTP responses
// Always validate with Zod before processing
```

### Domain Module Structure
```
modules/
  order/
    order.service.ts     # Business logic
    order.routes.ts      # Express routes
  escrow/
    escrow.service.ts
    escrow.routes.ts
    pool.service.ts
```

### Event Sourcing Patterns
Every state change emits an immutable event:
```typescript
await eventBus.emit({
  type: 'order.created',
  aggregateId: orderId,
  aggregateType: 'order',
  actor: { id: customerId, role: 'customer' },
  data: { /* payload */ },
});
```

### State Machines
Use centralized state transition maps:
```typescript
// From @openfood/shared
ORDER_STATUS_TRANSITIONS = {
  created: ['payment_held', 'cancelled'],
  payment_held: ['restaurant_accepted', 'restaurant_rejected', 'cancelled'],
  // ...
};
```

### Database (Drizzle ORM)
```typescript
// Type-safe queries
const result = await db
  .select()
  .from(orders)
  .where(eq(orders.id, orderId))
  .limit(1);

return result[0] ?? null;  // Handle undefined with nullish coalescing
```

### Logging
Use structured logging with Pino:
```typescript
import pino from 'pino';
const logger = pino({ name: 'order-service' });

logger.info({ orderId, total }, 'Order created');
logger.error({ err }, 'Unhandled error');
```

### Testing
```typescript
import { describe, it, expect, beforeAll } from 'vitest';

describe('Order Service', () => {
  it('creates an order with payment held', async () => {
    // Test implementation
  });
});
```

---

## Key Principles

1. **No extraction** — Zero restaurant commissions
2. **No coercion** — Workers see all jobs, reject unlimited
3. **No opacity** — Every change in immutable event log
4. **No god mode** — No admin can override settled transactions
5. **Protocol, not platform** — Code belongs to the commons
6. **Governed by members** — Fee rates set by cooperative vote

---

## Environment Setup

```bash
# 1. Install dependencies
npm install

# 2. Start infrastructure
docker compose up -d postgres redis

# 3. Configure backend
cp packages/backend/.env.example packages/backend/.env

# 4. Migrate and seed
npm run -w packages/backend db:migrate
npm run -w packages/backend db:seed

# 5. Start development
npm run -w packages/backend dev      # Terminal 1 (port 4000)
npm run -w packages/web dev          # Terminal 2 (port 3000)
```

**Test Accounts (seeded):**
- customer@example.com / password123
- restaurant@example.com / password123
- worker@example.com / password123
- admin@example.com / password123
