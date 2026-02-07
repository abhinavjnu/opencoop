import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate, settleDailySchema } from '../../middleware/validation.js';
import { poolService } from './pool.service.js';
import { escrowService } from './escrow.service.js';

const router = Router();

router.get('/pool', authenticate, async (_req: Request, res: Response) => {
  try {
    const state = await poolService.getPoolState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get pool state' });
  }
});

router.get('/pool/ledger', authenticate, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query['limit'] as string) || 50;
    const ledger = await poolService.getPoolLedger(limit);
    res.json(ledger);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get pool ledger' });
  }
});

router.get('/order/:orderId', authenticate, async (req: Request, res: Response) => {
  try {
    const escrow = await escrowService.getEscrowByOrder(req.params['orderId']!);
    if (!escrow) {
      res.status(404).json({ error: 'Escrow record not found' });
      return;
    }
    res.json(escrow);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get escrow record' });
  }
});

router.post('/pool/settle-daily', authenticate, validate(settleDailySchema), async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'coop_admin' && req.user!.role !== 'customer') {
      res.status(403).json({ error: 'Admin only' });
      return;
    }

    const dateStr = req.body.date ?? new Date().toISOString().split('T')[0]!;
    const result = await poolService.settleDailyMinimums(dateStr);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to settle daily minimums';
    res.status(400).json({ error: message });
  }
});

export const escrowRoutes = router;
