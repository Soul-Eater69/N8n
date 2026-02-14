import { Router, Response, NextFunction } from 'express';
import { AuditService } from '../services/audit.service';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const auditService = new AuditService();

// Get audit logs (admin+)
router.get(
  '/',
  authenticate,
  authorize('owner', 'admin'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await auditService.getAuditLogs(req.user!.tenantId, {
        userId: req.query.userId as string,
        action: req.query.action as string,
        resourceType: req.query.resourceType as string,
        resourceId: req.query.resourceId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        page: parseInt(req.query.page as string, 10) || 1,
        limit: parseInt(req.query.limit as string, 10) || 50,
      });

      res.json({
        success: true,
        data: result.logs,
        meta: { total: result.total },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
