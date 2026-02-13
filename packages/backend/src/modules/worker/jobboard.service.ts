import Redis from 'ioredis';
import { config } from '../../config/index.js';
import type { JobBoardEntry } from '@openfood/shared';
import pino from 'pino';

const logger = pino({ name: 'jobboard-service' });

const JOB_BOARD_KEY = 'openfood:jobboard';
const JOB_DETAIL_PREFIX = 'openfood:job:';
const JOB_CLAIM_PREFIX = 'openfood:claim:';

let redis: Redis;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.redis.url, { maxRetriesPerRequest: 3 });
  }
  return redis;
}

export const jobBoardService = {
  async postJob(job: JobBoardEntry): Promise<void> {
    const r = getRedis();
    const score = Date.now();

    await r.zadd(JOB_BOARD_KEY, score, job.orderId);
    await r.set(
      `${JOB_DETAIL_PREFIX}${job.orderId}`,
      JSON.stringify(job),
      'EX',
      7200,
    );

    logger.info({ orderId: job.orderId, deliveryFee: job.deliveryFee }, 'Job posted to board');
  },

  async getAvailableJobs(): Promise<JobBoardEntry[]> {
    const r = getRedis();
    const orderIds = await r.zrangebyscore(JOB_BOARD_KEY, '-inf', '+inf');

    if (orderIds.length === 0) return [];

    const pipeline = r.pipeline();
    for (const id of orderIds) {
      pipeline.get(`${JOB_DETAIL_PREFIX}${id}`);
    }

    const results = await pipeline.exec();
    if (!results) return [];

    const jobs: JobBoardEntry[] = [];
    for (const [err, result] of results) {
      if (!err && result && typeof result === 'string') {
        jobs.push(JSON.parse(result) as JobBoardEntry);
      }
    }

    return jobs;
  },

  async getJobDetail(orderId: string): Promise<JobBoardEntry | null> {
    const r = getRedis();
    const data = await r.get(`${JOB_DETAIL_PREFIX}${orderId}`);
    if (!data) return null;
    return JSON.parse(data) as JobBoardEntry;
  },

  async claimJob(orderId: string, workerId: string): Promise<boolean> {
    const r = getRedis();

    const claimKey = `${JOB_CLAIM_PREFIX}${orderId}`;
    const claimed = await r.setnx(claimKey, workerId);

    if (claimed === 0) {
      const existingClaimer = await r.get(claimKey);
      if (existingClaimer === workerId) return true;
      return false;
    }

    await r.expire(claimKey, 3600);
    await r.zrem(JOB_BOARD_KEY, orderId);
    await r.del(`${JOB_DETAIL_PREFIX}${orderId}`);

    logger.info({ orderId, workerId }, 'Job claimed by worker');
    return true;
  },

  async releaseJob(orderId: string): Promise<void> {
    const r = getRedis();
    const claimKey = `${JOB_CLAIM_PREFIX}${orderId}`;

    await r.del(claimKey);

    logger.info({ orderId }, 'Job claim released');
  },

  async removeJob(orderId: string): Promise<void> {
    const r = getRedis();

    await r.zrem(JOB_BOARD_KEY, orderId);
    await r.del(`${JOB_DETAIL_PREFIX}${orderId}`);
    await r.del(`${JOB_CLAIM_PREFIX}${orderId}`);

    logger.info({ orderId }, 'Job removed from board');
  },

  async getJobCount(): Promise<number> {
    const r = getRedis();
    return r.zcard(JOB_BOARD_KEY);
  },
};
