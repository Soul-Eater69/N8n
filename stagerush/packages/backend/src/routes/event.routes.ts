import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { EventService } from '../services/event.service';
import { validate } from '../middleware/validation';

const router = Router();

const listEventsSchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20)),
    search: z.string().optional(),
    category: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
});

const eventIdSchema = z.object({
  params: z.object({
    eventId: z.string().uuid('Invalid event ID'),
  }),
});

const sectionSeatsSchema = z.object({
  params: z.object({
    eventId: z.string().uuid('Invalid event ID'),
    sectionId: z.string().uuid('Invalid section ID'),
  }),
});

/**
 * GET /events
 * List events with optional filtering and pagination.
 */
router.get(
  '/',
  validate(listEventsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, search, category, startDate, endDate } = req.query as {
        page: number;
        limit: number;
        search?: string;
        category?: string;
        startDate?: string;
        endDate?: string;
      };

      const result = await EventService.list({
        page,
        limit,
        search,
        category,
        startDate,
        endDate,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /events/:eventId
 * Get a single event by its ID.
 */
router.get(
  '/:eventId',
  validate(eventIdSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const event = await EventService.getById(eventId);

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
 * GET /events/:eventId/sections
 * Get all sections for a given event's venue.
 */
router.get(
  '/:eventId/sections',
  validate(eventIdSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const sections = await EventService.getSections(eventId);

      res.status(200).json({
        success: true,
        data: sections,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /events/:eventId/availability
 * Get seat availability summary for an event.
 */
router.get(
  '/:eventId/availability',
  validate(eventIdSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const availability = await EventService.getAvailability(eventId);

      res.status(200).json({
        success: true,
        data: availability,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /events/:eventId/sections/:sectionId/seats
 * Get individual seats for a specific section in an event.
 */
router.get(
  '/:eventId/sections/:sectionId/seats',
  validate(sectionSeatsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId, sectionId } = req.params;
      const seats = await EventService.getSeatsForSection(eventId, sectionId);

      res.status(200).json({
        success: true,
        data: seats,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
