import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { getEventsByAggregate, verifyHashChain } from './eventlog.service.js';
import { db } from '../../db/index.js';
import { eventLog } from '../../db/schema.js';
import { sql } from 'drizzle-orm';

const router = Router();

router.get('/aggregate/:type/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const events = await getEventsByAggregate(
      req.params['id']!,
      req.params['type']!,
    );
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get events' });
  }
});

router.get('/verify/:type/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await verifyHashChain(
      req.params['id']!,
      req.params['type']!,
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify hash chain' });
  }
});

router.get('/recent', authenticate, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query['limit'] as string) || 50;
    const events = await db
      .select()
      .from(eventLog)
      .orderBy(sql`occurred_at DESC`)
      .limit(limit);

    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get recent events' });
  }
});

export const eventRoutes = router;
