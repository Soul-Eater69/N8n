// ============================================================================
// VENUE & EVENT
// ============================================================================

export interface IVenue {
  id: string;
  name: string;
  city: string;
  country: string;
  capacity: number;
  mapSvgUrl?: string;
  createdAt: string;
}

export interface ISection {
  id: string;
  venueId: string;
  name: string;
  code: string; // e.g. "A", "B", "FLOOR", "VIP"
  category: SectionCategory;
  capacity: number;
  color: string;
  priceCents: number;
  sortOrder: number;
  mapCoordinates?: { x: number; y: number; width: number; height: number };
}

export type SectionCategory = 'vip' | 'premium' | 'standard' | 'economy' | 'floor' | 'accessible';

export interface IRow {
  id: string;
  sectionId: string;
  label: string; // "A", "B", etc.
  seatCount: number;
  sortOrder: number;
}

export interface ISeat {
  id: string;
  rowId: string;
  sectionId: string;
  eventId: string;
  label: string; // "1", "2", etc.
  status: SeatStatus;
  priceCents: number;
  seatType: SeatType;
  x?: number;
  y?: number;
}

export type SeatStatus = 'available' | 'locked' | 'reserved' | 'sold' | 'held' | 'unavailable';
export type SeatType = 'standard' | 'premium' | 'vip' | 'accessible' | 'companion' | 'restricted_view';

export interface IEvent {
  id: string;
  name: string;
  artist: string;
  description: string;
  imageUrl: string;
  bannerUrl?: string;
  venueId: string;
  venue?: IVenue;
  date: string;
  doorsOpen: string;
  showTime: string;
  saleStartsAt: string;
  saleEndsAt?: string;
  status: EventStatus;
  totalSeats: number;
  availableSeats: number;
  soldSeats: number;
  minPriceCents: number;
  maxPriceCents: number;
  maxTicketsPerOrder: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type EventStatus = 'draft' | 'published' | 'on_sale' | 'sold_out' | 'cancelled' | 'completed';

// ============================================================================
// QUEUE (Virtual Waiting Room)
// ============================================================================

export interface IQueueEntry {
  userId: string;
  eventId: string;
  position: number;
  totalInQueue: number;
  estimatedWaitSeconds: number;
  joinedAt: number;
  status: QueueStatus;
  queueToken: string;
}

export type QueueStatus = 'waiting' | 'admitted' | 'expired' | 'left';

export interface IQueueStats {
  eventId: string;
  totalInQueue: number;
  drainRatePerSecond: number;
  estimatedWaitSeconds: number;
  admittedCount: number;
  activeBookings: number;
}

export interface IBookingToken {
  token: string;
  eventId: string;
  userId: string;
  expiresAt: number;
  maxSeats: number;
}

// ============================================================================
// RESERVATIONS & ORDERS
// ============================================================================

export interface IReservation {
  id: string;
  eventId: string;
  userId: string;
  seatIds: string[];
  status: ReservationStatus;
  totalCents: number;
  fees: IFeeBreakdown;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export type ReservationStatus = 'pending' | 'locked' | 'payment_processing' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';

export interface IFeeBreakdown {
  subtotalCents: number;
  serviceFeesCents: number;
  facilityFeeCents: number;
  taxCents: number;
  totalCents: number;
}

export interface IOrder {
  id: string;
  reservationId: string;
  userId: string;
  eventId: string;
  status: OrderStatus;
  totalCents: number;
  fees: IFeeBreakdown;
  tickets: ITicket[];
  paymentId?: string;
  createdAt: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'cancelled' | 'refunded';

// ============================================================================
// PAYMENTS
// ============================================================================

export interface IPayment {
  id: string;
  orderId: string;
  reservationId: string;
  userId: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  providerPaymentId?: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded';

// ============================================================================
// TICKETS
// ============================================================================

export interface ITicket {
  id: string;
  orderId: string;
  eventId: string;
  userId: string;
  seatId: string;
  seatLabel: string;
  sectionName: string;
  rowLabel: string;
  qrCode: string;
  barcode: string;
  status: TicketStatus;
  issuedAt: string;
  scannedAt?: string;
}

export type TicketStatus = 'valid' | 'used' | 'cancelled' | 'transferred';

// ============================================================================
// USERS
// ============================================================================

export interface IUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  isVerified: boolean;
  createdAt: string;
}

export type UserRole = 'customer' | 'admin' | 'scanner' | 'super_admin';

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface IApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: Record<string, unknown> };
  meta?: { page?: number; limit?: number; total?: number; totalPages?: number };
}

// ============================================================================
// WEBSOCKET EVENTS
// ============================================================================

export type WSEventType =
  | 'queue:position'
  | 'queue:admitted'
  | 'queue:stats'
  | 'seat:updated'
  | 'seat:batch_update'
  | 'reservation:timer'
  | 'reservation:expired'
  | 'reservation:confirmed'
  | 'event:sold_out'
  | 'event:stats';

export interface IWSMessage<T = unknown> {
  type: WSEventType;
  payload: T;
  timestamp: number;
}

// ============================================================================
// AVAILABILITY MAP (compact for wire transfer)
// ============================================================================

export interface ISectionAvailability {
  sectionId: string;
  total: number;
  available: number;
  locked: number;
  sold: number;
  minPriceCents: number;
}

export interface ISeatAvailabilityMap {
  eventId: string;
  sections: ISectionAvailability[];
  updatedAt: number;
  /** Compact bitmap: seat_id → status_code (0=available, 1=locked, 2=sold, 3=unavailable) */
  seatMap: Record<string, number>;
}
