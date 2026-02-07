import { db } from '../../db/index.js';
import { ratings, workers, restaurants } from '../../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { eventBus } from '../events/event-bus.js';
import pino from 'pino';

const logger = pino({ name: 'reputation-service' });

interface SubmitRatingInput {
  orderId: string;
  raterId: string;
  raterRole: 'customer' | 'restaurant' | 'worker';
  targetId: string;
  targetRole: 'restaurant' | 'worker';
  score: number;
  comment: string | null;
}

export const reputationService = {
  async submitRating(input: SubmitRatingInput) {
    if (input.score < 1 || input.score > 5 || !Number.isInteger(input.score)) {
      throw new Error('Score must be an integer between 1 and 5');
    }

    if (input.raterId === input.targetId) {
      throw new Error('Cannot rate yourself');
    }

    const ratingId = uuid();

    await db.insert(ratings).values({
      id: ratingId,
      orderId: input.orderId,
      raterId: input.raterId,
      raterRole: input.raterRole,
      targetId: input.targetId,
      targetRole: input.targetRole,
      score: input.score,
      comment: input.comment,
    });

    await this.recalculateAverageRating(input.targetId, input.targetRole);

    await eventBus.emit({
      type: 'reputation.rating_submitted',
      aggregateId: ratingId,
      aggregateType: 'reputation',
      actor: { id: input.raterId, role: input.raterRole },
      data: {
        orderId: input.orderId,
        raterId: input.raterId,
        raterRole: input.raterRole,
        targetId: input.targetId,
        targetRole: input.targetRole,
        score: input.score,
        comment: input.comment,
      },
    });

    logger.info({ ratingId, orderId: input.orderId, targetId: input.targetId, score: input.score }, 'Rating submitted');

    return { ratingId, score: input.score };
  },

  async getRatingsForTarget(targetId: string, targetRole: 'restaurant' | 'worker') {
    return db
      .select()
      .from(ratings)
      .where(and(eq(ratings.targetId, targetId), eq(ratings.targetRole, targetRole)))
      .orderBy(ratings.createdAt);
  },

  async getRatingById(ratingId: string) {
    const result = await db
      .select()
      .from(ratings)
      .where(eq(ratings.id, ratingId))
      .limit(1);

    return result[0] ?? null;
  },

  async getRatingsForOrder(orderId: string) {
    return db
      .select()
      .from(ratings)
      .where(eq(ratings.orderId, orderId));
  },

  async appealRating(ratingId: string, appealedBy: string, reason: string) {
    const rating = await this.getRatingById(ratingId);
    if (!rating) throw new Error('Rating not found');

    if (rating.targetId !== appealedBy) {
      throw new Error('Only the rated party can appeal');
    }

    if (rating.isAppealed) {
      throw new Error('Rating already appealed');
    }

    await db
      .update(ratings)
      .set({ isAppealed: true })
      .where(eq(ratings.id, ratingId));

    await eventBus.emit({
      type: 'reputation.appeal_filed',
      aggregateId: ratingId,
      aggregateType: 'reputation',
      actor: { id: appealedBy, role: 'worker' },
      data: {
        ratingId,
        appealedBy,
        reason,
      },
    });

    logger.info({ ratingId, appealedBy }, 'Rating appeal filed');

    return { ratingId, status: 'appealed' };
  },

  async resolveAppeal(
    ratingId: string,
    resolvedBy: string,
    resolution: 'upheld' | 'removed' | 'modified',
    newScore: number | null,
    notes: string,
  ) {
    const rating = await this.getRatingById(ratingId);
    if (!rating) throw new Error('Rating not found');

    if (!rating.isAppealed) {
      throw new Error('Rating has not been appealed');
    }

    if (rating.appealResolution) {
      throw new Error('Appeal already resolved');
    }

    if (resolution === 'modified' && (newScore === null || newScore < 1 || newScore > 5)) {
      throw new Error('Modified resolution requires a valid new score (1-5)');
    }

    const updates: Record<string, unknown> = {
      appealResolution: resolution,
    };

    if (resolution === 'removed') {
      updates['score'] = 0;
    } else if (resolution === 'modified' && newScore !== null) {
      updates['score'] = newScore;
    }

    await db
      .update(ratings)
      .set(updates)
      .where(eq(ratings.id, ratingId));

    await this.recalculateAverageRating(rating.targetId, rating.targetRole as 'restaurant' | 'worker');

    await eventBus.emit({
      type: 'reputation.appeal_resolved',
      aggregateId: ratingId,
      aggregateType: 'reputation',
      actor: { id: resolvedBy, role: 'coop_admin' },
      data: {
        ratingId,
        resolution,
        resolvedBy,
        newScore,
        notes,
      },
    });

    logger.info({ ratingId, resolution, resolvedBy }, 'Appeal resolved');

    return { ratingId, resolution };
  },

  /** Excludes removed ratings (score = 0) from the average via conditional SQL aggregation */
  async recalculateAverageRating(targetId: string, targetRole: 'restaurant' | 'worker') {
    const result = await db
      .select({
        avgScore: sql<number>`COALESCE(AVG(CASE WHEN ${ratings.score} > 0 THEN ${ratings.score} END), 0)`,
        count: sql<number>`COUNT(CASE WHEN ${ratings.score} > 0 THEN 1 END)`,
      })
      .from(ratings)
      .where(and(eq(ratings.targetId, targetId), eq(ratings.targetRole, targetRole)));

    const avg = Number(result[0]?.avgScore ?? 0);
    const count = Number(result[0]?.count ?? 0);
    const roundedAvg = Math.round(avg * 100) / 100;

    if (targetRole === 'worker') {
      await db
        .update(workers)
        .set({ averageRating: roundedAvg, ratingCount: count })
        .where(eq(workers.id, targetId));
    } else {
      await db
        .update(restaurants)
        .set({ averageRating: roundedAvg, ratingCount: count })
        .where(eq(restaurants.id, targetId));
    }

    logger.debug({ targetId, targetRole, avg: roundedAvg, count }, 'Aggregate rating updated');
  },
};
