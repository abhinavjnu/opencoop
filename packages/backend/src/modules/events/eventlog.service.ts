import { createHash } from 'crypto';
import { db } from '../../db/index.js';
import { eventLog } from '../../db/schema.js';
import { v4 as uuid } from 'uuid';
import { eq, and, desc } from 'drizzle-orm';
import type { BaseEvent } from '@openfood/shared';

const MAX_APPEND_RETRIES = 3;

function isAggregateVersionConflict(err: unknown): boolean {
  if (!(err instanceof Error)) return false;

  const dbCode = (err as Error & { code?: string }).code;
  if (dbCode === '23505') return true;

  return err.message.includes('event_log_aggregate_version');
}

/**
 * Deterministic JSON serialization with sorted keys.
 * Required because PostgreSQL JSONB reorders keys,
 * so naive JSON.stringify produces different output on retrieval.
 */
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

export function computeEventHash(
  eventType: string,
  data: Record<string, unknown>,
  previousHash: string | null,
  occurredAt: string,
): string {
  const payload = stableStringify({ eventType, data, previousHash, occurredAt });
  return createHash('sha256').update(payload).digest('hex');
}

export async function appendEvent(
  event: Omit<BaseEvent, 'id' | 'hash' | 'previousHash' | 'occurredAt' | 'version'> & {
    data: Record<string, unknown>;
  },
): Promise<BaseEvent> {
  for (let attempt = 1; attempt <= MAX_APPEND_RETRIES; attempt++) {
    const lastEvent = await db
      .select({ hash: eventLog.hash, version: eventLog.version })
      .from(eventLog)
      .where(
        and(
          eq(eventLog.aggregateId, event.aggregateId),
          eq(eventLog.aggregateType, event.aggregateType),
        ),
      )
      .orderBy(desc(eventLog.version))
      .limit(1);

    const previousHash = lastEvent[0]?.hash ?? null;
    const version = (lastEvent[0]?.version ?? 0) + 1;
    const occurredAt = new Date().toISOString();
    const id = uuid();

    const hash = computeEventHash(event.type, event.data, previousHash, occurredAt);

    const storedEvent: BaseEvent = {
      id,
      type: event.type,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      version,
      occurredAt,
      actor: event.actor,
      data: event.data,
      previousHash,
      hash,
    };

    try {
      await db.insert(eventLog).values({
        id,
        eventType: event.type,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        version,
        actorId: event.actor.id,
        actorRole: event.actor.role,
        data: event.data,
        previousHash,
        hash,
        occurredAt: new Date(occurredAt),
      });

      return storedEvent;
    } catch (err) {
      const shouldRetry = isAggregateVersionConflict(err) && attempt < MAX_APPEND_RETRIES;
      if (!shouldRetry) throw err;
    }
  }

  throw new Error('Failed to append event after retries');
}

export async function getEventsByAggregate(
  aggregateId: string,
  aggregateType: string,
): Promise<BaseEvent[]> {
  const events = await db
    .select()
    .from(eventLog)
    .where(
      and(
        eq(eventLog.aggregateId, aggregateId),
        eq(eventLog.aggregateType, aggregateType),
      ),
    )
    .orderBy(eventLog.version);

  return events.map((e) => ({
    id: e.id,
    type: e.eventType,
    aggregateId: e.aggregateId,
    aggregateType: e.aggregateType,
    version: e.version,
    occurredAt: e.occurredAt.toISOString(),
    actor: { id: e.actorId, role: e.actorRole as BaseEvent['actor']['role'] },
    data: e.data as Record<string, unknown>,
    previousHash: e.previousHash,
    hash: e.hash,
  }));
}

export async function verifyHashChain(
  aggregateId: string,
  aggregateType: string,
): Promise<{ valid: boolean; brokenAtVersion?: number }> {
  const events = await getEventsByAggregate(aggregateId, aggregateType);

  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    const expectedPreviousHash = i === 0 ? null : events[i - 1]!.hash;

    if (event.previousHash !== expectedPreviousHash) {
      return { valid: false, brokenAtVersion: event.version };
    }

    const recomputedHash = computeEventHash(
      event.type,
      event.data,
      event.previousHash,
      event.occurredAt,
    );

    if (event.hash !== recomputedHash) {
      return { valid: false, brokenAtVersion: event.version };
    }
  }

  return { valid: true };
}
