import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TicketService } from '../services/ticket.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

const ticketIdSchema = z.object({
  params: z.object({
    ticketId: z.string().uuid('Invalid ticket ID'),
  }),
});

const validateBarcodeSchema = z.object({
  body: z.object({
    barcode: z.string().min(1, 'Barcode is required'),
  }),
});

/**
 * GET /tickets
 * List all tickets belonging to the authenticated user.
 */
router.get(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const tickets = await TicketService.listByUser(req.user!.id);

      res.status(200).json({
        success: true,
        data: tickets,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /tickets/:ticketId
 * Get details of a specific ticket belonging to the authenticated user.
 */
router.get(
  '/:ticketId',
  authenticate,
  validate(ticketIdSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { ticketId } = req.params;
      const ticket = await TicketService.getById(ticketId, req.user!.id);

      res.status(200).json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /tickets/validate
 * Validate a ticket barcode for venue entry scanning.
 * Used by venue staff to verify ticket authenticity at the door.
 */
router.post(
  '/validate',
  authenticate,
  validate(validateBarcodeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { barcode } = req.body;
      const result = await TicketService.validateBarcode(barcode);

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
