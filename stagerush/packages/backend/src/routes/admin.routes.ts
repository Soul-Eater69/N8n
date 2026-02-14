import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { EventService } from '../services/event.service';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

// All admin routes require authentication + admin/super_admin role
router.use(authenticate);
router.use(authorize('admin', 'super_admin'));

const createEventSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Event name is required')
      .max(255, 'Event name must not exceed 255 characters'),
    description: z.string().optional(),
    date: z.string().datetime('Invalid date format'),
    venueId: z.string().uuid('Invalid venue ID'),
    category: z.string().optional(),
    imageUrl: z.string().url('Invalid image URL').optional(),
  }),
});

const eventIdSchema = z.object({
  params: z.object({
    eventId: z.string().uuid('Invalid event ID'),
  }),
});

const generateSeatsSchema = z.object({
  params: z.object({
    eventId: z.string().uuid('Invalid event ID'),
  }),
  body: z.object({
    pricingMap: z.record(
      z.string().uuid('Invalid section ID'),
      z.number().positive('Price must be positive'),
    ),
  }),
});

const sectionSchema = z.object({
  name: z
    .string()
    .min(1, 'Section name is required')
    .max(100, 'Section name must not exceed 100 characters'),
  capacity: z.number().int().positive('Capacity must be a positive integer'),
  rows: z.array(
    z.object({
      label: z
        .string()
        .min(1, 'Row label is required')
        .max(10, 'Row label must not exceed 10 characters'),
      seatsCount: z.number().int().positive('Seats count must be a positive integer'),
    }),
  ),
});

const createVenueSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Venue name is required')
      .max(255, 'Venue name must not exceed 255 characters'),
    address: z.string().min(1, 'Address is required'),
    city: z.string().min(1, 'City is required'),
    country: z.string().min(1, 'Country is required'),
    totalCapacity: z.number().int().positive('Total capacity must be a positive integer'),
    sections: z.array(sectionSchema).min(1, 'At least one section is required'),
  }),
});

const salesStatsSchema = z.object({
  params: z.object({
    eventId: z.string().uuid('Invalid event ID'),
  }),
});

/**
 * POST /admin/events
 * Create a new event.
 */
router.post(
  '/events',
  validate(createEventSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const event = await EventService.create(req.body);

      res.status(201).json({
        success: true,
        data: event,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /admin/events/:eventId/publish
 * Publish an event, making it visible to the public and opening the queue.
 */
router.post(
  '/events/:eventId/publish',
  validate(eventIdSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const event = await EventService.publish(eventId);

      res.status(200).json({
        success: true,
        data: event,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /admin/events/:eventId/generate-seats
 * Generate seat inventory for an event based on its venue layout
 * and the provided pricing map per section.
 */
router.post(
  '/events/:eventId/generate-seats',
  validate(generateSeatsSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const { pricingMap } = req.body;
      const result = await EventService.generateSeats(eventId, pricingMap);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /admin/venues
 * Create a new venue with its sections and row layout.
 */
router.post(
  '/venues',
  validate(createVenueSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const venue = await EventService.createVenue(req.body);

      res.status(201).json({
        success: true,
        data: venue,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /admin/events/:eventId/sales-stats
 * Get sales statistics for a specific event (revenue, tickets sold, etc.).
 */
router.get(
  '/events/:eventId/sales-stats',
  validate(salesStatsSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const stats = await EventService.getSalesStats(eventId);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
