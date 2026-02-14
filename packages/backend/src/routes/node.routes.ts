import { Router, Response, NextFunction } from 'express';
import { NodeRegistry } from '../engine/NodeRegistry';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all available node types
router.get(
  '/',
  authenticate,
  async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const registry = NodeRegistry.getInstance();
      const descriptions = registry.getAllDescriptions();

      res.json({
        success: true,
        data: descriptions,
        meta: { total: descriptions.length },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get node type by category
router.get(
  '/category/:category',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const registry = NodeRegistry.getInstance();
      const descriptions = registry.getByCategory(req.params.category);

      res.json({
        success: true,
        data: descriptions,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get single node type description
router.get(
  '/:type',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const registry = NodeRegistry.getInstance();
      const nodeType = decodeURIComponent(req.params.type);

      if (!registry.has(nodeType)) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Node type '${nodeType}' not found` },
        });
        return;
      }

      const description = registry.getDescription(nodeType);
      res.json({ success: true, data: description });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
