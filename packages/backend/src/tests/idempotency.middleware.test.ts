import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const { MockRedis } = vi.hoisted(() => {
  class RedisMock {
    private static store = new Map<string, { value: string; expiresAt: number | null }>();

    static reset() {
      this.store.clear();
    }

    on(_event: string, _handler: (...args: unknown[]) => void): this {
      return this;
    }

    async connect(): Promise<void> {
      return;
    }

    private read(key: string): string | null {
      const entry = RedisMock.store.get(key);
      if (!entry) return null;
      if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
        RedisMock.store.delete(key);
        return null;
      }
      return entry.value;
    }

    async set(key: string, value: string, ...args: Array<string | number>): Promise<string | null> {
      let ttlSec: number | null = null;
      let nx = false;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === 'EX') {
          const ttl = args[i + 1];
          ttlSec = typeof ttl === 'number' ? ttl : null;
        }
        if (args[i] === 'NX') {
          nx = true;
        }
      }

      if (nx && this.read(key) !== null) {
        return null;
      }

      RedisMock.store.set(key, {
        value,
        expiresAt: ttlSec === null ? null : Date.now() + ttlSec * 1000,
      });

      return 'OK';
    }

    async get(key: string): Promise<string | null> {
      return this.read(key);
    }

    async del(key: string): Promise<number> {
      return RedisMock.store.delete(key) ? 1 : 0;
    }
  }

  return { MockRedis: RedisMock };
});

vi.mock('ioredis', () => ({
  default: MockRedis,
}));

import { idempotency } from '../middleware/idempotency.js';

type FinishHandler = () => void;

function createReq(input: {
  method?: string;
  path?: string;
  originalUrl?: string;
  idempotencyKey?: string;
  body?: unknown;
  userId?: string;
}): Request {
  const headers: Record<string, string> = {};
  if (input.idempotencyKey) {
    headers['idempotency-key'] = input.idempotencyKey;
  }

  return {
    method: input.method ?? 'POST',
    path: input.path ?? '/api/orders',
    originalUrl: input.originalUrl ?? '/api/orders',
    headers,
    body: input.body ?? { foo: 'bar' },
    user: input.userId ? { userId: input.userId, email: 'u@example.com', role: 'customer' } : undefined,
    ip: '127.0.0.1',
  } as Request;
}

function createRes() {
  const finishHandlers: FinishHandler[] = [];
  const headers = new Map<string, string>();

  const res: Partial<Response> & {
    body?: unknown;
    finish: () => void;
    getHeader: (name: string) => string | undefined;
  } = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this as Response;
    },
    json(body: unknown) {
      this.body = body;
      return this as Response;
    },
    end() {
      return this as Response;
    },
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
      return this as Response;
    },
    on(event: string, handler: FinishHandler) {
      if (event === 'finish') {
        finishHandlers.push(handler);
      }
      return this as Response;
    },
    finish() {
      for (const handler of finishHandlers) {
        handler();
      }
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
  };

  return res;
}

async function tick(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('idempotency middleware', () => {
  beforeEach(() => {
    MockRedis.reset();
  });

  it('replays successful response for same key and same body', async () => {
    const req1 = createReq({ idempotencyKey: 'k1', body: { a: 1 }, userId: 'u1' });
    const res1 = createRes();
    const next1 = vi.fn();

    idempotency(req1, res1 as Response, next1);
    await tick();
    expect(next1).toHaveBeenCalledTimes(1);

    res1.status(201).json({ orderId: 'o1' });
    res1.finish();
    await tick();

    const req2 = createReq({ idempotencyKey: 'k1', body: { a: 1 }, userId: 'u1' });
    const res2 = createRes();
    const next2 = vi.fn();

    idempotency(req2, res2 as Response, next2);
    await tick();

    expect(next2).not.toHaveBeenCalled();
    expect(res2.statusCode).toBe(201);
    expect(res2.body).toEqual({ orderId: 'o1' });
    expect(res2.getHeader('x-idempotent-replay')).toBe('true');
  });

  it('rejects duplicate in-flight request', async () => {
    const req1 = createReq({ idempotencyKey: 'k2', body: { a: 1 }, userId: 'u1' });
    const res1 = createRes();
    const next1 = vi.fn();

    idempotency(req1, res1 as Response, next1);
    await tick();
    expect(next1).toHaveBeenCalledTimes(1);

    const req2 = createReq({ idempotencyKey: 'k2', body: { a: 1 }, userId: 'u1' });
    const res2 = createRes();
    const next2 = vi.fn();

    idempotency(req2, res2 as Response, next2);
    await tick();

    expect(next2).not.toHaveBeenCalled();
    expect(res2.statusCode).toBe(409);
    expect(res2.body).toEqual({ error: 'Duplicate request in progress' });
  });

  it('rejects same key with different request body', async () => {
    const req1 = createReq({ idempotencyKey: 'k3', body: { a: 1 }, userId: 'u1' });
    const res1 = createRes();
    const next1 = vi.fn();

    idempotency(req1, res1 as Response, next1);
    await tick();
    expect(next1).toHaveBeenCalledTimes(1);

    const req2 = createReq({ idempotencyKey: 'k3', body: { a: 2 }, userId: 'u1' });
    const res2 = createRes();
    const next2 = vi.fn();

    idempotency(req2, res2 as Response, next2);
    await tick();

    expect(next2).not.toHaveBeenCalled();
    expect(res2.statusCode).toBe(409);
    expect(res2.body).toEqual({ error: 'Idempotency key reuse with different request body' });
  });

  it('does not replay failed responses', async () => {
    const req1 = createReq({ idempotencyKey: 'k4', body: { a: 1 }, userId: 'u1' });
    const res1 = createRes();
    const next1 = vi.fn();

    idempotency(req1, res1 as Response, next1);
    await tick();
    expect(next1).toHaveBeenCalledTimes(1);

    res1.status(400).json({ error: 'bad request' });
    res1.finish();
    await tick();

    const req2 = createReq({ idempotencyKey: 'k4', body: { a: 1 }, userId: 'u1' });
    const res2 = createRes();
    const next2 = vi.fn();

    idempotency(req2, res2 as Response, next2);
    await tick();

    expect(next2).toHaveBeenCalledTimes(1);
  });
});
