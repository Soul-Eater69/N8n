import { getDb } from '../config/database';
import { NotFoundError } from '../utils/errors';
import { ITicket } from '@stagerush/shared';

export class TicketService {
  private db = getDb();

  async getByUser(userId: string): Promise<ITicket[]> {
    const rows = await this.db('tickets')
      .where({ user_id: userId })
      .orderBy('issued_at', 'desc');
    return rows.map(this.map);
  }

  async getById(id: string, userId: string): Promise<ITicket> {
    const row = await this.db('tickets').where({ id, user_id: userId }).first();
    if (!row) throw new NotFoundError('Ticket', id);
    return this.map(row);
  }

  /**
   * Validate ticket at venue entrance.
   * Returns ticket info if valid, throws if invalid.
   */
  async validate(barcode: string): Promise<ITicket & { eventName: string; userName: string }> {
    const row = await this.db('tickets')
      .where({ 'tickets.barcode': barcode })
      .leftJoin('events', 'tickets.event_id', 'events.id')
      .leftJoin('users', 'tickets.user_id', 'users.id')
      .select('tickets.*', 'events.name as event_name', 'users.first_name', 'users.last_name')
      .first();

    if (!row) throw new NotFoundError('Ticket');
    if (row.status === 'used') throw new Error('Ticket already scanned');
    if (row.status === 'cancelled') throw new Error('Ticket is cancelled');

    // Mark as used
    await this.db('tickets').where({ id: row.id }).update({ status: 'used', scanned_at: new Date() });

    return {
      ...this.map(row),
      eventName: row.event_name,
      userName: `${row.first_name} ${row.last_name}`,
    };
  }

  private map(r: any): ITicket {
    return {
      id: r.id, orderId: r.order_id, eventId: r.event_id, userId: r.user_id,
      seatId: r.seat_id, seatLabel: r.seat_label, sectionName: r.section_name,
      rowLabel: r.row_label, qrCode: r.qr_code, barcode: r.barcode,
      status: r.status, issuedAt: r.issued_at?.toISOString(), scannedAt: r.scanned_at?.toISOString(),
    };
  }
}
