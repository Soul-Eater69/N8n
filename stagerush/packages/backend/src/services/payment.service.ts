import { getDb } from '../config/database';
import { getRedis } from '../config/redis';
import { generateId, generateIdempotencyKey } from '../utils/helpers';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { REDIS_KEYS, PAYMENT_TIMEOUT_MS } from '@stagerush/shared';
import { IPayment } from '@stagerush/shared';
import { ReservationService } from './reservation.service';

/**
 * Payment Service - Idempotent Saga Pattern.
 *
 * Uses idempotency keys to prevent double-charges from retries.
 * Orchestrates the reservation→payment→confirmation saga with
 * compensating transactions on failure.
 *
 * Flow:
 * 1. Validate reservation + idempotency
 * 2. Create payment record (pending)
 * 3. Process with payment provider (Stripe)
 * 4. On success: confirm reservation, create order, issue tickets
 * 5. On failure: cancel reservation, release seats
 */
export class PaymentService {
  private db = getDb();
  private redis = getRedis();
  private reservationService = new ReservationService();

  /**
   * Process payment for a reservation.
   * Idempotent - safe to retry without double-charging.
   */
  async processPayment(
    reservationId: string,
    userId: string
  ): Promise<IPayment> {
    const idempotencyKey = generateIdempotencyKey(reservationId, userId);
    const idempotencyRedisKey = REDIS_KEYS.IDEMPOTENCY(idempotencyKey);

    // ── Idempotency check ──
    const existing = await this.redis.get(idempotencyRedisKey);
    if (existing) {
      const existingPayment = JSON.parse(existing);
      logger.info({ reservationId, paymentId: existingPayment.id }, 'Idempotent payment hit');
      return existingPayment;
    }

    // ── Validate reservation ──
    const reservation = await this.db('reservations')
      .where({ id: reservationId, user_id: userId })
      .first();

    if (!reservation) throw new NotFoundError('Reservation', reservationId);
    if (reservation.status === 'confirmed') {
      throw new ConflictError('Reservation already confirmed');
    }
    if (reservation.status !== 'locked') {
      throw new ValidationError(`Cannot pay for reservation in status: ${reservation.status}`);
    }
    if (new Date(reservation.expires_at) < new Date()) {
      throw new ValidationError('Reservation has expired');
    }

    const paymentId = generateId();

    try {
      // ── Create payment record ──
      await this.db('payments').insert({
        id: paymentId,
        reservation_id: reservationId,
        user_id: userId,
        amount_cents: reservation.total_cents,
        currency: 'usd',
        status: 'processing',
        provider: 'stripe',
        idempotency_key: idempotencyKey,
      });

      // Update reservation status
      await this.db('reservations')
        .where({ id: reservationId })
        .update({ status: 'payment_processing', updated_at: new Date() });

      // ── Simulate Stripe charge ──
      // In production: const paymentIntent = await stripe.paymentIntents.create(...)
      const providerPaymentId = `pi_${generateId().replace(/-/g, '').slice(0, 24)}`;

      // Simulate processing delay
      await new Promise((r) => setTimeout(r, 100));

      // ── Payment succeeded ──
      const [payment] = await this.db('payments')
        .where({ id: paymentId })
        .update({
          status: 'succeeded',
          provider_payment_id: providerPaymentId,
          updated_at: new Date(),
        })
        .returning('*');

      // ── Confirm reservation (saga step 3) ──
      await this.reservationService.confirm(reservationId);

      // ── Create order ──
      const orderId = generateId();
      await this.db('orders').insert({
        id: orderId,
        reservation_id: reservationId,
        user_id: userId,
        event_id: reservation.event_id,
        status: 'confirmed',
        total_cents: reservation.total_cents,
        fees: reservation.fees,
        payment_id: paymentId,
      });

      // ── Issue tickets (saga step 4) ──
      await this.issueTickets(orderId, reservation);

      // ── Cache idempotency result (24h) ──
      const result = this.mapPayment(payment);
      await this.redis.setex(idempotencyRedisKey, 86400, JSON.stringify(result));

      logger.info({ paymentId, reservationId, orderId }, 'Payment processed successfully');
      return result;

    } catch (error: any) {
      // ── Compensating transactions ──
      logger.error({ paymentId, reservationId, error: error.message }, 'Payment failed');

      await this.db('payments')
        .where({ id: paymentId })
        .update({ status: 'failed', updated_at: new Date() });

      // Release reservation (compensate)
      try {
        await this.reservationService.cancel(reservationId, userId);
      } catch {
        // Already cancelled
      }

      throw error;
    }
  }

  /**
   * Issue tickets for a confirmed order.
   */
  private async issueTickets(orderId: string, reservation: any): Promise<void> {
    const seats = await this.db('seats')
      .whereIn('id', reservation.seat_ids)
      .leftJoin('rows', 'seats.row_id', 'rows.id')
      .leftJoin('sections', 'seats.section_id', 'sections.id')
      .select('seats.id', 'seats.label', 'rows.label as row_label', 'sections.name as section_name');

    const QRCode = await import('qrcode');

    for (const seat of seats) {
      const ticketId = generateId();
      const barcode = `SR${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const qrData = JSON.stringify({
        ticketId,
        eventId: reservation.event_id,
        seatId: seat.id,
        barcode,
      });

      const qrCode = await QRCode.toDataURL(qrData, { width: 300, margin: 2 });

      await this.db('tickets').insert({
        id: ticketId,
        order_id: orderId,
        event_id: reservation.event_id,
        user_id: reservation.user_id,
        seat_id: seat.id,
        seat_label: seat.label,
        section_name: seat.section_name || 'General',
        row_label: seat.row_label || '-',
        qr_code: qrCode,
        barcode,
      });
    }
  }

  async getById(id: string): Promise<IPayment> {
    const row = await this.db('payments').where({ id }).first();
    if (!row) throw new NotFoundError('Payment', id);
    return this.mapPayment(row);
  }

  private mapPayment(row: any): IPayment {
    return {
      id: row.id,
      orderId: row.order_id,
      reservationId: row.reservation_id,
      userId: row.user_id,
      amountCents: row.amount_cents,
      currency: row.currency,
      status: row.status,
      provider: row.provider,
      providerPaymentId: row.provider_payment_id,
      idempotencyKey: row.idempotency_key,
      metadata: row.metadata,
      createdAt: row.created_at?.toISOString(),
      updatedAt: row.updated_at?.toISOString(),
    };
  }
}
