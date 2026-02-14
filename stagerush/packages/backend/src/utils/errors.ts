export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(id ? `${resource} '${id}' not found` : `${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string) { super(message, 400, 'VALIDATION_ERROR'); }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') { super(message, 401, 'UNAUTHORIZED'); }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') { super(message, 403, 'FORBIDDEN'); }
}

export class ConflictError extends AppError {
  constructor(message: string) { super(message, 409, 'CONFLICT'); }
}

export class SeatUnavailableError extends AppError {
  constructor(seatIds: string[]) {
    super(`Seats unavailable: ${seatIds.join(', ')}`, 409, 'SEATS_UNAVAILABLE');
  }
}

export class QueueRequiredError extends AppError {
  constructor() { super('Valid queue booking token required', 403, 'QUEUE_TOKEN_REQUIRED'); }
}

export class ReservationExpiredError extends AppError {
  constructor(id: string) { super(`Reservation ${id} has expired`, 410, 'RESERVATION_EXPIRED'); }
}

export class RateLimitError extends AppError {
  constructor() { super('Too many requests', 429, 'RATE_LIMITED'); }
}
