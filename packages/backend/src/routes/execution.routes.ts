import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ExecutionService } from '../services/execution.service';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();
const executionService = new ExecutionService();

const listQuerySchema = z.object({
  workflowId: z.string().uuid().optional(),
  status: z.enum(['pending', 'running', 'success', 'error', 'cancelled', 'waiting', 'retry']).optional(),
  mode: z.enum(['manual', 'trigger', 'webhook', 'retry', 'sub_workflow']).optional(),
  startedAfter: z.string().optional(),
  startedBefore: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

// List executions
router.get(
  '/',
  authenticate,
  validate(listQuerySchema, 'query'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { executions, total } = await executionService.list(
        req.user!.tenantId,
        req.query as any
      );

      res.json({
        success: true,
        data: executions,
        meta: { total, limit: req.query.limit, offset: req.query.offset },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get execution detail
router.get(
  '/:id',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const execution = await executionService.getById(req.params.id, req.user!.tenantId);
      res.json({ success: true, data: execution });
    } catch (error) {
      next(error);
    }
  }
);

// Cancel execution
router.post(
  '/:id/cancel',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await executionService.cancel(req.params.id, req.user!.tenantId);
      res.json({ success: true, data: { cancelled: true } });
    } catch (error) {
      next(error);
    }
  }
);

// Get execution stats
router.get(
  '/stats/overview',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const days = parseInt(req.query.days as string, 10) || 30;
      const stats = await executionService.getStats(req.user!.tenantId, days);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
