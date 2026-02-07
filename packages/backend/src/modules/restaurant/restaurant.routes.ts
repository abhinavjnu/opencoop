import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate, addMenuItemSchema, updateMenuItemSchema, updateRestaurantStatusSchema } from '../../middleware/validation.js';
import { db } from '../../db/index.js';
import { restaurants, menuItems, orders } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const allRestaurants = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.isOpen, true));

    res.json(allRestaurants);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get restaurants' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const restaurant = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, req.params['id']!))
      .limit(1);

    if (!restaurant[0]) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }

    res.json(restaurant[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get restaurant' });
  }
});

router.get('/:id/menu', async (req: Request, res: Response) => {
  try {
    const items = await db
      .select()
      .from(menuItems)
      .where(
        and(
          eq(menuItems.restaurantId, req.params['id']!),
          eq(menuItems.isAvailable, true),
        ),
      );

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get menu' });
  }
});

router.put('/:id/menu/:itemId', authenticate, authorize('restaurant'), validate(updateMenuItemSchema), async (req: Request, res: Response) => {
  try {
    const restaurant = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.userId, req.user!.userId))
      .limit(1);

    if (!restaurant[0] || restaurant[0].id !== req.params['id']) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    await db
      .update(menuItems)
      .set({
        name: req.body.name,
        description: req.body.description,
        price: req.body.price,
        category: req.body.category,
        isAvailable: req.body.isAvailable,
        updatedAt: new Date(),
      })
      .where(eq(menuItems.id, req.params['itemId']!));

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Failed to update menu item' });
  }
});

router.post('/:id/menu', authenticate, authorize('restaurant'), validate(addMenuItemSchema), async (req: Request, res: Response) => {
  try {
    const restaurant = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.userId, req.user!.userId))
      .limit(1);

    if (!restaurant[0] || restaurant[0].id !== req.params['id']) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const itemId = uuid();

    await db.insert(menuItems).values({
      id: itemId,
      restaurantId: restaurant[0].id,
      name: req.body.name,
      description: req.body.description ?? '',
      price: req.body.price,
      category: req.body.category,
      isAvailable: req.body.isAvailable ?? true,
    });

    res.status(201).json({ id: itemId });
  } catch (err) {
    res.status(400).json({ error: 'Failed to add menu item' });
  }
});

router.put('/:id/status', authenticate, authorize('restaurant'), validate(updateRestaurantStatusSchema), async (req: Request, res: Response) => {
  try {
    const restaurant = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.userId, req.user!.userId))
      .limit(1);

    if (!restaurant[0] || restaurant[0].id !== req.params['id']) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    await db
      .update(restaurants)
      .set({ isOpen: req.body.isOpen, updatedAt: new Date() })
      .where(eq(restaurants.id, restaurant[0].id));

    res.json({ isOpen: req.body.isOpen });
  } catch (err) {
    res.status(400).json({ error: 'Failed to update status' });
  }
});

router.get('/:id/orders', authenticate, authorize('restaurant'), async (req: Request, res: Response) => {
  try {
    const restaurant = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.userId, req.user!.userId))
      .limit(1);

    if (!restaurant[0] || restaurant[0].id !== req.params['id']) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const orderList = await db
      .select()
      .from(orders)
      .where(eq(orders.restaurantId, restaurant[0].id))
      .orderBy(orders.createdAt);

    res.json(orderList);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

export const restaurantRoutes = router;
