import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ── Users ──
  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.string('email').notNullable().unique();
    t.string('password_hash').notNullable();
    t.string('first_name').notNullable();
    t.string('last_name').notNullable();
    t.string('phone');
    t.enum('role', ['customer', 'admin', 'scanner', 'super_admin']).defaultTo('customer');
    t.boolean('is_verified').defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index('email');
  });

  // ── Venues ──
  await knex.schema.createTable('venues', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.string('name').notNullable();
    t.string('city').notNullable();
    t.string('country').notNullable();
    t.integer('capacity').notNullable();
    t.text('map_svg_url');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // ── Sections ──
  await knex.schema.createTable('sections', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('venue_id').notNullable().references('id').inTable('venues').onDelete('CASCADE');
    t.string('name').notNullable();
    t.string('code').notNullable();
    t.enum('category', ['vip', 'premium', 'standard', 'economy', 'floor', 'accessible']).defaultTo('standard');
    t.integer('capacity').notNullable();
    t.string('color').defaultTo('#4c6ef5');
    t.integer('price_cents').notNullable();
    t.integer('sort_order').defaultTo(0);
    t.jsonb('map_coordinates');
    t.index('venue_id');
  });

  // ── Rows ──
  await knex.schema.createTable('rows', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('section_id').notNullable().references('id').inTable('sections').onDelete('CASCADE');
    t.string('label').notNullable();
    t.integer('seat_count').notNullable();
    t.integer('sort_order').defaultTo(0);
    t.index('section_id');
  });

  // ── Events ──
  await knex.schema.createTable('events', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.string('name').notNullable();
    t.string('artist').notNullable();
    t.text('description');
    t.text('image_url');
    t.text('banner_url');
    t.uuid('venue_id').notNullable().references('id').inTable('venues');
    t.timestamp('date').notNullable();
    t.timestamp('doors_open').notNullable();
    t.timestamp('show_time').notNullable();
    t.timestamp('sale_starts_at').notNullable();
    t.timestamp('sale_ends_at');
    t.enum('status', ['draft', 'published', 'on_sale', 'sold_out', 'cancelled', 'completed']).defaultTo('draft');
    t.integer('total_seats').defaultTo(0);
    t.integer('available_seats').defaultTo(0);
    t.integer('sold_seats').defaultTo(0);
    t.integer('min_price_cents').defaultTo(0);
    t.integer('max_price_cents').defaultTo(0);
    t.integer('max_tickets_per_order').defaultTo(6);
    t.specificType('tags', 'text[]').defaultTo('{}');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
    t.index('status');
    t.index('sale_starts_at');
    t.index(['status', 'sale_starts_at']);
  });

  // ── Seats (the hot table) ──
  await knex.schema.createTable('seats', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('row_id').notNullable().references('id').inTable('rows').onDelete('CASCADE');
    t.uuid('section_id').notNullable().references('id').inTable('sections').onDelete('CASCADE');
    t.uuid('event_id').notNullable().references('id').inTable('events').onDelete('CASCADE');
    t.string('label').notNullable();
    t.enum('status', ['available', 'locked', 'reserved', 'sold', 'held', 'unavailable']).defaultTo('available');
    t.integer('price_cents').notNullable();
    t.enum('seat_type', ['standard', 'premium', 'vip', 'accessible', 'companion', 'restricted_view']).defaultTo('standard');
    t.float('x');
    t.float('y');
    // Critical index for fast availability lookups
    t.index(['event_id', 'section_id', 'status']);
    t.index(['event_id', 'status']);
    t.index('row_id');
  });

  // ── Reservations ──
  await knex.schema.createTable('reservations', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('event_id').notNullable().references('id').inTable('events');
    t.uuid('user_id').notNullable().references('id').inTable('users');
    t.specificType('seat_ids', 'uuid[]').notNullable();
    t.enum('status', ['pending', 'locked', 'payment_processing', 'confirmed', 'expired', 'cancelled', 'refunded']).defaultTo('pending');
    t.integer('total_cents').notNullable();
    t.jsonb('fees').notNullable();
    t.timestamp('expires_at').notNullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
    t.index('user_id');
    t.index('event_id');
    t.index(['status', 'expires_at']);
  });

  // ── Orders ──
  await knex.schema.createTable('orders', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('reservation_id').notNullable().references('id').inTable('reservations');
    t.uuid('user_id').notNullable().references('id').inTable('users');
    t.uuid('event_id').notNullable().references('id').inTable('events');
    t.enum('status', ['pending', 'confirmed', 'cancelled', 'refunded']).defaultTo('pending');
    t.integer('total_cents').notNullable();
    t.jsonb('fees').notNullable();
    t.uuid('payment_id');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index('user_id');
    t.index('event_id');
  });

  // ── Payments ──
  await knex.schema.createTable('payments', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('order_id').references('id').inTable('orders');
    t.uuid('reservation_id').notNullable().references('id').inTable('reservations');
    t.uuid('user_id').notNullable().references('id').inTable('users');
    t.integer('amount_cents').notNullable();
    t.string('currency').defaultTo('usd');
    t.enum('status', ['pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded']).defaultTo('pending');
    t.string('provider').defaultTo('stripe');
    t.string('provider_payment_id');
    t.string('idempotency_key').notNullable().unique();
    t.jsonb('metadata');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
    t.index('idempotency_key');
    t.index('reservation_id');
  });

  // ── Tickets ──
  await knex.schema.createTable('tickets', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('order_id').notNullable().references('id').inTable('orders');
    t.uuid('event_id').notNullable().references('id').inTable('events');
    t.uuid('user_id').notNullable().references('id').inTable('users');
    t.uuid('seat_id').notNullable().references('id').inTable('seats');
    t.string('seat_label').notNullable();
    t.string('section_name').notNullable();
    t.string('row_label').notNullable();
    t.text('qr_code').notNullable();
    t.string('barcode').notNullable().unique();
    t.enum('status', ['valid', 'used', 'cancelled', 'transferred']).defaultTo('valid');
    t.timestamp('issued_at').defaultTo(knex.fn.now());
    t.timestamp('scanned_at');
    t.index('user_id');
    t.index('event_id');
    t.index('barcode');
  });

  // ── Queue audit ──
  await knex.schema.createTable('queue_entries', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('event_id').notNullable().references('id').inTable('events');
    t.uuid('user_id').notNullable().references('id').inTable('users');
    t.integer('position');
    t.enum('status', ['waiting', 'admitted', 'expired', 'left']).defaultTo('waiting');
    t.timestamp('joined_at').defaultTo(knex.fn.now());
    t.timestamp('admitted_at');
    t.index(['event_id', 'user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  const tables = ['queue_entries', 'tickets', 'payments', 'orders', 'reservations', 'seats', 'events', 'rows', 'sections', 'venues', 'users'];
  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
}
