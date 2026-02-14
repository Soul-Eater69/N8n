import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { WorkflowService } from '../services/workflow.service';
import { ExecutionService } from '../services/execution.service';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { executionLimiter } from '../middleware/rateLimiter';
import { addExecutionJob } from '../services/queue.service';

const router = Router();
const workflowService = new WorkflowService();
const executionService = new ExecutionService();

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  nodes: z.array(z.any()).optional(),
  connections: z.array(z.any()).optional(),
  settings: z.object({}).passthrough().optional(),
  tags: z.array(z.string()).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  nodes: z.array(z.any()).optional(),
  connections: z.array(z.any()).optional(),
  settings: z.object({}).passthrough().optional(),
  status: z.enum(['draft', 'active', 'inactive']).optional(),
  tags: z.array(z.string()).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().default('updated_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// List workflows
router.get(
  '/',
  authenticate,
  validate(listQuerySchema, 'query'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { workflows, total } = await workflowService.list(req.user!.tenantId, req.query as any);
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      res.json({
        success: true,
        data: workflows,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get workflow
router.get(
  '/:id',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const workflow = await workflowService.getById(req.params.id, req.user!.tenantId);
      res.json({ success: true, data: workflow });
    } catch (error) {
      next(error);
    }
  }
);

// Create workflow
router.post(
  '/',
  authenticate,
  authorize('owner', 'admin', 'member'),
  validate(createSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const workflow = await workflowService.create(req.body, req.user!.id, req.user!.tenantId);
      res.status(201).json({ success: true, data: workflow });
    } catch (error) {
      next(error);
    }
  }
);

// Update workflow
router.put(
  '/:id',
  authenticate,
  authorize('owner', 'admin', 'member'),
  validate(updateSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const workflow = await workflowService.update(
        req.params.id,
        req.body,
        req.user!.id,
        req.user!.tenantId
      );
      res.json({ success: true, data: workflow });
    } catch (error) {
      next(error);
    }
  }
);

// Delete workflow
router.delete(
  '/:id',
  authenticate,
  authorize('owner', 'admin'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await workflowService.delete(req.params.id, req.user!.id, req.user!.tenantId);
      res.json({ success: true, data: { deleted: true } });
    } catch (error) {
      next(error);
    }
  }
);

// Activate workflow
router.post(
  '/:id/activate',
  authenticate,
  authorize('owner', 'admin', 'member'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const workflow = await workflowService.activate(req.params.id, req.user!.id, req.user!.tenantId);
      res.json({ success: true, data: workflow });
    } catch (error) {
      next(error);
    }
  }
);

// Deactivate workflow
router.post(
  '/:id/deactivate',
  authenticate,
  authorize('owner', 'admin', 'member'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const workflow = await workflowService.deactivate(req.params.id, req.user!.id, req.user!.tenantId);
      res.json({ success: true, data: workflow });
    } catch (error) {
      next(error);
    }
  }
);

// Execute workflow manually
router.post(
  '/:id/execute',
  authenticate,
  authorize('owner', 'admin', 'member'),
  executionLimiter,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const execution = await executionService.create(
        req.params.id,
        req.user!.tenantId,
        'manual',
        req.user!.id
      );

      await addExecutionJob({
        executionId: execution.id,
        workflowId: req.params.id,
        tenantId: req.user!.tenantId,
        mode: 'manual',
        triggerData: req.body.triggerData,
      });

      res.status(202).json({ success: true, data: execution });
    } catch (error) {
      next(error);
    }
  }
);

// Get version history
router.get(
  '/:id/versions',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const versions = await workflowService.getVersionHistory(req.params.id, req.user!.tenantId);
      res.json({ success: true, data: versions });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
