import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PaymentService } from '../services/payment.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

const processPaymentSchema = z.object({
  body: z.object({
    reservationId: z.string().uuid('Invalid reservation ID'),
  }),
});

const paymentIdSchema = z.object({
  params: z.object({
    paymentId: z.string().uuid('Invalid payment ID'),
  }),
});

/**
 * POST /payments
 * Process a payment for a reservation. Transitions the reservation
 * from "reserved" to "paid" and generates tickets.
 */
router.post(
  '/',
  authenticate,
  validate(processPaymentSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { reservationId } = req.body;
      const payment = await PaymentService.processPayment(reservationId, req.user!.id);

      res.status(201).json({
        success: true,
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /payments/:paymentId
 * Get details of a specific payment.
 */
router.get(
  '/:paymentId',
  authenticate,
  validate(paymentIdSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { paymentId } = req.params;
      const payment = await PaymentService.getById(paymentId);

      res.status(200).json({
        success: true,
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
