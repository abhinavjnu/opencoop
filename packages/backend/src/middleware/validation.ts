import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export function validate<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      res.status(400).json({ error: 'Validation failed', details: errors });
      return;
    }
    req.body = result.data;
    next();
  };
}

const geoLocation = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const address = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  postalCode: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  name: z.string().min(1).max(255),
  phone: z.string().min(1).max(20),
  role: z.enum(['customer', 'restaurant', 'worker']),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createOrderSchema = z.object({
  restaurantId: z.string().uuid(),
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).min(1),
  deliveryAddress: address,
  tip: z.number().int().min(0).default(0),
});

export const acceptOrderSchema = z.object({
  estimatedPrepTime: z.number().int().min(1).optional(),
});

export const rejectOrderSchema = z.object({
  reason: z.string().min(1).default('No reason provided'),
});

export const claimOrderSchema = z.object({
  workerLocation: geoLocation.optional(),
});

export const pickupOrderSchema = z.object({
  workerLocation: geoLocation.optional(),
});

export const deliverOrderSchema = z.object({
  workerLocation: geoLocation.optional(),
  proofPhotoUrl: z.string().url().optional(),
  signatureConfirmation: z.boolean().optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(1).default('No reason provided'),
});

export const workerRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  name: z.string().min(1).max(255),
  phone: z.string().min(1).max(20),
  vehicleType: z.enum(['bicycle', 'motorcycle', 'car', 'walk']),
  zone: z.string().min(1).max(100),
});

export const workerOnlineSchema = z.object({
  location: geoLocation,
  zone: z.string().min(1).max(100).optional(),
});

export const workerOfflineSchema = z.object({
  reason: z.enum(['manual', 'inactivity', 'end_of_shift']).default('manual'),
});

export const workerLocationSchema = z.object({
  location: geoLocation,
});

export const createProposalSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(5000),
  category: z.enum(['delivery_fee', 'pool_rules', 'dispute_policy', 'membership', 'other']),
  parameterChange: z.object({
    parameter: z.string().min(1),
    currentValue: z.unknown(),
    proposedValue: z.unknown(),
  }).nullable().optional(),
});

export const castVoteSchema = z.object({
  vote: z.enum(['for', 'against', 'abstain']),
});

export const submitRatingSchema = z.object({
  orderId: z.string().uuid(),
  targetId: z.string().uuid(),
  targetRole: z.enum(['restaurant', 'worker']),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(2000).nullable().optional(),
});

export const appealRatingSchema = z.object({
  reason: z.string().min(1).max(2000),
});

export const resolveAppealSchema = z.object({
  resolution: z.enum(['upheld', 'removed', 'modified']),
  newScore: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().min(1).max(2000),
});

export const raiseDisputeSchema = z.object({
  orderId: z.string().uuid(),
  disputeType: z.enum(['quality', 'missing_items', 'wrong_order', 'delivery_issue', 'payment', 'other']),
  description: z.string().min(1).max(5000),
  evidence: z.array(z.string()).default([]),
});

export const resolveDisputeSchema = z.object({
  resolution: z.enum(['full_refund', 'partial_refund', 'no_refund', 'redelivery']),
  refundAmount: z.number().int().min(0).nullable().optional(),
  notes: z.string().min(1).max(2000),
});

export const addMenuItemSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).default(''),
  price: z.number().int().min(0),
  category: z.string().min(1).max(100),
  isAvailable: z.boolean().default(true),
});

export const updateMenuItemSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  price: z.number().int().min(0).optional(),
  category: z.string().min(1).max(100).optional(),
  isAvailable: z.boolean().optional(),
});

export const updateRestaurantStatusSchema = z.object({
  isOpen: z.boolean(),
});

export const settleDailySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
