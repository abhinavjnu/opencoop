import { db } from '../../db/index.js';
import { disputes, orders, restaurants, workers } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { eventBus } from '../events/event-bus.js';
import { escrowService } from '../escrow/escrow.service.js';
import pino from 'pino';
import type { DisputeType, DisputeResolution } from '@openfood/shared';

const logger = pino({ name: 'dispute-service' });

const VALID_DISPUTE_TYPES: DisputeType[] = ['quality', 'missing_items', 'wrong_order', 'delivery_issue', 'payment', 'other'];
const VALID_RESOLUTIONS: DisputeResolution[] = ['full_refund', 'partial_refund', 'no_refund', 'redelivery'];

interface RaiseDisputeInput {
  orderId: string;
  raisedBy: string;
  disputeType: DisputeType;
  description: string;
  evidence: string[];
}

export const disputeService = {
  async raiseDispute(input: RaiseDisputeInput) {
    if (!VALID_DISPUTE_TYPES.includes(input.disputeType)) {
      throw new Error(`Invalid dispute type. Must be one of: ${VALID_DISPUTE_TYPES.join(', ')}`);
    }

    const order = await db
      .select()
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    if (!order[0]) throw new Error('Order not found');

    const orderRow = order[0];

    let actorRole: 'customer' | 'restaurant' | 'worker' = 'customer';

    if (input.raisedBy === orderRow.customerId) {
      actorRole = 'customer';
    } else {
      const restaurant = await db
        .select()
        .from(restaurants)
        .where(eq(restaurants.userId, input.raisedBy))
        .limit(1);

      if (restaurant[0] && restaurant[0].id === orderRow.restaurantId) {
        actorRole = 'restaurant';
      } else {
        const worker = await db
          .select()
          .from(workers)
          .where(eq(workers.userId, input.raisedBy))
          .limit(1);

        if (worker[0] && worker[0].id === orderRow.workerId) {
          actorRole = 'worker';
        } else {
          throw new Error('Only order participants can raise disputes');
        }
      }
    }

    const allowedStatuses = ['delivered', 'settled'];
    if (!allowedStatuses.includes(orderRow.status)) {
      throw new Error(`Cannot dispute order in status ${orderRow.status}. Must be delivered or settled.`);
    }

    const existing = await db
      .select()
      .from(disputes)
      .where(eq(disputes.orderId, input.orderId))
      .limit(1);

    if (existing[0] && !existing[0].resolution) {
      throw new Error('An unresolved dispute already exists for this order');
    }

    const disputeId = uuid();

    await db.insert(disputes).values({
      id: disputeId,
      orderId: input.orderId,
      raisedBy: input.raisedBy,
      disputeType: input.disputeType,
      description: input.description,
      evidence: input.evidence,
    });

    await db
      .update(orders)
      .set({ status: 'disputed', updatedAt: new Date() })
      .where(eq(orders.id, input.orderId));

    await eventBus.emit({
      type: 'order.disputed',
      aggregateId: input.orderId,
      aggregateType: 'order',
      actor: { id: input.raisedBy, role: actorRole },
      data: {
        disputedBy: input.raisedBy,
        disputeType: input.disputeType,
        description: input.description,
        evidence: input.evidence,
      },
    });

    logger.info({ disputeId, orderId: input.orderId, disputeType: input.disputeType }, 'Dispute raised');

    return { disputeId, orderId: input.orderId, status: 'open' };
  },

  async resolveDispute(
    disputeId: string,
    resolvedBy: string,
    resolution: DisputeResolution,
    refundAmount: number | null,
    notes: string,
  ) {
    if (!VALID_RESOLUTIONS.includes(resolution)) {
      throw new Error(`Invalid resolution. Must be one of: ${VALID_RESOLUTIONS.join(', ')}`);
    }

    const dispute = await this.getDisputeById(disputeId);
    if (!dispute) throw new Error('Dispute not found');

    if (dispute.resolution) {
      throw new Error('Dispute already resolved');
    }

    if ((resolution === 'partial_refund') && (refundAmount === null || refundAmount <= 0)) {
      throw new Error('Partial refund requires a positive refund amount');
    }

    const now = new Date();

    await db
      .update(disputes)
      .set({
        resolution,
        resolvedBy,
        refundAmount: refundAmount ?? null,
        notes,
        resolvedAt: now,
      })
      .where(eq(disputes.id, disputeId));

    await db
      .update(orders)
      .set({ status: 'dispute_resolved', updatedAt: now })
      .where(eq(orders.id, dispute.orderId));

    if (resolution === 'full_refund') {
      await escrowService.refundPayment(dispute.orderId, `Dispute resolved: full refund - ${notes}`);
    }

    await eventBus.emit({
      type: 'order.dispute_resolved',
      aggregateId: dispute.orderId,
      aggregateType: 'order',
      actor: { id: resolvedBy, role: 'coop_admin' },
      data: {
        resolution,
        resolvedBy,
        refundAmount: refundAmount ?? 0,
        notes,
      },
    });

    logger.info({ disputeId, resolution, resolvedBy }, 'Dispute resolved');

    return { disputeId, resolution, refundAmount };
  },

  async getDisputeById(disputeId: string) {
    const result = await db
      .select()
      .from(disputes)
      .where(eq(disputes.id, disputeId))
      .limit(1);

    return result[0] ?? null;
  },

  async getDisputesForOrder(orderId: string) {
    return db
      .select()
      .from(disputes)
      .where(eq(disputes.orderId, orderId))
      .orderBy(disputes.createdAt);
  },
};
