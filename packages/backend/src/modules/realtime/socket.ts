import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { eventBus } from '../events/event-bus.js';
import type { DomainEvent } from '@opencoop/shared';
import pino from 'pino';

const logger = pino({ name: 'socket' });

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    role: 'customer' | 'restaurant' | 'worker' | 'coop_admin';
  };
}

/**
 * Determines which rooms an event should be broadcast to.
 *
 * Room naming:
 *   - `user:<userId>`     — events relevant to a specific user
 *   - `role:<role>`       — events relevant to all users of a role
 *   - `order:<orderId>`   — events relevant to a specific order
 *   - `public`            — events safe for all connected clients
 */
function getEventRooms(event: DomainEvent): string[] {
  const rooms: string[] = [];
  const data = event.data as Record<string, unknown>;

  switch (event.aggregateType) {
    case 'order': {
      rooms.push(`order:${event.aggregateId}`);
      if (data['customerId']) rooms.push(`user:${data['customerId']}`);
      if (data['workerId']) rooms.push(`user:${data['workerId']}`);
      if (data['restaurantId']) rooms.push(`user:${data['restaurantId']}`);
      if (event.type === 'order.posted_to_board') {
        rooms.push('role:worker');
      }
      break;
    }
    case 'payment': {
      if (data['workerId']) rooms.push(`user:${data['workerId']}`);
      if (data['restaurantId']) rooms.push(`user:${data['restaurantId']}`);
      if (data['customerId']) rooms.push(`user:${data['customerId']}`);
      break;
    }
    case 'governance': {
      rooms.push('role:worker');
      rooms.push('role:restaurant');
      rooms.push('role:coop_admin');
      break;
    }
    case 'reputation': {
      if (data['targetId']) rooms.push(`user:${data['targetId']}`);
      if (data['raterId']) rooms.push(`user:${data['raterId']}`);
      break;
    }
    case 'worker': {
      rooms.push(`user:${event.aggregateId}`);
      break;
    }
    default: {
      rooms.push('role:coop_admin');
    }
  }

  rooms.push('role:coop_admin');

  return [...new Set(rooms)];
}

function sanitizeEvent(event: DomainEvent): Record<string, unknown> {
  return {
    id: event.id,
    type: event.type,
    aggregateId: event.aggregateId,
    aggregateType: event.aggregateType,
    occurredAt: event.occurredAt,
    data: event.data,
  };
}

export function initializeWebSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth['token'] as string | undefined;

    if (!token) {
      next(new Error('Authentication required'));
      return;
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as {
        userId: string;
        role: 'customer' | 'restaurant' | 'worker' | 'coop_admin';
      };

      socket.data = {
        userId: decoded.userId,
        role: decoded.role,
      };

      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (rawSocket: Socket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const { userId, role } = socket.data;

    logger.info({ userId, role, socketId: socket.id }, 'Client connected');

    socket.join(`user:${userId}`);
    socket.join(`role:${role}`);

    socket.on('subscribe:order', (orderId: string) => {
      if (typeof orderId === 'string' && orderId.length > 0) {
        socket.join(`order:${orderId}`);
        logger.debug({ userId, orderId }, 'Subscribed to order');
      }
    });

    socket.on('unsubscribe:order', (orderId: string) => {
      if (typeof orderId === 'string' && orderId.length > 0) {
        socket.leave(`order:${orderId}`);
        logger.debug({ userId, orderId }, 'Unsubscribed from order');
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info({ userId, socketId: socket.id, reason }, 'Client disconnected');
    });
  });

  eventBus.onAny(async (event: DomainEvent) => {
    const rooms = getEventRooms(event);
    const sanitized = sanitizeEvent(event);

    for (const room of rooms) {
      io.to(room).emit('event', sanitized);
    }

    logger.debug(
      { eventType: event.type, rooms, aggregateId: event.aggregateId },
      'Event broadcast to rooms',
    );
  });

  logger.info('WebSocket server initialized');

  return io;
}
