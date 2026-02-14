import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ReservationService } from '../services/reservation.service';
import { QueueService } from '../services/queue.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

const createReservationSchema = z.object({
  params: z.object({
    eventId: z.string().uuid('Invalid event ID'),
  }),
  body: z.object({
    seatIds: z
      .array(z.string().uuid('Invalid seat ID'))
      .min(1, 'At least one seat must be selected')
      .max(10, 'Cannot reserve more than 10 seats at once'),
  }),
});

const reservationIdSchema = z.object({
  params: z.object({
    reservationId: z.string().uuid('Invalid reservation ID'),
  }),
});

/**
 * POST /reservations/:eventId
 * Create a new seat reservation. Requires a valid booking token
 * obtained from the queue system (passed via x-booking-token header).
 */
router.post(
  '/:eventId',
  authenticate,
  validate(createReservationSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const bookingToken = req.headers['x-booking-token'] as string;

      if (!bookingToken) {
        res.status(400).json({
          success: false,
          error: 'Missing x-booking-token header. Join the queue to obtain a booking token.',
        });
        return;
      }

      const isValidToken = await QueueService.validateBookingToken(bookingToken);

      if (!isValidToken) {
        res.status(403).json({
          success: false,
          error: 'Invalid or expired booking token. Please rejoin the queue.',
        });
        return;
      }

      const { eventId } = req.params;
      const { seatIds } = req.body;

      const reservation = await ReservationService.createReservation(
        eventId,
        req.user!.id,
        seatIds,
      );

      res.status(201).json({
        success: true,
        data: reservation,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /reservations/:reservationId
 * Get details of a specific reservation belonging to the current user.
 */
router.get(
  '/:reservationId',
  authenticate,
  validate(reservationIdSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { reservationId } = req.params;
      const reservation = await ReservationService.getById(reservationId, req.user!.id);

      res.status(200).json({
        success: true,
        data: reservation,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /reservations/:reservationId/cancel
 * Cancel an existing reservation. Releases the held seats back to availability.
 */
router.post(
  '/:reservationId/cancel',
  authenticate,
  validate(reservationIdSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { reservationId } = req.params;
      const result = await ReservationService.cancel(reservationId, req.user!.id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
