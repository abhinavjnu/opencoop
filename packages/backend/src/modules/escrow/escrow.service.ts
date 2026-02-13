import { db } from '../../db/index.js';
import { escrowRecords, orders, poolState, poolLedger, workers, systemParameters } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { eventBus } from '../events/event-bus.js';
import pino from 'pino';

const logger = pino({ name: 'escrow-service' });

export const escrowService = {
  async holdPayment(orderId: string, amount: number, customerId: string) {
    const paymentIntentId = `pi_sim_${uuid().replace(/-/g, '').slice(0, 24)}`;

    const escrowId = uuid();

    await db.insert(escrowRecords).values({
      id: escrowId,
      orderId,
      paymentIntentId,
      amount,
      currency: 'INR',
      status: 'authorized',
    });

    await eventBus.emit({
      type: 'payment.authorized',
      aggregateId: escrowId,
      aggregateType: 'payment',
      actor: { id: customerId, role: 'customer' },
      data: { orderId, paymentIntentId, amount, currency: 'INR', customerId },
    });

    logger.info({ orderId, amount, paymentIntentId }, 'Payment held in escrow');

    return { escrowId, paymentIntentId, amount };
  },

  async settlePayment(orderId: string) {
    const order = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order[0]) throw new Error('Order not found');
    const orderRow = order[0];
    if (!orderRow.workerId) throw new Error('No worker assigned');
    const workerId = orderRow.workerId;

    const escrow = await db
      .select()
      .from(escrowRecords)
      .where(eq(escrowRecords.orderId, orderId))
      .limit(1);

    if (!escrow[0]) throw new Error('Escrow record not found');
    const escrowRow = escrow[0];
    if (escrowRow.status === 'settled') {
      return {
        restaurantPayout: escrowRow.restaurantPayout ?? 0,
        workerPayout: escrowRow.workerPayout ?? 0,
        coopFee: escrowRow.coopFee ?? 0,
        poolContribution: escrowRow.poolContribution ?? 0,
        tip: escrowRow.tipAmount ?? 0,
      };
    }

    if (escrowRow.status !== 'authorized') throw new Error(`Cannot settle escrow in status ${escrowRow.status}`);

    const restaurantPayout = orderRow.subtotal;
    const deliveryFee = orderRow.deliveryFee;
    const tip = orderRow.tip;

    const params = await db
      .select()
      .from(systemParameters)
      .where(eq(systemParameters.id, 1))
      .limit(1);

    const poolContributionRate = params[0]?.poolContributionRate ?? 10;
    const infraFeeRate = params[0]?.infraFeeRate ?? 10;

    const poolContribution = Math.floor(deliveryFee * poolContributionRate / 100);
    const coopFee = Math.floor(deliveryFee * infraFeeRate / 100);
    const workerDeliveryPay = deliveryFee - poolContribution - coopFee;
    const workerPayout = workerDeliveryPay + tip;

    const now = new Date();
    const restaurantTransferId = `tr_sim_rest_${uuid().slice(0, 8)}`;
    const workerTransferId = `tr_sim_wrkr_${uuid().slice(0, 8)}`;

    const settlement = await db.transaction(async (tx) => {
      await tx
        .update(escrowRecords)
        .set({
          status: 'settled',
          restaurantPayout,
          workerPayout,
          coopFee,
          poolContribution,
          tipAmount: tip,
          restaurantTransferId,
          workerTransferId,
          settledAt: now,
          updatedAt: now,
        })
        .where(eq(escrowRecords.id, escrowRow.id));

      await tx
        .update(orders)
        .set({ status: 'settled', settledAt: now, updatedAt: now })
        .where(eq(orders.id, orderId));

      await tx.execute(sql`
        UPDATE pool_state
        SET balance = balance + ${poolContribution},
            total_contributions = total_contributions + ${poolContribution},
            last_updated = NOW()
        WHERE id = 1
      `);

      const currentPool = await tx.select().from(poolState).where(eq(poolState.id, 1)).limit(1);
      const poolBalance = currentPool[0]?.balance ?? 0;

      await tx.insert(poolLedger).values({
        transactionType: 'contribution',
        amount: poolContribution,
        balanceAfter: Number(poolBalance),
        orderId,
        description: `Pool contribution from order ${orderId}`,
      });

      const today = new Date().toISOString().split('T')[0]!;
      await tx.execute(sql`
        INSERT INTO worker_daily_earnings (worker_id, date, deliveries_completed, delivery_fees, tips, total_earnings)
        VALUES (${workerId}, ${today}, 1, ${workerDeliveryPay}, ${tip}, ${workerPayout})
        ON CONFLICT (worker_id, date)
        DO UPDATE SET
          deliveries_completed = worker_daily_earnings.deliveries_completed + 1,
          delivery_fees = worker_daily_earnings.delivery_fees + ${workerDeliveryPay},
          tips = worker_daily_earnings.tips + ${tip},
          total_earnings = worker_daily_earnings.total_earnings + ${workerPayout},
          updated_at = NOW()
      `);

      await tx
        .update(workers)
        .set({
          totalDeliveries: sql`${workers.totalDeliveries} + 1`,
          updatedAt: now,
        })
        .where(eq(workers.id, workerId));

      return { poolBalance: Number(poolBalance) };
    });

    await eventBus.emit({
      type: 'order.settled',
      aggregateId: orderId,
      aggregateType: 'order',
      actor: { id: 'system', role: 'system' },
      data: {
        restaurantPayout,
        workerPayout,
        coopInfraFee: coopFee,
        poolContribution,
        tip,
        paymentCaptureId: escrowRow.paymentIntentId,
        settledAt: now.toISOString(),
      },
    });

    await eventBus.emit({
      type: 'payment.restaurant_transferred',
      aggregateId: escrowRow.id,
      aggregateType: 'payment',
      actor: { id: 'system', role: 'system' },
      data: {
        orderId,
        restaurantId: orderRow.restaurantId,
        amount: restaurantPayout,
        transferId: restaurantTransferId,
      },
    });

    await eventBus.emit({
      type: 'payment.worker_transferred',
      aggregateId: escrowRow.id,
      aggregateType: 'payment',
      actor: { id: 'system', role: 'system' },
      data: {
        orderId,
        workerId,
        amount: workerPayout,
        transferId: workerTransferId,
        includesTip: tip > 0,
        tipAmount: tip,
      },
    });

    await eventBus.emit({
      type: 'payment.pool_contribution',
      aggregateId: escrowRow.id,
      aggregateType: 'payment',
      actor: { id: 'system', role: 'system' },
      data: {
        orderId,
        amount: poolContribution,
        poolBalanceAfter: settlement.poolBalance,
      },
    });

    logger.info({
      orderId,
      restaurantPayout,
      workerPayout,
      coopFee,
      poolContribution,
    }, 'Payment settled');

    return {
      restaurantPayout,
      workerPayout,
      coopFee,
      poolContribution,
      tip,
    };
  },

  async refundPayment(orderId: string, reason: string) {
    const escrow = await db
      .select()
      .from(escrowRecords)
      .where(eq(escrowRecords.orderId, orderId))
      .limit(1);

    if (!escrow[0]) {
      logger.warn({ orderId }, 'No escrow record found for refund');
      return;
    }

    if (escrow[0].status === 'refunded') {
      logger.warn({ orderId }, 'Escrow already refunded');
      return;
    }

    const refundId = `re_sim_${uuid().slice(0, 12)}`;

    await db
      .update(escrowRecords)
      .set({
        status: 'refunded',
        refundId,
        refundAmount: escrow[0].amount,
        updatedAt: new Date(),
      })
      .where(eq(escrowRecords.id, escrow[0].id));

    await eventBus.emit({
      type: 'payment.refunded',
      aggregateId: escrow[0].id,
      aggregateType: 'payment',
      actor: { id: 'system', role: 'system' },
      data: {
        orderId,
        refundId,
        amount: escrow[0].amount,
        reason,
      },
    });

    logger.info({ orderId, amount: escrow[0].amount, reason }, 'Payment refunded');
  },

  async getEscrowByOrder(orderId: string) {
    const result = await db
      .select()
      .from(escrowRecords)
      .where(eq(escrowRecords.orderId, orderId))
      .limit(1);

    return result[0] ?? null;
  },
};
