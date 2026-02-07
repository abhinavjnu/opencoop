import { EventEmitter } from 'events';
import type { DomainEvent, EventType } from '@opencoop/shared';
import { appendEvent } from './eventlog.service.js';
import pino from 'pino';

const logger = pino({ name: 'event-bus' });

type EventHandler = (event: DomainEvent) => Promise<void>;

class EventBus {
  private emitter = new EventEmitter();

  on(eventType: EventType, handler: EventHandler): void {
    this.emitter.on(eventType, handler);
  }

  onAny(handler: EventHandler): void {
    this.emitter.on('*', handler);
  }

  async emit(event: Omit<DomainEvent, 'id' | 'hash' | 'previousHash' | 'occurredAt' | 'version'>): Promise<DomainEvent> {
    const stored = await appendEvent({
      type: event.type,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      actor: event.actor,
      data: event.data as Record<string, unknown>,
    });

    const domainEvent = stored as unknown as DomainEvent;

    setImmediate(() => {
      this.emitter.emit(event.type, domainEvent);
      this.emitter.emit('*', domainEvent);
    });

    logger.info({ eventType: event.type, aggregateId: event.aggregateId }, 'Event emitted');
    return domainEvent;
  }
}

export const eventBus = new EventBus();
