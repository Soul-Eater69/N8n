import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CredentialService } from '../services/credential.service';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();
const credentialService = new CredentialService();

const createSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.string().min(1),
  data: z.record(z.unknown()),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255),
  data: z.record(z.unknown()),
});

// List credentials
router.get(
  '/',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const credentials = await credentialService.list(req.user!.tenantId);
      res.json({ success: true, data: credentials });
    } catch (error) {
      next(error);
    }
  }
);

// Get credential
router.get(
  '/:id',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const credential = await credentialService.getById(
        req.params.id,
        req.user!.tenantId,
        req.query.includeData === 'true'
      );
      res.json({ success: true, data: credential });
    } catch (error) {
      next(error);
    }
  }
);

// Create credential
router.post(
  '/',
  authenticate,
  authorize('owner', 'admin', 'member'),
  validate(createSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const credential = await credentialService.create(
        req.body.name,
        req.body.type,
        req.body.data,
        req.user!.id,
        req.user!.tenantId
      );
      res.status(201).json({ success: true, data: credential });
    } catch (error) {
      next(error);
    }
  }
);

// Update credential
router.put(
  '/:id',
  authenticate,
  authorize('owner', 'admin', 'member'),
  validate(updateSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const credential = await credentialService.update(
        req.params.id,
        req.body.name,
        req.body.data,
        req.user!.id,
        req.user!.tenantId
      );
      res.json({ success: true, data: credential });
    } catch (error) {
      next(error);
    }
  }
);

// Delete credential
router.delete(
  '/:id',
  authenticate,
  authorize('owner', 'admin'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await credentialService.delete(req.params.id, req.user!.id, req.user!.tenantId);
      res.json({ success: true, data: { deleted: true } });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
