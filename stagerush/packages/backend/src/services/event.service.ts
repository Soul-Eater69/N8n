import { getDb } from '../config/database';
import { getRedis } from '../config/redis';
import { generateId, paginate } from '../utils/helpers';
import { NotFoundError } from '../utils/errors';
import { REDIS_KEYS, SEAT_STATUS_CODE } from '@stagerush/shared';
import { IEvent, ISectionAvailability, ISeatAvailabilityMap } from '@stagerush/shared';
import { logger } from '../utils/logger';

export class EventService {
  private db = getDb();
  private redis = getRedis();

  async list(page = 1, limit = 20, status?: string): Promise<{ events: IEvent[]; total: number }> {
    const { offset, limit: safeLimit } = paginate(page, limit);

    let query = this.db('events')
      .leftJoin('venues', 'events.venue_id', 'venues.id')
      .select('events.*', 'venues.name as venue_name', 'venues.city as venue_city');

    if (status) query = query.where('events.status', status);

    const [{ count }] = await query.clone().count();
    const events = await query.orderBy('events.date', 'asc').offset(offset).limit(safeLimit);

    return { events: events.map(this.mapEvent), total: parseInt(count as string, 10) };
  }

  async getById(id: string): Promise<IEvent> {
    // Check Redis cache first
    const cached = await this.redis.get(REDIS_KEYS.EVENT_CACHE(id));
    if (cached) return JSON.parse(cached);

    const row = await this.db('events')
      .leftJoin('venues', 'events.venue_id', 'venues.id')
      .where('events.id', id)
      .select('events.*', 'venues.name as venue_name', 'venues.city as venue_city', 'venues.country as venue_country', 'venues.capacity as venue_capacity')
      .first();

    if (!row) throw new NotFoundError('Event', id);

    const event = this.mapEvent(row);

    // Cache for 30 seconds
    await this.redis.setex(REDIS_KEYS.EVENT_CACHE(id), 30, JSON.stringify(event));

    return event;
  }

  /**
   * Get real-time seat availability map from Redis.
   * Falls back to database if not cached.
   */
  async getAvailability(eventId: string): Promise<ISeatAvailabilityMap> {
    // Try Redis cache first
    const cached = await this.redis.get(REDIS_KEYS.SEAT_AVAILABILITY(eventId));
    if (cached) return JSON.parse(cached);

    // Build from database
    const sections = await this.db('sections')
      .leftJoin('events', function () {
        this.on('sections.venue_id', '=', 'events.venue_id');
      })
      .where('events.id', eventId)
      .select('sections.*');

    const sectionAvailability: ISectionAvailability[] = [];
    const seatMap: Record<string, number> = {};

    for (const section of sections) {
      const seats = await this.db('seats')
        .where({ event_id: eventId, section_id: section.id })
        .select('id', 'status');

      let available = 0, locked = 0, sold = 0;
      for (const seat of seats) {
        seatMap[seat.id] = SEAT_STATUS_CODE[seat.status] ?? 3;
        if (seat.status === 'available') available++;
        else if (seat.status === 'locked') locked++;
        else if (seat.status === 'sold' || seat.status === 'reserved') sold++;
      }

      sectionAvailability.push({
        sectionId: section.id,
        total: seats.length,
        available,
        locked,
        sold,
        minPriceCents: section.price_cents,
      });
    }

    const result: ISeatAvailabilityMap = {
      eventId,
      sections: sectionAvailability,
      updatedAt: Date.now(),
      seatMap,
    };

    // Cache for 1 second (very short - real-time accuracy needed)
    await this.redis.setex(REDIS_KEYS.SEAT_AVAILABILITY(eventId), 1, JSON.stringify(result));

    return result;
  }

  async getSections(eventId: string) {
    const event = await this.db('events').where({ id: eventId }).first();
    if (!event) throw new NotFoundError('Event', eventId);

    return this.db('sections')
      .where({ venue_id: event.venue_id })
      .orderBy('sort_order', 'asc');
  }

  async getSeatsForSection(eventId: string, sectionId: string) {
    return this.db('seats')
      .where({ event_id: eventId, section_id: sectionId })
      .leftJoin('rows', 'seats.row_id', 'rows.id')
      .select('seats.*', 'rows.label as row_label')
      .orderBy(['rows.sort_order', 'seats.label']);
  }

  /**
   * Create event with auto-generated seats.
   */
  async create(data: any): Promise<IEvent> {
    const id = generateId();
    const [event] = await this.db('events')
      .insert({
        id,
        name: data.name,
        artist: data.artist,
        description: data.description,
        image_url: data.imageUrl,
        banner_url: data.bannerUrl,
        venue_id: data.venueId,
        date: data.date,
        doors_open: data.doorsOpen,
        show_time: data.showTime,
        sale_starts_at: data.saleStartsAt,
        max_tickets_per_order: data.maxTicketsPerOrder || 6,
        tags: data.tags || [],
      })
      .returning('*');

    logger.info({ eventId: id }, 'Event created');
    return this.mapEvent(event);
  }

