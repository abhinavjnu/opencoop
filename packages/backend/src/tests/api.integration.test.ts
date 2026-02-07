/**
 * OpenCoop API Integration Tests
 *
 * Tests against a LIVE backend at http://localhost:3000.
 * Requires: PostgreSQL + Redis + backend server running.
 *
 * Run: npx vitest run
 */
import { describe, it, expect, beforeAll } from 'vitest';

const BASE = 'http://localhost:3000';

// ── Helpers ──────────────────────────────────────────────────────────
interface LoginResult {
  userId: string;
  email: string;
  name: string;
  role: string;
  token: string;
}

async function api<T = unknown>(
  path: string,
  opts: {
    method?: string;
    body?: unknown;
    token?: string;
    expectedStatus?: number;
  } = {},
): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = {};
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  if (opts.body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const body = (await res.json()) as T;
  if (opts.expectedStatus !== undefined) {
    expect(res.status).toBe(opts.expectedStatus);
  }
  return { status: res.status, body };
}

async function login(email: string, password = 'password123'): Promise<LoginResult> {
  const { body } = await api<LoginResult>('/api/auth/login', {
    body: { email, password },
    expectedStatus: 200,
  });
  expect(body.token).toBeDefined();
  return body;
}

// ── Shared State ─────────────────────────────────────────────────────
let customerToken: string;
let restaurantToken: string;
let workerToken: string;
let adminToken: string;

let restaurantEntityId: string;
let menuItemIds: string[];
let createdOrderId: string;

// ── Setup ────────────────────────────────────────────────────────────
beforeAll(async () => {
  // Verify server is reachable
  const health = await api<{ status: string }>('/health');
  expect(health.body.status).toBe('ok');
});

// ── 1. Health ────────────────────────────────────────────────────────
describe('Health', () => {
  it('returns ok with philosophy', async () => {
    const { body } = await api<{ status: string; philosophy: string }>('/health', { expectedStatus: 200 });
    expect(body.status).toBe('ok');
    expect(body.philosophy).toContain('No extraction');
  });
});

