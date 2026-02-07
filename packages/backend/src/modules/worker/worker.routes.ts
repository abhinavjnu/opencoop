import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate, workerRegisterSchema, workerOnlineSchema, workerOfflineSchema, workerLocationSchema } from '../../middleware/validation.js';
import { workerService } from './worker.service.js';
import { poolService } from '../escrow/pool.service.js';

const router = Router();

router.post('/register', validate(workerRegisterSchema), async (req: Request, res: Response) => {
  try {
    const result = await workerService.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    res.status(400).json({ error: message });
  }
});

router.post('/online', authenticate, authorize('worker'), validate(workerOnlineSchema), async (req: Request, res: Response) => {
  try {
    const worker = await workerService.getWorkerByUserId(req.user!.userId);
    if (!worker) {
      res.status(404).json({ error: 'Worker profile not found' });
      return;
    }

    const result = await workerService.goOnline(
      worker.id,
      req.body.location,
      req.body.zone ?? worker.zone,
    );
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to go online';
    res.status(400).json({ error: message });
  }
});

router.post('/offline', authenticate, authorize('worker'), validate(workerOfflineSchema), async (req: Request, res: Response) => {
  try {
    const worker = await workerService.getWorkerByUserId(req.user!.userId);
    if (!worker) {
      res.status(404).json({ error: 'Worker profile not found' });
      return;
    }

    const result = await workerService.goOffline(worker.id, req.body.reason);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to go offline';
    res.status(400).json({ error: message });
  }
});

router.post('/location', authenticate, authorize('worker'), validate(workerLocationSchema), async (req: Request, res: Response) => {
  try {
    const worker = await workerService.getWorkerByUserId(req.user!.userId);
    if (!worker) {
      res.status(404).json({ error: 'Worker profile not found' });
      return;
    }

    await workerService.updateLocation(worker.id, req.body.location);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Failed to update location' });
  }
});

router.get('/jobs', authenticate, authorize('worker'), async (_req: Request, res: Response) => {
  try {
    const jobs = await workerService.getAvailableJobs();
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get jobs' });
  }
});

router.get('/me', authenticate, authorize('worker'), async (req: Request, res: Response) => {
  try {
    const worker = await workerService.getWorkerByUserId(req.user!.userId);
    if (!worker) {
      res.status(404).json({ error: 'Worker profile not found' });
      return;
    }
    res.json(worker);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get worker profile' });
  }
});

router.get('/earnings', authenticate, authorize('worker'), async (req: Request, res: Response) => {
  try {
    const worker = await workerService.getWorkerByUserId(req.user!.userId);
    if (!worker) {
      res.status(404).json({ error: 'Worker profile not found' });
      return;
    }

    const history = await poolService.getWorkerEarningsHistory(worker.id);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get earnings' });
  }
});

router.get('/earnings/today', authenticate, authorize('worker'), async (req: Request, res: Response) => {
  try {
    const worker = await workerService.getWorkerByUserId(req.user!.userId);
    if (!worker) {
      res.status(404).json({ error: 'Worker profile not found' });
      return;
    }

    const today = new Date().toISOString().split('T')[0]!;
    const earnings = await poolService.getWorkerEarnings(worker.id, today);
    res.json(earnings ?? {
      deliveriesCompleted: 0,
      totalEarnings: 0,
      deliveryFees: 0,
      tips: 0,
      poolTopup: 0,
      hoursOnline: 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get today earnings' });
  }
});

export const workerRoutes = router;
