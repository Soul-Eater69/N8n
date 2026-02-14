import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { QueueService } from '../services/queue.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { queueJoinLimiter } from '../middleware/rateLimiter';

const router = Router();

const queueEventSchema = z.object({
  params: z.object({
    eventId: z.string().uuid('Invalid event ID'),
  }),
});

/**
 * POST /queue/:eventId/join
 * Join the ticket-purchase queue for a specific event.
 * Rate-limited to prevent abuse.
 */
router.post(
  '/:eventId/join',
  authenticate,
  queueJoinLimiter,
  validate(queueEventSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const result = await QueueService.joinQueue(eventId, req.user!.id);

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
 * GET /queue/:eventId/position
 * Get the current user's position in the queue for an event.
 */
router.get(
  '/:eventId/position',
  authenticate,
  validate(queueEventSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const position = await QueueService.getPosition(eventId, req.user!.id);

      res.status(200).json({
        success: true,
        data: position,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /queue/:eventId/leave
 * Leave the queue for a specific event.
 */
router.delete(
  '/:eventId/leave',
  authenticate,
  validate(queueEventSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      await QueueService.leaveQueue(eventId, req.user!.id);

      res.status(200).json({
        success: true,
        data: { message: 'Successfully left the queue' },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /queue/:eventId/stats
 * Get queue statistics for an event (total in queue, estimated wait, etc.).
 */
router.get(
  '/:eventId/stats',
  validate(queueEventSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const stats = await QueueService.getStats(eventId);

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
