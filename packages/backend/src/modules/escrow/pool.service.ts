import { db } from '../../db/index.js';
import { poolState, poolLedger, workerDailyEarnings, systemParameters } from '../../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { eventBus } from '../events/event-bus.js';
import pino from 'pino';

const logger = pino({ name: 'pool-service' });

async function getDailyMinimum(): Promise<number> {
  const params = await db
    .select({ dailyMinimumGuarantee: systemParameters.dailyMinimumGuarantee })
    .from(systemParameters)
    .where(eq(systemParameters.id, 1))
    .limit(1);

  return params[0]?.dailyMinimumGuarantee ?? 60000;
}

export const poolService = {
  async getPoolState() {
    const result = await db.select().from(poolState).where(eq(poolState.id, 1)).limit(1);
    return result[0] ?? { balance: 0, totalContributions: 0, totalTopups: 0 };
  },

  async getPoolLedger(limit = 50) {
    return db
      .select()
      .from(poolLedger)
      .orderBy(sql`created_at DESC`)
      .limit(limit);
  },

  async settleDailyMinimums(dateStr: string) {
    const dailyMinimum = await getDailyMinimum();

    const unsettledWorkers = await db
      .select()
      .from(workerDailyEarnings)
      .where(
        and(
          eq(workerDailyEarnings.date, dateStr),
          eq(workerDailyEarnings.isSettled, false),
        ),
      );

    const pool = await this.getPoolState();
    let remainingBalance = Number(pool.balance);
    const topups: Array<{ workerId: string; amount: number }> = [];

    for (const earning of unsettledWorkers) {
      if (earning.totalEarnings >= dailyMinimum) {
        await db
          .update(workerDailyEarnings)
          .set({ isSettled: true, updatedAt: new Date() })
          .where(eq(workerDailyEarnings.id, earning.id));
        continue;
      }

      const deficit = dailyMinimum - earning.totalEarnings;
      const topupAmount = Math.min(deficit, remainingBalance);

      if (topupAmount <= 0) {
        logger.warn(
          { workerId: earning.workerId, deficit, poolBalance: remainingBalance },
          'Pool exhausted, cannot top up worker',
        );
        await db
          .update(workerDailyEarnings)
          .set({ isSettled: true, updatedAt: new Date() })
          .where(eq(workerDailyEarnings.id, earning.id));
        continue;
      }

      remainingBalance -= topupAmount;

      await db
        .update(workerDailyEarnings)
        .set({
          poolTopup: topupAmount,
          totalEarnings: earning.totalEarnings + topupAmount,
          isSettled: true,
          updatedAt: new Date(),
        })
        .where(eq(workerDailyEarnings.id, earning.id));

      topups.push({ workerId: earning.workerId, amount: topupAmount });

      await eventBus.emit({
        type: 'payment.pool_topup',
        aggregateId: earning.workerId,
        aggregateType: 'payment',
        actor: { id: 'system', role: 'system' },
        data: {
          workerId: earning.workerId,
          amount: topupAmount,
          dailyEarnings: earning.totalEarnings,
          dailyMinimum,
          poolBalanceAfter: remainingBalance,
          date: dateStr,
        },
      });
    }

    if (topups.length > 0) {
      const totalTopup = topups.reduce((sum, t) => sum + t.amount, 0);

      await db.execute(sql`
        UPDATE pool_state
        SET balance = balance - ${totalTopup},
            total_topups = total_topups + ${totalTopup},
            last_updated = NOW()
        WHERE id = 1
      `);

      await db.insert(poolLedger).values({
        transactionType: 'daily_topup',
        amount: -totalTopup,
        balanceAfter: remainingBalance,
        description: `Daily minimum top-ups for ${dateStr}: ${topups.length} workers, total ${totalTopup}`,
      });

      logger.info(
        { date: dateStr, workersTopped: topups.length, totalTopup, remainingBalance },
        'Daily minimum settlements complete',
      );
    }

    return { date: dateStr, topups, poolBalanceAfter: remainingBalance };
  },

  async getWorkerEarnings(workerId: string, dateStr: string) {
    const result = await db
      .select()
      .from(workerDailyEarnings)
      .where(
        and(
          eq(workerDailyEarnings.workerId, workerId),
          eq(workerDailyEarnings.date, dateStr),
        ),
      )
      .limit(1);

    return result[0] ?? null;
  },

  async getWorkerEarningsHistory(workerId: string, limit = 30) {
    return db
      .select()
      .from(workerDailyEarnings)
      .where(eq(workerDailyEarnings.workerId, workerId))
      .orderBy(sql`date DESC`)
      .limit(limit);
  },
};
