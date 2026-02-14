// Timing
export const SEAT_LOCK_DURATION_MS = 7 * 60 * 1000; // 7 minutes
export const SEAT_LOCK_DURATION_SEC = 420;
export const QUEUE_HEARTBEAT_INTERVAL_MS = 30_000;
export const QUEUE_HEARTBEAT_TIMEOUT_MS = 60_000;
export const QUEUE_DRAIN_RATE_DEFAULT = 100; // users/sec admitted from queue
export const QUEUE_POSITION_UPDATE_MS = 2_000;
export const SEAT_MAP_REFRESH_MS = 1_000;
export const PAYMENT_TIMEOUT_MS = 5 * 60 * 1000;

// Limits
export const MAX_TICKETS_PER_ORDER = 6;
export const MAX_CONCURRENT_BOOKINGS = 50_000;
export const API_RATE_LIMIT_WINDOW_MS = 60_000;
export const API_RATE_LIMIT_MAX = 200;
export const AUTH_RATE_LIMIT_MAX = 10;
export const QUEUE_JOIN_RATE_LIMIT = 1; // per IP per event

// Fees
export const SERVICE_FEE_PERCENT = 0.15; // 15%
export const FACILITY_FEE_CENTS = 350; // $3.50
export const TAX_RATE = 0.08; // 8%

// Redis key prefixes
export const REDIS_KEYS = {
  QUEUE: (eventId: string) => `queue:${eventId}`,
  QUEUE_ADMITTED: (eventId: string) => `queue:admitted:${eventId}`,
  SEAT_LOCK: (eventId: string, seatId: string) => `seat_lock:${eventId}:${seatId}`,
  SEAT_AVAILABILITY: (eventId: string) => `seat_avail:${eventId}`,
  EVENT_CACHE: (eventId: string) => `event:${eventId}`,
  EVENT_STATS: (eventId: string) => `event_stats:${eventId}`,
  BOOKING_TOKEN: (token: string) => `booking_token:${token}`,
  IDEMPOTENCY: (key: string) => `idempotent:${key}`,
  RATE_LIMIT: (key: string) => `rate:${key}`,
  USER_SESSION: (userId: string) => `session:${userId}`,
} as const;

// Status codes for compact seat map
export const SEAT_STATUS_CODE: Record<string, number> = {
  available: 0,
  locked: 1,
  sold: 2,
  unavailable: 3,
  held: 3,
  reserved: 2,
};

export const SEAT_STATUS_FROM_CODE: Record<number, string> = {
  0: 'available',
  1: 'locked',
  2: 'sold',
  3: 'unavailable',
};
