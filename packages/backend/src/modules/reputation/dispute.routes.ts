import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { disputeService } from './dispute.service.js';
import type { DisputeType, DisputeResolution } from '@opencoop/shared';
import { validate, raiseDisputeSchema, resolveDisputeSchema } from '../../middleware/validation.js';

const router = Router();

router.post('/', authenticate, validate(raiseDisputeSchema), async (req: Request, res: Response) => {
  try {
    const { orderId, disputeType, description, evidence } = req.body;

    const result = await disputeService.raiseDispute({
      orderId,
      raisedBy: req.user!.userId,
      disputeType: disputeType as DisputeType,
      description,
      evidence: evidence ?? [],
    });

    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to raise dispute';
    res.status(400).json({ error: message });
  }
});

router.get('/order/:orderId', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await disputeService.getDisputesForOrder(req.params['orderId']!);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get disputes' });
  }
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const dispute = await disputeService.getDisputeById(req.params['id']!);
    if (!dispute) {
      res.status(404).json({ error: 'Dispute not found' });
      return;
    }
    res.json(dispute);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get dispute' });
  }
});

router.post(
  '/:id/resolve',
  authenticate,
  authorize('coop_admin'),
  validate(resolveDisputeSchema),
  async (req: Request, res: Response) => {
    try {
      const { resolution, refundAmount, notes } = req.body;

      const result = await disputeService.resolveDispute(
        req.params['id']!,
        req.user!.userId,
        resolution as DisputeResolution,
        refundAmount ?? null,
        notes,
      );

      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resolve dispute';
      res.status(400).json({ error: message });
    }
  },
);

export const disputeRoutes = router;
