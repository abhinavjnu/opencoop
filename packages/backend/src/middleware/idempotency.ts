import type { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import pino from 'pino';
import { config } from '../config/index.js';

const logger = pino({ name: 'idempotency' });

const IN_FLIGHT_TTL_SEC = parseInt(process.env['IDEMPOTENCY_INFLIGHT_TTL_SEC'] ?? '60', 10);
const REPLAY_TTL_SEC = parseInt(process.env['IDEMPOTENCY_REPLAY_TTL_SEC'] ?? '300', 10);

interface RedisIdempotencyEntry {
  state: 'in_flight' | 'done';
  requestHash: string;
  statusCode: number | null;
  body: unknown;
  createdAt: number;
}

let redisClient: Redis | null = null;

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    redisClient.on('error', (err) => {
      logger.warn({ err }, 'Redis unavailable for idempotency middleware');
    });
  }

  return redisClient;
}

function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return JSON.stringify(obj);
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']';
  }

  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map(
    (k) => JSON.stringify(k) + ':' + stableStringify((obj as Record<string, unknown>)[k]),
  );

  return '{' + pairs.join(',') + '}';
}

function hashRequestBody(body: unknown): string {
  return createHash('sha256').update(stableStringify(body ?? null)).digest('hex');
}

function isWriteMethod(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

function getStoreKey(req: Request, idempotencyKey: string): string {
  const actor = req.user?.userId ?? req.ip ?? 'anonymous';
  const cleanPath = req.originalUrl.split('?')[0] ?? req.path;
  return `idemp:v1:${actor}:${req.method}:${cleanPath}:${idempotencyKey}`;
}

function parseEntry(raw: string | null): RedisIdempotencyEntry | null {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as RedisIdempotencyEntry;
  } catch {
    return null;
  }
}

export function idempotency(req: Request, res: Response, next: NextFunction): void {
  void handleIdempotency(req, res, next);
}

async function handleIdempotency(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!isWriteMethod(req.method)) {
    next();
    return;
  }

  const headerValue = req.headers['idempotency-key'];
  const idempotencyKey = typeof headerValue === 'string' ? headerValue.trim() : '';

  if (!idempotencyKey) {
    next();
    return;
  }

  const requestHash = hashRequestBody(req.body);
  const key = getStoreKey(req, idempotencyKey);

  let redis: Redis;
  try {
    redis = getRedis();
    await redis.connect().catch(() => undefined);
  } catch (err) {
    logger.warn({ err, key }, 'Idempotency fallback to pass-through');
    next();
    return;
  }

  const inFlightEntry: RedisIdempotencyEntry = {
    state: 'in_flight',
    requestHash,
    statusCode: null,
    body: null,
    createdAt: Date.now(),
  };

  try {
    const lockSet = await redis.set(
      key,
      JSON.stringify(inFlightEntry),
      'EX',
      IN_FLIGHT_TTL_SEC,
      'NX',
    );

    if (lockSet !== 'OK') {
      const existing = parseEntry(await redis.get(key));

      if (!existing) {
        next();
        return;
      }

      if (existing.requestHash !== requestHash) {
        res.status(409).json({ error: 'Idempotency key reuse with different request body' });
        return;
      }

      if (existing.state === 'in_flight') {
        res.status(409).json({ error: 'Duplicate request in progress' });
        return;
      }

      if (existing.state === 'done' && existing.statusCode !== null) {
        res.setHeader('X-Idempotent-Replay', 'true');
        if (existing.statusCode === 204) {
          res.status(204).end();
          return;
        }
        res.status(existing.statusCode).json(existing.body);
        return;
      }
    }
  } catch (err) {
    logger.warn({ err, key }, 'Idempotency Redis operation failed, continuing without cache');
    next();
    return;
  }

  let responseBody: unknown;
  const originalJson = res.json.bind(res);

  res.json = ((body: unknown) => {
    responseBody = body;
    return originalJson(body);
  }) as Response['json'];

  res.on('finish', () => {
    void (async () => {
      try {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const doneEntry: RedisIdempotencyEntry = {
            state: 'done',
            requestHash,
            statusCode: res.statusCode,
            body: responseBody ?? null,
            createdAt: Date.now(),
          };

          await redis.set(key, JSON.stringify(doneEntry), 'EX', REPLAY_TTL_SEC);
          return;
        }

        await redis.del(key);
      } catch (err) {
        logger.warn({ err, key }, 'Failed to finalize idempotency record');
      }
    })();
  });

  next();
}
