import { db } from '../../db/index.js';
import { orders, restaurants, workers, menuItems, systemParameters } from '../../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { eventBus } from '../events/event-bus.js';
import { ORDER_STATUS_TRANSITIONS } from '@openfood/shared';
import type { OrderStatus, UserRole } from '@openfood/shared';
import { escrowService } from '../escrow/escrow.service.js';
import { jobBoardService } from '../worker/jobboard.service.js';
import pino from 'pino';

const logger = pino({ name: 'order-service' });

function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  const allowed = ORDER_STATUS_TRANSITIONS[from];
  return allowed?.includes(to) ?? false;
}

interface CreateOrderInput {
  customerId: string;
  restaurantId: string;
  items: Array<{ menuItemId: string; quantity: number }>;
  deliveryAddress: {
    street: string;
    city: string;
    postalCode: string;
    lat: number;
    lng: number;
  };
  tip: number;
}

export const orderService = {
  async createOrder(input: CreateOrderInput) {
    const restaurant = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, input.restaurantId))
      .limit(1);

    if (!restaurant[0]) {
      throw new Error('Restaurant not found');
    }

    if (!restaurant[0].isOpen) {
      throw new Error('Restaurant is currently closed');
    }

    const menuItemIds = input.items.map((i) => i.menuItemId);
    const menuItemRows = await db
      .select()
      .from(menuItems)
      .where(
        and(
          inArray(menuItems.id, menuItemIds),
          eq(menuItems.restaurantId, input.restaurantId),
        ),
      );

    const menuMap = new Map(menuItemRows.map((m) => [m.id, m]));

    const orderItems = input.items.map((item) => {
      const menuItem = menuMap.get(item.menuItemId);
      if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found`);
      if (!menuItem.isAvailable) throw new Error(`Menu item ${menuItem.name} is not available`);
      return {
        menuItemId: item.menuItemId,
        name: menuItem.name,
        quantity: item.quantity,
        unitPrice: menuItem.price,
      };
    });

    const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    const distanceMeters = calculateDistance(
      restaurant[0].lat,
      restaurant[0].lng,
      input.deliveryAddress.lat,
      input.deliveryAddress.lng,
    );

    const deliveryFee = await calculateDeliveryFee(distanceMeters);
    const total = subtotal + deliveryFee + input.tip;

    const orderId = uuid();
    const now = new Date();

    await db.insert(orders).values({
      id: orderId,
      customerId: input.customerId,
      restaurantId: input.restaurantId,
      items: orderItems,
      subtotal,
      deliveryFee,
      tip: input.tip,
      total,
      status: 'created',
      deliveryStreet: input.deliveryAddress.street,
      deliveryCity: input.deliveryAddress.city,
      deliveryPostalCode: input.deliveryAddress.postalCode,
      deliveryLat: input.deliveryAddress.lat,
      deliveryLng: input.deliveryAddress.lng,
      estimatedPrepTime: restaurant[0].averagePrepTime,
      createdAt: now,
      updatedAt: now,
    });

    await eventBus.emit({
      type: 'order.created',
      aggregateId: orderId,
      aggregateType: 'order',
      actor: { id: input.customerId, role: 'customer' },
      data: {
        customerId: input.customerId,
        restaurantId: input.restaurantId,
        items: orderItems,
        subtotal,
        deliveryFee,
        tip: input.tip,
        total,
        deliveryAddress: input.deliveryAddress,
        estimatedPrepTime: restaurant[0].averagePrepTime,
      },
    });

    const escrow = await escrowService.holdPayment(orderId, total, input.customerId);

    await db
      .update(orders)
      .set({ status: 'payment_held', updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    await eventBus.emit({
      type: 'order.payment_held',
      aggregateId: orderId,
      aggregateType: 'order',
      actor: { id: 'system', role: 'system' },
      data: {
        paymentIntentId: escrow.paymentIntentId,
        amountHeld: total,
        currency: 'INR',
      },
    });

    logger.info({ orderId, total, customerId: input.customerId }, 'Order created with payment held');

    const params = await getSystemParams();
    const poolRate = (params?.poolContributionRate ?? 10) / 100;
    const infraRate = (params?.infraFeeRate ?? 10) / 100;
    const workerRate = 1 - poolRate - infraRate;

    return {
      orderId,
      subtotal,
      deliveryFee,
      tip: input.tip,
      total,
      status: 'payment_held' as const,
      transparency: {
        restaurantReceives: subtotal,
        workerReceives: Math.floor(deliveryFee * workerRate),
        coopInfraFee: Math.floor(deliveryFee * infraRate),
        poolContribution: Math.floor(deliveryFee * poolRate),
      },
    };
  },

  async restaurantAccept(orderId: string, restaurantUserId: string, estimatedPrepTime?: number) {
    const order = await this.getOrder(orderId);
    if (!order) throw new Error('Order not found');

    const restaurant = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.userId, restaurantUserId))
      .limit(1);

    if (!restaurant[0] || restaurant[0].id !== order.restaurantId) {
      throw new Error('Not authorized');
    }

    if (!canTransition(order.status, 'restaurant_accepted')) {
      throw new Error(`Cannot accept order in status ${order.status}`);
    }

    const now = new Date();
    const prepTime = estimatedPrepTime ?? order.estimatedPrepTime ?? 20;

    await db
      .update(orders)
      .set({
        status: 'restaurant_accepted',
        estimatedPrepTime: prepTime,
        restaurantAcceptedAt: now,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId));

    await eventBus.emit({
      type: 'order.restaurant_accepted',
      aggregateId: orderId,
      aggregateType: 'order',
      actor: { id: restaurantUserId, role: 'restaurant' },
      data: { estimatedPrepTime: prepTime, acceptedAt: now.toISOString() },
    });

    await this.postToJobBoard(orderId);

    return { orderId, status: 'restaurant_accepted', estimatedPrepTime: prepTime };
  },

  async restaurantReject(orderId: string, restaurantUserId: string, reason: string) {
    const order = await this.getOrder(orderId);
    if (!order) throw new Error('Order not found');

    const restaurant = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.userId, restaurantUserId))
      .limit(1);

    if (!restaurant[0] || restaurant[0].id !== order.restaurantId) {
      throw new Error('Not authorized');
    }

    if (!canTransition(order.status, 'restaurant_rejected')) {
      throw new Error(`Cannot reject order in status ${order.status}`);
    }

    const now = new Date();

    await db
      .update(orders)
      .set({ status: 'cancelled', cancelledAt: now, cancellationReason: reason, updatedAt: now })
      .where(eq(orders.id, orderId));

    await escrowService.refundPayment(orderId, 'Restaurant rejected order');

    await eventBus.emit({
      type: 'order.restaurant_rejected',
      aggregateId: orderId,
      aggregateType: 'order',
      actor: { id: restaurantUserId, role: 'restaurant' },
      data: { reason, rejectedAt: now.toISOString() },
    });

    return { orderId, status: 'cancelled', reason };
  },

  async postToJobBoard(orderId: string) {
    const order = await this.getOrder(orderId);
    if (!order) throw new Error('Order not found');

    const restaurant = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, order.restaurantId))
      .limit(1);

    if (!restaurant[0]) throw new Error('Restaurant not found');

    const estimatedReadyAt = new Date(
      Date.now() + (order.estimatedPrepTime ?? 20) * 60 * 1000,
    ).toISOString();

    const distanceMeters = calculateDistance(
      restaurant[0].lat,
      restaurant[0].lng,
      order.deliveryLat,
      order.deliveryLng,
    );

    await db
      .update(orders)
      .set({ status: 'posted_to_board', updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    await jobBoardService.postJob({
      orderId,
      restaurantName: restaurant[0].name,
      pickupLocation: { lat: restaurant[0].lat, lng: restaurant[0].lng },
      deliveryLocation: { lat: order.deliveryLat, lng: order.deliveryLng },
      estimatedDistance: distanceMeters,
      deliveryFee: order.deliveryFee,
      tip: order.tip,
      estimatedReadyAt,
      postedAt: new Date().toISOString(),
    });

    await eventBus.emit({
      type: 'order.posted_to_board',
      aggregateId: orderId,
      aggregateType: 'order',
      actor: { id: 'system', role: 'system' },
      data: {
        pickupLocation: { lat: restaurant[0].lat, lng: restaurant[0].lng },
        deliveryLocation: { lat: order.deliveryLat, lng: order.deliveryLng },
        estimatedDistance: distanceMeters,
        deliveryFee: order.deliveryFee,
        estimatedReadyAt,
      },
    });
  },

  async workerClaim(orderId: string, workerId: string, workerLocation: { lat: number; lng: number }) {
    const order = await this.getOrder(orderId);
    if (!order) throw new Error('Order not found');

    if (!canTransition(order.status, 'worker_claimed')) {
      throw new Error(`Cannot claim order in status ${order.status}`);
    }

    const claimed = await jobBoardService.claimJob(orderId, workerId);
    if (!claimed) {
      throw new Error('Job already claimed by another worker');
    }

    const now = new Date();

    await db
      .update(orders)
      .set({
        status: 'worker_claimed',
        workerId,
        workerClaimedAt: now,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId));

    await eventBus.emit({
      type: 'order.worker_claimed',
      aggregateId: orderId,
      aggregateType: 'order',
      actor: { id: workerId, role: 'worker' },
      data: { workerId, claimedAt: now.toISOString(), workerLocation },
    });

    return { orderId, status: 'worker_claimed', workerId };
  },

  async workerPickup(orderId: string, workerId: string, workerLocation: { lat: number; lng: number }) {
    const order = await this.getOrder(orderId);
    if (!order) throw new Error('Order not found');
    if (order.workerId !== workerId) throw new Error('Not assigned to this worker');

    if (!canTransition(order.status, 'picked_up')) {
      throw new Error(`Cannot pick up order in status ${order.status}`);
    }

    const now = new Date();

    await db
      .update(orders)
      .set({ status: 'picked_up', pickedUpAt: now, updatedAt: now })
      .where(eq(orders.id, orderId));

    await eventBus.emit({
      type: 'order.picked_up',
      aggregateId: orderId,
      aggregateType: 'order',
      actor: { id: workerId, role: 'worker' },
      data: { pickedUpAt: now.toISOString(), workerLocation },
    });

    return { orderId, status: 'picked_up' };
  },

  async confirmDelivery(
    orderId: string,
    workerId: string,
    proof: { workerLocation: { lat: number; lng: number }; proofPhotoUrl?: string; signatureConfirmation?: boolean },
  ) {
    const order = await this.getOrder(orderId);
    if (!order) throw new Error('Order not found');
    if (order.workerId !== workerId) throw new Error('Not assigned to this worker');

    if (!canTransition(order.status, 'delivered')) {
      throw new Error(`Cannot deliver order in status ${order.status}`);
    }

    const now = new Date();

    await db
      .update(orders)
      .set({
        status: 'delivered',
        deliveredAt: now,
        proofPhotoUrl: proof.proofPhotoUrl ?? null,
        signatureConfirmation: proof.signatureConfirmation ?? false,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId));

    await eventBus.emit({
      type: 'order.delivered',
      aggregateId: orderId,
      aggregateType: 'order',
      actor: { id: workerId, role: 'worker' },
      data: {
        deliveredAt: now.toISOString(),
        workerLocation: proof.workerLocation,
        proofPhotoUrl: proof.proofPhotoUrl ?? null,
        signatureConfirmation: proof.signatureConfirmation ?? false,
      },
    });

    await escrowService.settlePayment(orderId);

    return { orderId, status: 'delivered' };
  },

  async cancelOrder(orderId: string, cancelledBy: string, role: 'customer' | 'restaurant' | 'worker' | 'coop_admin' | 'system', reason: string) {
    const order = await this.getOrder(orderId);
    if (!order) throw new Error('Order not found');

    const canCancel = await this.canUserAccessOrder(orderId, cancelledBy, role);
    if (!canCancel) {
      throw new Error('Not authorized to cancel this order');
    }

    if (!canTransition(order.status, 'cancelled')) {
      throw new Error(`Cannot cancel order in status ${order.status}`);
    }

    const now = new Date();

    if (order.workerId) {
      await jobBoardService.removeJob(orderId);
    }

    await db
      .update(orders)
      .set({
        status: 'cancelled',
        cancelledAt: now,
        cancellationReason: reason,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId));

    if (order.status !== 'created') {
      await escrowService.refundPayment(orderId, reason);
    }

    const eventRole = role === 'coop_admin' ? 'system' : role;

    await eventBus.emit({
      type: 'order.cancelled',
      aggregateId: orderId,
      aggregateType: 'order',
      actor: { id: cancelledBy, role: eventRole },
      data: {
        cancelledBy: eventRole,
        reason,
        refundAmount: order.total,
        cancelledAt: now.toISOString(),
      },
    });

    return { orderId, status: 'cancelled', reason };
  },

  async getOrder(orderId: string) {
    const result = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    return result[0] ?? null;
  },

  async canUserAccessOrder(orderId: string, userId: string, role: UserRole | 'system'): Promise<boolean> {
    if (role === 'coop_admin' || role === 'system') return true;

    const order = await this.getOrder(orderId);
    if (!order) return false;

    if (role === 'customer') {
      return order.customerId === userId;
    }

    if (role === 'restaurant') {
      const restaurant = await db
        .select()
        .from(restaurants)
        .where(eq(restaurants.userId, userId))
        .limit(1);
      return restaurant[0]?.id === order.restaurantId;
    }

    if (role === 'worker') {
      const worker = await db
        .select()
        .from(workers)
        .where(eq(workers.userId, userId))
        .limit(1);
      return worker[0]?.id === order.workerId;
    }

    return false;
  },

  async getAllOrders(limit = 100) {
    return db
      .select()
      .from(orders)
      .orderBy(orders.createdAt)
      .limit(limit);
  },

  async getOrdersByCustomer(customerId: string) {
    return db
      .select()
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(orders.createdAt);
  },

  async getOrdersByRestaurant(restaurantId: string) {
    return db
      .select()
      .from(orders)
      .where(eq(orders.restaurantId, restaurantId))
      .orderBy(orders.createdAt);
  },

  async getOrdersByWorker(workerId: string) {
    return db
      .select()
      .from(orders)
      .where(eq(orders.workerId, workerId))
      .orderBy(orders.createdAt);
  },
};

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function getSystemParams() {
  const result = await db
    .select()
    .from(systemParameters)
    .where(eq(systemParameters.id, 1))
    .limit(1);

  return result[0] ?? null;
}

async function calculateDeliveryFee(distanceMeters: number): Promise<number> {
  const params = await getSystemParams();
  const baseFee = params?.baseDeliveryFee ?? 4000;
  const perKmRate = params?.perKmRate ?? 1000;
  const distanceKm = distanceMeters / 1000;
  return Math.round(baseFee + perKmRate * distanceKm);
}