// ── 2. Auth ──────────────────────────────────────────────────────────
describe('Auth', () => {
  it('logs in all 4 seed accounts', async () => {
    const customer = await login('customer@example.com');
    const restaurant = await login('restaurant@example.com');
    const worker = await login('worker@example.com');
    const admin = await login('admin@example.com');

    customerToken = customer.token;
    restaurantToken = restaurant.token;
    workerToken = worker.token;
    adminToken = admin.token;
    expect(customer.role).toBe('customer');
    expect(restaurant.role).toBe('restaurant');
    expect(worker.role).toBe('worker');
    expect(admin.role).toBe('coop_admin');
  });

  it('rejects bad credentials', async () => {
    const { status, body } = await api<{ error: string }>('/api/auth/login', {
      body: { email: 'customer@example.com', password: 'wrong' },
    });
    expect(status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it('rejects missing token', async () => {
    const { status } = await api('/api/orders');
    expect(status).toBe(401);
  });

  it('rejects invalid token', async () => {
    const { status } = await api('/api/orders', { token: 'invalid.jwt.token' });
    expect(status).toBe(401);
  });

  it('registers a new customer', async () => {
    const email = `test-${Date.now()}@integration.test`;
    const { status, body } = await api<LoginResult>('/api/auth/register', {
      body: {
        email,
        password: 'securepass123',
        name: 'Integration Test User',
        phone: '+91-1234567890',
        role: 'customer',
      },
    });
    expect(status).toBe(201);
    expect(body.token).toBeDefined();
    expect(body.email).toBe(email);
  });

  it('rejects duplicate email registration', async () => {
    const { status } = await api('/api/auth/register', {
      body: {
        email: 'customer@example.com',
        password: 'securepass123',
        name: 'Duplicate',
        phone: '+91-0000000000',
        role: 'customer',
      },
    });
    expect(status).toBe(409);
  });
});

// ── 3. Restaurants & Menu ────────────────────────────────────────────
describe('Restaurants', () => {
  it('lists restaurants', async () => {
    const { body } = await api<Array<{ id: string; name: string; isOpen: boolean }>>(
      '/api/restaurants',
      { token: customerToken, expectedStatus: 200 },
    );
    expect(body.length).toBeGreaterThan(0);
    restaurantEntityId = body[0]!.id;
    expect(body[0]!.name).toBe('Sharma Kitchen');
  });

  it('gets single restaurant', async () => {
    const { body } = await api<{ id: string; name: string }>(
      `/api/restaurants/${restaurantEntityId}`,
      { token: customerToken, expectedStatus: 200 },
    );
    expect(body.id).toBe(restaurantEntityId);
  });

  it('gets menu items', async () => {
    const { body } = await api<Array<{ id: string; name: string; price: number; isAvailable: boolean }>>(
      `/api/restaurants/${restaurantEntityId}/menu`,
      { token: customerToken, expectedStatus: 200 },
    );
    expect(body.length).toBeGreaterThanOrEqual(4);
    menuItemIds = body.filter((m) => m.isAvailable).map((m) => m.id);
    expect(menuItemIds.length).toBeGreaterThanOrEqual(2);
  });
});

// ── 4. Validation ────────────────────────────────────────────────────
describe('Validation', () => {
  it('rejects order with empty items', async () => {
    const { status, body } = await api<{ error: string }>('/api/orders', {
      token: customerToken,
      body: {
        restaurantId: restaurantEntityId,
        items: [],
        deliveryAddress: { street: 'X', city: 'Y', postalCode: '000000', lat: 0, lng: 0 },
      },
    });
    expect(status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it('rejects order missing required fields', async () => {
    const { status } = await api('/api/orders', {
      token: customerToken,
      body: { restaurantId: restaurantEntityId },
    });
    expect(status).toBe(400);
  });

  it('rejects login with missing email', async () => {
    const { status } = await api('/api/auth/login', {
      body: { password: 'password123' },
    });
    expect(status).toBe(400);
  });

  it('rejects registration with short password', async () => {
    const { status } = await api('/api/auth/register', {
      body: {
        email: 'short@test.com',
        password: '12',
        name: 'Short',
        phone: '123',
        role: 'customer',
      },
    });
    expect(status).toBe(400);
  });
});

// ── 5. Full Order Lifecycle ──────────────────────────────────────────
describe('Order Lifecycle', () => {
  it('creates an order', async () => {
    const { body } = await api<{
      orderId: string;
      subtotal: number;
      deliveryFee: number;
      tip: number;
      total: number;
      status: string;
      transparency: {
        restaurantReceives: number;
        workerReceives: number;
        coopInfraFee: number;
        poolContribution: number;
      };
    }>('/api/orders', {
      token: customerToken,
      body: {
        restaurantId: restaurantEntityId,
        items: [
          { menuItemId: menuItemIds[0], quantity: 2 },
          { menuItemId: menuItemIds[1], quantity: 1 },
        ],
        deliveryAddress: {
          street: '99 Integration Test Rd',
          city: 'Bangalore',
          postalCode: '560001',
          lat: 12.9352,
          lng: 77.6245,
        },
        tip: 3000,
      },
      expectedStatus: 201,
    });

    createdOrderId = body.orderId;
    expect(createdOrderId).toBeDefined();
    expect(body.status).toBe('payment_held');
    expect(body.subtotal).toBeGreaterThan(0);
    expect(body.deliveryFee).toBeGreaterThan(0);
    expect(body.total).toBe(body.subtotal + body.deliveryFee + body.tip);

    // Transparency: no hidden fees
    const t = body.transparency;
    expect(t.restaurantReceives).toBe(body.subtotal);
    expect(t.workerReceives + t.coopInfraFee + t.poolContribution).toBeLessThanOrEqual(body.deliveryFee);
  });

  it('customer can view the order', async () => {
    const { body } = await api<{ id: string; status: string }>(
      `/api/orders/${createdOrderId}`,
      { token: customerToken, expectedStatus: 200 },
    );
    expect(body.id).toBe(createdOrderId);
    expect(body.status).toBe('payment_held');
  });

  it('restaurant accepts the order', async () => {
    const { body } = await api<{ id: string; status: string }>(
      `/api/orders/${createdOrderId}/accept`,
      { token: restaurantToken, body: { estimatedPrepTime: 20 }, expectedStatus: 200 },
    );
    expect(body.status).toBe('restaurant_accepted');
  });

  it('order appears on worker job board', async () => {
    const { body } = await api<Array<{ orderId: string }>>(
      '/api/workers/jobs',
      { token: workerToken, expectedStatus: 200 },
    );
    const found = body.find((j) => j.orderId === createdOrderId);
    expect(found).toBeDefined();
  });

  it('worker claims the order', async () => {
    const { body } = await api<{ id: string; status: string }>(
      `/api/orders/${createdOrderId}/claim`,
      {
        token: workerToken,
        body: { workerLocation: { lat: 12.97, lng: 77.59 } },
        expectedStatus: 200,
      },
    );
    expect(body.status).toBe('worker_claimed');
  });

  it('worker picks up the order', async () => {
    const { body } = await api<{ id: string; status: string }>(
      `/api/orders/${createdOrderId}/pickup`,
      {
        token: workerToken,
        body: { workerLocation: { lat: 12.97, lng: 77.59 } },
        expectedStatus: 200,
      },
    );
    expect(body.status).toBe('picked_up');
  });

  it('worker delivers the order (escrow auto-settles)', async () => {
    const { body } = await api<{ id: string; status: string }>(
      `/api/orders/${createdOrderId}/deliver`,
      {
        token: workerToken,
        body: { workerLocation: { lat: 12.935, lng: 77.625 } },
        expectedStatus: 200,
      },
    );
    expect(body.status).toBe('delivered');
  });
});

// ── 6. Escrow Verification ──────────────────────────────────────────
describe('Escrow', () => {
  it('escrow settled for the delivered order', async () => {
    const { body } = await api<{
      orderId: string;
      status: string;
      restaurantPayout: number;
      workerPayout: number;
      coopFee: number;
      poolContribution: number;
    }>(`/api/escrow/order/${createdOrderId}`, {
      token: adminToken,
      expectedStatus: 200,
    });
    expect(body.orderId).toBe(createdOrderId);
    expect(body.status).toBe('settled');
    expect(body.restaurantPayout).toBeGreaterThan(0);
    expect(body.workerPayout).toBeGreaterThan(0);
    expect(body.coopFee).toBeGreaterThanOrEqual(0);
    expect(body.poolContribution).toBeGreaterThanOrEqual(0);
  });

  it('pool has a positive balance', async () => {
    const { body } = await api<{ balance: number; totalContributions: number }>(
      '/api/escrow/pool',
      { token: adminToken, expectedStatus: 200 },
    );
    expect(body.balance).toBeGreaterThan(0);
    expect(body.totalContributions).toBeGreaterThan(0);
  });
});

// ── 7. Event Log & Hash Chain ────────────────────────────────────────
describe('Event Log', () => {
  it('records events for the order', async () => {
    const { body } = await api<Array<{ type: string; aggregateId: string }>>(
      `/api/events/aggregate/order/${createdOrderId}`,
      { token: adminToken, expectedStatus: 200 },
    );
    expect(body.length).toBeGreaterThanOrEqual(5);
    const types = body.map((e) => e.type);
    expect(types).toContain('order.created');
    expect(types).toContain('order.delivered');
  });

  it('hash chain is valid for the order', async () => {
    const { body } = await api<{ valid: boolean }>(
      `/api/events/verify/order/${createdOrderId}`,
      { token: adminToken, expectedStatus: 200 },
    );
    expect(body.valid).toBe(true);
  });

  it('returns recent events', async () => {
    const { body } = await api<Array<{ eventType: string; sequenceNumber: number }>>(
      '/api/events/recent',
      { token: adminToken, expectedStatus: 200 },
    );
    expect(body.length).toBeGreaterThan(0);
    // Sequence numbers should be positive integers
    expect(body[0]!.sequenceNumber).toBeGreaterThan(0);
  });
});

// ── 8. Worker Earnings ───────────────────────────────────────────────
describe('Worker Earnings', () => {
  it('shows earnings for the worker', async () => {
    const { body } = await api<Array<{ deliveriesCompleted: number; totalEarnings: number }>>(
      '/api/workers/earnings',
      { token: workerToken, expectedStatus: 200 },
    );
    expect(body.length).toBeGreaterThan(0);
    // At least 1 delivery completed (from this test + smoke tests)
    const today = body[0]!;
    expect(today.deliveriesCompleted).toBeGreaterThanOrEqual(1);
    expect(today.totalEarnings).toBeGreaterThan(0);
  });
});

// ── 9. Reputation ────────────────────────────────────────────────────
describe('Reputation', () => {
  it('customer submits a rating for the restaurant', async () => {
    const { status, body: _ratingBody } = await api<{ id: string } | { error: string }>(
      '/api/reputation/ratings',
      {
        token: customerToken,
        body: {
          orderId: createdOrderId,
          targetId: restaurantEntityId,
          targetRole: 'restaurant',
          score: 4,
          comment: 'Good food, integration test',
        },
      },
    );
    // 201 = new rating, 400 = already rated (from a prior run)
    expect([201, 400]).toContain(status);
  });

  it('queries ratings for the restaurant', async () => {
    const { body } = await api<{ averageScore: number; count: number } | Array<unknown>>(
      `/api/reputation/ratings/restaurant/${restaurantEntityId}`,
      { token: customerToken, expectedStatus: 200 },
    );
    // Response shape varies — either object or array, just check it's truthy
    expect(body).toBeDefined();
  });
});

// ── 10. Governance ───────────────────────────────────────────────────
describe('Governance', () => {
  it('returns system parameters', async () => {
    const { body } = await api<{
      baseDeliveryFee: number;
      poolContributionRate: number;
      infraFeeRate: number;
      dailyMinimumGuarantee: number;
      defaultQuorum: number;
    }>('/api/governance/parameters', {
      token: adminToken,
      expectedStatus: 200,
    });
    expect(body.baseDeliveryFee).toBeGreaterThan(0);
    expect(body.poolContributionRate).toBe(10);
    expect(body.infraFeeRate).toBe(10);
    expect(body.dailyMinimumGuarantee).toBeGreaterThan(0);
    expect(body.defaultQuorum).toBe(30);
  });

  it('lists proposals (may be empty)', async () => {
    const { body } = await api<unknown[]>('/api/governance/proposals', {
      token: adminToken,
      expectedStatus: 200,
    });
    expect(Array.isArray(body)).toBe(true);
  });
});

// ── 11. Role Authorization ───────────────────────────────────────────
describe('Role Authorization', () => {
  it('customer cannot accept orders (restaurant-only)', async () => {
    const { status } = await api(`/api/orders/${createdOrderId}/accept`, {
      token: customerToken,
      body: {},
    });
    expect(status).toBe(403);
  });

  it('restaurant cannot create orders (customer-only)', async () => {
    const { status } = await api('/api/orders', {
      token: restaurantToken,
      body: {
        restaurantId: restaurantEntityId,
        items: [{ menuItemId: menuItemIds[0], quantity: 1 }],
        deliveryAddress: { street: 'X', city: 'Y', postalCode: '000', lat: 0, lng: 0 },
      },
    });
    expect(status).toBe(403);
  });

  it('customer cannot access worker jobs', async () => {
    const { status } = await api('/api/workers/jobs', { token: customerToken });
    expect(status).toBe(403);
  });
});

// ── 12. Edge Cases ───────────────────────────────────────────────────
describe('Edge Cases', () => {
  it('returns 404 for non-existent order', async () => {
    const { status } = await api(
      '/api/orders/00000000-0000-0000-0000-000000000000',
      { token: customerToken },
    );
    expect(status).toBe(404);
  });

  it('returns 404 for non-existent restaurant', async () => {
    const { status } = await api(
      '/api/restaurants/00000000-0000-0000-0000-000000000000',
      { token: customerToken },
    );
    expect(status).toBe(404);
  });

  it('cannot deliver an already delivered order', async () => {
    const { status } = await api(`/api/orders/${createdOrderId}/deliver`, {
      token: workerToken,
      body: {},
    });
    // Should be 400 (invalid transition) since order is already delivered
    expect([400, 409]).toContain(status);
  });

  it('cannot cancel a delivered order', async () => {
    const { status } = await api(`/api/orders/${createdOrderId}/cancel`, {
      token: customerToken,
      body: { reason: 'Changed my mind' },
    });
    expect([400, 409]).toContain(status);
  });
});
