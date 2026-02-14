import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { IApiResponse } from '@flowforge/shared';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    const response: IApiResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: (err as any).details,
      },
    };

    if (err.statusCode >= 500) {
      logger.error({ err, code: err.code }, err.message);
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Unexpected errors
  logger.error({ err }, 'Unhandled error');

  const response: IApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  };

  res.status(500).json(response);
}

export function notFoundHandler(_req: Request, res: Response): void {
  const response: IApiResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
    },
  };

  res.status(404).json(response);
}
