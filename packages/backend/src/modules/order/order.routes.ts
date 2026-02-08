import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate, createOrderSchema, acceptOrderSchema, rejectOrderSchema, claimOrderSchema, pickupOrderSchema, deliverOrderSchema, cancelOrderSchema } from '../../middleware/validation.js';
import { orderService } from './order.service.js';

const router = Router();

router.post('/', authenticate, authorize('customer'), validate(createOrderSchema), async (req: Request, res: Response) => {
  try {
    const result = await orderService.createOrder({
      customerId: req.user!.userId,
      restaurantId: req.body.restaurantId,
      items: req.body.items,
      deliveryAddress: req.body.deliveryAddress,
      tip: req.body.tip ?? 0,
    });

    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create order';
    res.status(400).json({ error: message });
  }
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const order = await orderService.getOrder(req.params['id']!);
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get order' });
  }
});

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const role = req.user!.role;
    let orderList;

    if (role === 'customer') {
      orderList = await orderService.getOrdersByCustomer(req.user!.userId);
    } else if (role === 'coop_admin') {
      orderList = await orderService.getAllOrders();
    } else {
      res.status(403).json({ error: 'Use role-specific endpoints' });
      return;
    }

    res.json(orderList);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

router.post('/:id/accept', authenticate, authorize('restaurant'), validate(acceptOrderSchema), async (req: Request, res: Response) => {
  try {
    const result = await orderService.restaurantAccept(
      req.params['id']!,
      req.user!.userId,
      req.body.estimatedPrepTime,
    );
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to accept order';
    res.status(400).json({ error: message });
  }
});

router.post('/:id/reject', authenticate, authorize('restaurant'), validate(rejectOrderSchema), async (req: Request, res: Response) => {
  try {
    const result = await orderService.restaurantReject(
      req.params['id']!,
      req.user!.userId,
      req.body.reason ?? 'No reason provided',
    );
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reject order';
    res.status(400).json({ error: message });
  }
});

router.post('/:id/claim', authenticate, authorize('worker'), validate(claimOrderSchema), async (req: Request, res: Response) => {
  try {
    const { workerService } = await import('../worker/worker.service.js');
    const worker = await workerService.getWorkerByUserId(req.user!.userId);
    if (!worker) {
      res.status(404).json({ error: 'Worker profile not found' });
      return;
    }

    const result = await orderService.workerClaim(
      req.params['id']!,
      worker.id,
      req.body.workerLocation ?? { lat: worker.currentLat ?? 0, lng: worker.currentLng ?? 0 },
    );
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to claim order';
    res.status(400).json({ error: message });
  }
});

router.post('/:id/pickup', authenticate, authorize('worker'), validate(pickupOrderSchema), async (req: Request, res: Response) => {
  try {
    const { workerService } = await import('../worker/worker.service.js');
    const worker = await workerService.getWorkerByUserId(req.user!.userId);
    if (!worker) {
      res.status(404).json({ error: 'Worker profile not found' });
      return;
    }

    const result = await orderService.workerPickup(
      req.params['id']!,
      worker.id,
      req.body.workerLocation ?? { lat: worker.currentLat ?? 0, lng: worker.currentLng ?? 0 },
    );
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to mark pickup';
    res.status(400).json({ error: message });
  }
});

router.post('/:id/deliver', authenticate, authorize('worker'), validate(deliverOrderSchema), async (req: Request, res: Response) => {
  try {
    const { workerService } = await import('../worker/worker.service.js');
    const worker = await workerService.getWorkerByUserId(req.user!.userId);
    if (!worker) {
      res.status(404).json({ error: 'Worker profile not found' });
      return;
    }

    const result = await orderService.confirmDelivery(req.params['id']!, worker.id, {
      workerLocation: req.body.workerLocation ?? { lat: worker.currentLat ?? 0, lng: worker.currentLng ?? 0 },
      proofPhotoUrl: req.body.proofPhotoUrl,
      signatureConfirmation: req.body.signatureConfirmation,
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to confirm delivery';
    res.status(400).json({ error: message });
  }
});

router.post('/:id/cancel', authenticate, validate(cancelOrderSchema), async (req: Request, res: Response) => {
  try {
    const result = await orderService.cancelOrder(
      req.params['id']!,
      req.user!.userId,
      req.user!.role as 'customer' | 'restaurant' | 'worker',
      req.body.reason ?? 'No reason provided',
    );
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to cancel order';
    res.status(400).json({ error: message });
  }
});

export const orderRoutes = router;