  /**
   * Generate seats for an event based on venue sections and rows.
   */
  async generateSeats(eventId: string): Promise<number> {
    const event = await this.db('events').where({ id: eventId }).first();
    if (!event) throw new NotFoundError('Event', eventId);

    const sections = await this.db('sections').where({ venue_id: event.venue_id });
    const rows = await this.db('rows').whereIn('section_id', sections.map((s: any) => s.id));

    let totalSeats = 0;
    let minPrice = Infinity;
    let maxPrice = 0;

    const seatInserts: any[] = [];

    for (const row of rows) {
      const section = sections.find((s: any) => s.id === row.section_id);
      if (!section) continue;

      for (let i = 1; i <= row.seat_count; i++) {
        seatInserts.push({
          id: generateId(),
          row_id: row.id,
          section_id: section.id,
          event_id: eventId,
          label: String(i),
          status: 'available',
          price_cents: section.price_cents,
          seat_type: section.category === 'vip' ? 'vip' : section.category === 'premium' ? 'premium' : 'standard',
        });
        totalSeats++;
        minPrice = Math.min(minPrice, section.price_cents);
        maxPrice = Math.max(maxPrice, section.price_cents);
      }
    }

    // Batch insert seats (chunked for large venues)
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < seatInserts.length; i += CHUNK_SIZE) {
      await this.db('seats').insert(seatInserts.slice(i, i + CHUNK_SIZE));
    }

    // Update event counts
    await this.db('events').where({ id: eventId }).update({
      total_seats: totalSeats,
      available_seats: totalSeats,
      min_price_cents: minPrice === Infinity ? 0 : minPrice,
      max_price_cents: maxPrice,
    });

    logger.info({ eventId, totalSeats }, 'Seats generated');
    return totalSeats;
  }

  async publish(eventId: string): Promise<IEvent> {
    const [event] = await this.db('events')
      .where({ id: eventId })
      .update({ status: 'published', updated_at: new Date() })
      .returning('*');
    if (!event) throw new NotFoundError('Event', eventId);
    return this.mapEvent(event);
  }

  async getSalesStats(eventId: string) {
    const event = await this.db('events').where({ id: eventId }).first();
    if (!event) throw new NotFoundError('Event', eventId);

    const [revenue] = await this.db('payments')
      .join('reservations', 'payments.reservation_id', 'reservations.id')
      .where({ 'reservations.event_id': eventId, 'payments.status': 'succeeded' })
      .sum('payments.amount_cents as total_revenue')
      .count('* as total_orders');

    const sectionStats = await this.db('seats')
      .where({ event_id: eventId })
      .leftJoin('sections', 'seats.section_id', 'sections.id')
      .select('sections.name as section_name', 'sections.code as section_code')
      .count('* as total')
      .sum(this.db.raw("CASE WHEN seats.status = 'sold' THEN 1 ELSE 0 END as sold"))
      .sum(this.db.raw("CASE WHEN seats.status = 'available' THEN 1 ELSE 0 END as available"))
      .groupBy('sections.name', 'sections.code');

    return {
      event: this.mapEvent(event),
      revenue: {
        totalCents: parseInt(revenue.total_revenue as string, 10) || 0,
        totalOrders: parseInt(revenue.total_orders as string, 10) || 0,
      },
      sections: sectionStats,
    };
  }

  private mapEvent(r: any): IEvent {
    return {
      id: r.id, name: r.name, artist: r.artist, description: r.description,
      imageUrl: r.image_url, bannerUrl: r.banner_url, venueId: r.venue_id,
      venue: r.venue_name ? { id: r.venue_id, name: r.venue_name, city: r.venue_city, country: r.venue_country || '', capacity: r.venue_capacity || 0, createdAt: '' } : undefined,
      date: r.date?.toISOString(), doorsOpen: r.doors_open?.toISOString(), showTime: r.show_time?.toISOString(),
      saleStartsAt: r.sale_starts_at?.toISOString(), saleEndsAt: r.sale_ends_at?.toISOString(),
      status: r.status, totalSeats: r.total_seats, availableSeats: r.available_seats, soldSeats: r.sold_seats,
      minPriceCents: r.min_price_cents, maxPriceCents: r.max_price_cents,
      maxTicketsPerOrder: r.max_tickets_per_order, tags: r.tags || [],
      createdAt: r.created_at?.toISOString(), updatedAt: r.updated_at?.toISOString(),
    };
  }
}
