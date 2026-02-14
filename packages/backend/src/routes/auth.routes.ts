import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService, TenantService } from '../services/auth.service';
import { validate } from '../middleware/validation';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { IApiResponse } from '@flowforge/shared';

const router = Router();
const authService = new AuthService();
const tenantService = new TenantService();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  tenantName: z.string().min(1).max(100),
  tenantSlug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// Register new tenant + owner
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, firstName, lastName, tenantName, tenantSlug } = req.body;

      const { tenant, owner } = await tenantService.createTenant(tenantName, tenantSlug, {
        email,
        password,
        firstName,
        lastName,
      });

      const { user, tokens } = await authService.login(email, password, tenant.id);

      const response: IApiResponse = {
        success: true,
        data: { user, tokens, tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug } },
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Login
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, tenantSlug } = req.body;

      // Look up tenant by slug
      const db = (await import('../config/database')).getDatabase();
      const tenant = await db('tenants').where({ slug: tenantSlug }).first();
      if (!tenant) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
        });
        return;
      }

      const result = await authService.login(email, password, tenant.id);

      const response: IApiResponse = {
        success: true,
        data: { ...result, tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug } },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Refresh token
router.post(
  '/refresh',
  validate(refreshSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokens = await authService.refreshToken(req.body.refreshToken);
      res.json({ success: true, data: tokens });
    } catch (error) {
      next(error);
    }
  }
);

// Get current user
router.get(
  '/me',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await authService.getUserById(req.user!.id, req.user!.tenantId);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }
);

// List users (admin+)
router.get(
  '/users',
  authenticate,
  authorize('owner', 'admin'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const users = await authService.getUsers(req.user!.tenantId);
      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  }
);

// Invite user
router.post(
  '/users/invite',
  authenticate,
  authorize('owner', 'admin'),
  validate(z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    role: z.enum(['admin', 'member', 'viewer']),
    password: z.string().min(8),
  })),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await authService.register(req.body, req.user!.tenantId);
      res.status(201).json({ success: true, data: result.user });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
