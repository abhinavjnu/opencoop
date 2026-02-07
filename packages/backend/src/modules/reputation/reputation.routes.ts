import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { reputationService } from './reputation.service.js';
import { validate, submitRatingSchema, appealRatingSchema, resolveAppealSchema } from '../../middleware/validation.js';

const router = Router();

router.post('/ratings', authenticate, validate(submitRatingSchema), async (req: Request, res: Response) => {
  try {
    const { orderId, targetId, targetRole, score, comment } = req.body;

    const raterRole = req.user!.role as 'customer' | 'restaurant' | 'worker';
    if (!['customer', 'restaurant', 'worker'].includes(raterRole)) {
      res.status(403).json({ error: 'Only customers, restaurants, and workers can submit ratings' });
      return;
    }

    const result = await reputationService.submitRating({
      orderId,
      raterId: req.user!.userId,
      raterRole,
      targetId,
      targetRole,
      score,
      comment: comment ?? null,
    });

    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit rating';
    res.status(400).json({ error: message });
  }
});

router.get('/ratings/order/:orderId', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await reputationService.getRatingsForOrder(req.params['orderId']!);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get ratings' });
  }
});

router.get('/ratings/:targetRole/:targetId', async (req: Request, res: Response) => {
  try {
    const targetRole = req.params['targetRole'] as 'restaurant' | 'worker';
    if (!['restaurant', 'worker'].includes(targetRole)) {
      res.status(400).json({ error: 'targetRole must be "restaurant" or "worker"' });
      return;
    }

    const result = await reputationService.getRatingsForTarget(req.params['targetId']!, targetRole);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get ratings' });
  }
});

router.post('/ratings/:id/appeal', authenticate, validate(appealRatingSchema), async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;

    const result = await reputationService.appealRating(
      req.params['id']!,
      req.user!.userId,
      reason,
    );

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to appeal rating';
    res.status(400).json({ error: message });
  }
});

router.post(
  '/ratings/:id/resolve',
  authenticate,
  authorize('coop_admin'),
  validate(resolveAppealSchema),
  async (req: Request, res: Response) => {
    try {
      const { resolution, newScore, notes } = req.body;

      const result = await reputationService.resolveAppeal(
        req.params['id']!,
        req.user!.userId,
        resolution,
        newScore ?? null,
        notes,
      );

      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resolve appeal';
      res.status(400).json({ error: message });
    }
  },
);

export const reputationRoutes = router;
