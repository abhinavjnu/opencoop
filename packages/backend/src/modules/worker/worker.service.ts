import { db } from '../../db/index.js';
import { workers, users } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { eventBus } from '../events/event-bus.js';
import { jobBoardService } from './jobboard.service.js';
import type { VehicleType } from '@openfood/shared';
import pino from 'pino';

const logger = pino({ name: 'worker-service' });

interface RegisterWorkerInput {
  email: string;
  password: string;
  name: string;
  phone: string;
  vehicleType: VehicleType;
  zone: string;
}

export const workerService = {
  async register(input: RegisterWorkerInput) {
    const passwordHash = await bcrypt.hash(input.password, 10);
    const userId = uuid();
    const workerId = uuid();

    await db.insert(users).values({
      id: userId,
      email: input.email,
      passwordHash,
      name: input.name,
      role: 'worker',
      phone: input.phone,
    });

    await db.insert(workers).values({
      id: workerId,
      userId,
      name: input.name,
      phone: input.phone,
      vehicleType: input.vehicleType,
      zone: input.zone,
    });

    await eventBus.emit({
      type: 'worker.registered',
      aggregateId: workerId,
      aggregateType: 'worker',
      actor: { id: userId, role: 'worker' },
      data: {
        name: input.name,
        phone: input.phone,
        vehicleType: input.vehicleType,
        zone: input.zone,
      },
    });

    logger.info({ workerId, zone: input.zone }, 'Worker registered');

    return { userId, workerId };
  },

  async goOnline(workerId: string, location: { lat: number; lng: number }, zone: string) {
    await db
      .update(workers)
      .set({
        isOnline: true,
        currentLat: location.lat,
        currentLng: location.lng,
        zone,
        updatedAt: new Date(),
      })
      .where(eq(workers.id, workerId));

    const worker = await this.getWorker(workerId);
    if (!worker) throw new Error('Worker not found');

    await eventBus.emit({
      type: 'worker.went_online',
      aggregateId: workerId,
      aggregateType: 'worker',
      actor: { id: worker.userId, role: 'worker' },
      data: { location, zone },
    });

    return { workerId, isOnline: true };
  },

  async goOffline(workerId: string, reason: 'manual' | 'inactivity' | 'end_of_shift' = 'manual') {
    await db
      .update(workers)
      .set({ isOnline: false, updatedAt: new Date() })
      .where(eq(workers.id, workerId));

    const worker = await this.getWorker(workerId);
    if (!worker) throw new Error('Worker not found');

    await eventBus.emit({
      type: 'worker.went_offline',
      aggregateId: workerId,
      aggregateType: 'worker',
      actor: { id: worker.userId, role: 'worker' },
      data: { reason },
    });

    return { workerId, isOnline: false };
  },

  async updateLocation(workerId: string, location: { lat: number; lng: number }) {
    await db
      .update(workers)
      .set({
        currentLat: location.lat,
        currentLng: location.lng,
        updatedAt: new Date(),
      })
      .where(eq(workers.id, workerId));
  },

  async getAvailableJobs() {
    return jobBoardService.getAvailableJobs();
  },

  async getWorker(workerId: string) {
    const result = await db
      .select()
      .from(workers)
      .where(eq(workers.id, workerId))
      .limit(1);

    return result[0] ?? null;
  },

  async getWorkerByUserId(userId: string) {
    const result = await db
      .select()
      .from(workers)
      .where(eq(workers.userId, userId))
      .limit(1);

    return result[0] ?? null;
  },

  async getOnlineWorkers(zone?: string) {
    if (zone) {
      return db
        .select()
        .from(workers)
        .where(and(eq(workers.isOnline, true), eq(workers.zone, zone)));
    }
    return db.select().from(workers).where(eq(workers.isOnline, true));
  },
};
