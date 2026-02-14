import rateLimit from 'express-rate-limit';
import { API_RATE_LIMIT_WINDOW_MS, API_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_MAX } from '@stagerush/shared';

const errorResponse = {
  success: false,
  error: { code: 'RATE_LIMITED', message: 'Too many requests' },
};

export const apiLimiter = rateLimit({
  windowMs: API_RATE_LIMIT_WINDOW_MS,
  max: API_RATE_LIMIT_MAX,
  message: errorResponse,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: API_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  message: errorResponse,
});

export const queueJoinLimiter = rateLimit({
  windowMs: 3600_000, // 1 hour
  max: 3, // 3 attempts per hour per IP per event
  keyGenerator: (req) => `${req.ip}:${req.params.eventId}`,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Queue join rate limit exceeded' } },
});
