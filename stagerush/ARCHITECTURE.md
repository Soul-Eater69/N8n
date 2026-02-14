# StageRush - Enterprise Live Event Ticket Booking Platform

> A high-concurrency, distributed ticket booking system designed to handle
> Taylor Swift-level demand: **millions of concurrent users**, **zero overselling**,
> and **sub-second seat reservations**.

---

## Table of Contents

- [System Overview](#system-overview)
- [Architecture](#architecture)
- [Key Design Decisions](#key-design-decisions)
- [Scaling Strategy](#scaling-strategy)
- [Data Model](#data-model)
- [API Reference](#api-reference)
- [Real-Time Communication](#real-time-communication)
- [Queue System](#queue-system)
- [Reservation Engine](#reservation-engine)
- [Payment Processing](#payment-processing)
- [Frontend Architecture](#frontend-architecture)
- [Deployment](#deployment)
- [Getting Started](#getting-started)

---

## System Overview

StageRush is built to solve the hardest problem in event ticketing:
**selling 80,000 tickets to 10 million simultaneous users in under 5 minutes
without overselling a single seat.**

### Core Challenges Addressed

| Challenge | Solution |
|-----------|----------|
| 10M+ concurrent users hitting "Buy" | Virtual waiting room with fair FIFO queue |
| Double-booking the same seat | Redis distributed locks + PostgreSQL serializable transactions |
| Payment failures mid-checkout | Saga pattern with compensating transactions |
| Real-time seat availability | Redis pub/sub + Socket.IO broadcast |
| Flash traffic spikes | CDN-first frontend + auto-scaling API tier |
| Bot/scalper prevention | Queue tokens, rate limiting, fingerprinting, CAPTCHA |
| Data consistency | Event sourcing for audit trail + CQRS read/write separation |

### Capacity Targets

```
Concurrent Users:       10,000,000
Ticket Sales/minute:    50,000
Seat Lock Duration:     7 minutes
Payment Timeout:        5 minutes
API Response (p99):     < 200ms
Queue Position Update:  Every 2 seconds
Seat Map Refresh:       Every 1 second
System Availability:    99.99%
```

---

## Architecture

```
                                    ┌─────────────────┐
                                    │   CDN (Static)   │
                                    │  CloudFront/CF   │
                                    └────────┬─────────┘
                                             │
                            ┌────────────────┼────────────────┐
                            │                │                │
                    ┌───────▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐
                    │   Next.js    │  │   Next.js   │  │   Next.js  │
                    │  Frontend    │  │  Frontend   │  │  Frontend  │
                    │  (Vercel)    │  │  (Replica)  │  │  (Replica) │
                    └───────┬──────┘  └──────┬──────┘  └─────┬──────┘
                            │                │                │
                            └────────────────┼────────────────┘
                                             │
                                    ┌────────▼─────────┐
                                    │  Load Balancer   │
                                    │  (Nginx/ALB)     │
                                    └────────┬─────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              │                              │                              │
     ┌────────▼────────┐          ┌─────────▼─────────┐          ┌────────▼────────┐
     │   API Gateway   │          │   API Gateway     │          │   API Gateway   │
     │   (Express)     │          │   (Express)       │          │   (Express)     │
     │   Port 4100     │          │   Port 4100       │          │   Port 4100     │
     └────┬───┬───┬────┘          └────┬───┬───┬──────┘          └────┬───┬───┬────┘
          │   │   │                    │   │   │                      │   │   │
          │   │   │                    │   │   │                      │   │   │
    ┌─────┘   │   └─────┐       ┌─────┘   │   └─────┐          ┌────┘   │   └────┐
    │         │         │       │         │         │          │         │        │
    ▼         ▼         ▼       ▼         ▼         ▼          ▼         ▼        ▼
┌───────┐ ┌───────┐ ┌───────┐
│ Redis │ │  PG   │ │BullMQ │
│Cluster│ │Primary│ │Workers│
│       │ │+ Read │ │       │
│- Queue│ │Replica│ │- Pay  │
│- Locks│ │       │ │- Email│
│- Cache│ │       │ │- Clean│
│- PubSb│ │       │ │       │
└───────┘ └───────┘ └───────┘
```

### Service Responsibilities

| Service | Responsibility |
|---------|---------------|
| **API Gateway** | Request routing, auth, rate limiting, CORS |
| **Queue Service** | Virtual waiting room, position tracking, token issuance |
| **Reservation Service** | Seat locking, reservation creation, conflict resolution |
| **Payment Service** | Charge processing, refunds, idempotent operations |
| **Notification Service** | Email confirmations, SMS alerts, push notifications |
| **Event Service** | Event CRUD, venue management, pricing tiers |
| **Analytics Service** | Real-time dashboards, sales tracking, heatmaps |
| **WebSocket Gateway** | Real-time queue positions, seat map updates, countdowns |

---

## Key Design Decisions

### 1. Virtual Waiting Room (The Traffic Dam)

**Problem:** 10M users clicking "Buy" at the exact same moment.

**Solution:** A Redis-backed FIFO queue that:
- Assigns each user a queue position on arrival
- Drains users into the booking flow at a controlled rate (configurable TPS)
- Provides real-time position updates via WebSocket
- Issues time-limited JWT tokens for authorized shoppers

```
User Arrives → Queue (Redis Sorted Set) → Token Issued → Booking Flow → Payment
     │                    │                      │              │
     │              position: 45,231        valid: 7min    lock: 7min
     │              eta: ~3 min
     │
     └─→ WebSocket: position updates every 2s
```

**Why Sorted Set?** Redis ZSET with timestamp scores gives O(log N) insertion
and O(1) rank lookup - perfect for millions of queue entries.

### 2. Distributed Seat Locking (No Double-Sells)

**Problem:** Two users selecting the same seat at the same millisecond.

**Solution:** Two-phase locking with Redis + PostgreSQL:

```
Phase 1: Redis SETNX (optimistic lock, 7min TTL)
  - Key: seat_lock:{event_id}:{seat_id}
  - Value: {user_id}:{reservation_id}
  - If SETNX fails → seat taken, try another

Phase 2: PostgreSQL INSERT with SERIALIZABLE isolation
  - Atomic seat status update + reservation creation
  - If conflict → release Redis lock → notify user
```

**Why two phases?** Redis gives us sub-millisecond locking for the hot path
(millions of concurrent requests), while PostgreSQL provides the durability
guarantee (ACID) for the actual booking record.

### 3. Payment Saga Pattern

**Problem:** What if payment fails after seat is locked?

**Solution:** Orchestrated saga with compensating transactions:

```
1. Reserve Seat    → Lock in Redis + DB
2. Process Payment → Charge via Stripe
3. Confirm Booking → Update status to "confirmed"
4. Issue Ticket    → Generate QR code + email

If step 2 fails:
  → Compensate step 1 (release lock, mark cancelled)
  → Return seat to available pool
  → Notify user

If step 3 fails:
  → Refund payment (step 2 compensation)
  → Release seat (step 1 compensation)
```

### 4. CQRS for Read/Write Separation

**Write Path (PostgreSQL Primary):**
- Seat reservations
- Payment processing
- Order creation

**Read Path (Redis Cache + PG Read Replicas):**
- Seat availability maps (Redis bitmap)
- Event listings (Redis cache, 30s TTL)
- Queue positions (Redis sorted set)
- Analytics (read replicas)

### 5. Idempotency Everywhere

Every mutating operation uses an idempotency key:
- Reservation creation: `idempotency_key = hash(user_id + event_id + seat_ids + timestamp_bucket)`
- Payment: `idempotency_key = reservation_id`
- This prevents double-charges and duplicate bookings from retries

---

## Scaling Strategy

### Horizontal Scaling Tiers

```
Tier 1: CDN + Static Assets (handles 99% of page loads)
  └─ Next.js static pages, images, JS bundles
  └─ CloudFront/Cloudflare, 50+ edge locations

Tier 2: API Gateway (stateless, scale to 100+ pods)
  └─ Express.js, no local state
  └─ Auto-scale on CPU/request count
  └─ 16 instances handles ~50k req/s

Tier 3: Redis Cluster (6+ nodes)
  └─ Queue: 1M+ ops/sec
  └─ Locks: sub-ms response
  └─ Pub/Sub: real-time broadcasts

Tier 4: PostgreSQL (Primary + Read Replicas)
  └─ Primary: write path only
  └─ 3-5 read replicas for queries
  └─ Connection pooling via PgBouncer

Tier 5: Background Workers (scale independently)
  └─ Payment processing: 20 workers
  └─ Email/notifications: 10 workers
  └─ Cleanup/expiry: 5 workers
```

### Load Profile (Taylor Swift Concert: 80,000 seats)

```
T-0:  Sale opens. 10M users in queue.
T+10s: Queue drains at 5,000 users/sec into booking flow.
T+30s: First seats locked. Redis handling 500k ops/sec.
T+2m:  50% of seats locked. Payment workers at full capacity.
T+5m:  80% of seats sold. Queue shrinking rapidly.
T+8m:  Sold out. Waitlist opens for cancellations.
T+10m: All pending payments resolved. Final count confirmed.
```

### Database Optimization

```sql
-- Seat availability uses Redis bitmaps for O(1) checks
-- PostgreSQL handles the transactional writes only

-- Partitioned executions table by event_id for query performance
-- Partial indexes on hot queries
CREATE INDEX idx_seats_available ON seats (event_id, section_id)
  WHERE status = 'available';

-- Connection pooling: PgBouncer in transaction mode
-- Max connections: 200 (primary), 500 (per replica)
```

---

## Data Model

### Entity Relationship

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Venue   │────<│  Event   │────<│ Section  │
└──────────┘     └──────────┘     └──────────┘
                       │                │
                       │           ┌────▼────┐
                       │           │  Row    │
                       │           └────┬────┘
                       │                │
                  ┌────▼────┐     ┌────▼────┐
                  │  Order  │────<│  Seat   │
                  └────┬────┘     └─────────┘
                       │
                  ┌────▼────┐
                  │ Payment │
                  └────┬────┘
                       │
                  ┌────▼────┐
                  │ Ticket  │
                  └─────────┘
```

### Key Tables

| Table | Purpose | Write Volume |
|-------|---------|-------------|
| `events` | Event metadata, dates, venue | Low (admin only) |
| `sections` | Venue sections with pricing | Low (admin only) |
| `rows` | Row layout within sections | Low (admin only) |
| `seats` | Individual seats with status | **Extreme** (every booking) |
| `orders` | Customer orders | High (every checkout) |
| `payments` | Payment records | High (every checkout) |
| `tickets` | Issued tickets with QR | High (every confirmation) |
| `queue_entries` | Queue audit trail | Extreme (every user) |
| `users` | Customer accounts | Medium |

### Seat Status Machine

```
                    ┌──────────┐
          ┌────────►│ available│◄────────────┐
          │         └────┬─────┘             │
          │              │                   │
          │         user selects         timeout/
          │              │               cancel
          │              ▼                   │
          │         ┌──────────┐             │
    payment fail    │  locked  │─────────────┘
          │         └────┬─────┘
          │              │
          │         payment success
          │              │
          │              ▼
          │         ┌──────────┐
          └─────────│ reserved │
                    └────┬─────┘
                         │
                    confirmation
                         │
                         ▼
                    ┌──────────┐
                    │  sold    │
                    └──────────┘
```

---

## API Reference

### Authentication

```
POST   /api/v1/auth/register     Register new customer
POST   /api/v1/auth/login        Login (returns JWT)
POST   /api/v1/auth/refresh      Refresh access token
```

### Events

```
GET    /api/v1/events                   List events (cached, paginated)
GET    /api/v1/events/:id               Event detail (cached)
GET    /api/v1/events/:id/sections      Venue sections with pricing
GET    /api/v1/events/:id/availability  Seat availability map (Redis)
```

### Queue (Virtual Waiting Room)

```
POST   /api/v1/queue/:eventId/join      Join the queue
GET    /api/v1/queue/:eventId/position  Get current position
POST   /api/v1/queue/:eventId/heartbeat Keep-alive (prevents timeout)
WS     /queue                           Real-time position updates
```

### Reservations

```
POST   /api/v1/reservations             Lock seats (requires queue token)
GET    /api/v1/reservations/:id         Get reservation status
DELETE /api/v1/reservations/:id         Cancel reservation (release seats)
POST   /api/v1/reservations/:id/extend  Extend lock timer
```

### Payments

```
POST   /api/v1/payments                 Process payment for reservation
GET    /api/v1/payments/:id             Payment status
POST   /api/v1/payments/:id/refund      Request refund
```

### Tickets

```
GET    /api/v1/tickets                  List user's tickets
GET    /api/v1/tickets/:id              Ticket detail with QR
GET    /api/v1/tickets/:id/validate     Validate ticket (venue scanning)
```

### Admin

```
POST   /api/v1/admin/events             Create event
PUT    /api/v1/admin/events/:id         Update event
POST   /api/v1/admin/events/:id/publish Publish event (opens sale)
GET    /api/v1/admin/events/:id/stats   Real-time sales analytics
GET    /api/v1/admin/events/:id/orders  Order management
POST   /api/v1/admin/venues             Create venue with sections
```

---

## Real-Time Communication

### WebSocket Events

| Channel | Event | Direction | Description |
|---------|-------|-----------|-------------|
| `queue:{eventId}` | `position` | Server→Client | Queue position + ETA update |
| `queue:{eventId}` | `admitted` | Server→Client | User can proceed to booking |
| `queue:{eventId}` | `stats` | Server→Client | Total in queue, drain rate |
| `event:{eventId}` | `seatUpdate` | Server→Client | Seat status changed |
| `event:{eventId}` | `availabilitySnapshot` | Server→Client | Bulk availability update |
| `event:{eventId}` | `soldOut` | Server→Client | Section/event sold out |
| `reservation:{id}` | `timerUpdate` | Server→Client | Lock countdown |
| `reservation:{id}` | `expired` | Server→Client | Reservation expired |
| `reservation:{id}` | `confirmed` | Server→Client | Payment confirmed |

### Update Frequencies

```
Queue Position:     Every 2 seconds
Seat Availability:  Every 1 second (debounced batch)
Lock Timer:         Every 1 second
Sales Counter:      Every 5 seconds
```

---

## Queue System

### Virtual Waiting Room Flow

```
1. User opens event page
   └─→ Frontend connects WebSocket

2. Sale timer hits zero
   └─→ "Join Queue" button appears

3. User clicks "Join Queue"
   └─→ POST /queue/:eventId/join
   └─→ Server adds to Redis ZSET with timestamp score
   └─→ Returns queue_token + position

4. Queue drains at controlled rate
   └─→ Server pops users from front of ZSET
   └─→ Issues booking_token (JWT, 7min TTL)
   └─→ WebSocket: { type: "admitted", token: "..." }

5. User enters booking flow with token
   └─→ Token validated on every API call
   └─→ If token expires → back to queue

6. Heartbeat keeps place
   └─→ POST /queue/:eventId/heartbeat every 30s
   └─→ No heartbeat for 60s → removed from queue
```

### Anti-Bot Measures

- **Rate limiting:** 1 queue join per IP per event
- **Browser fingerprinting:** Canvas + WebGL + font enumeration
- **Invisible CAPTCHA:** Triggered on suspicious patterns
- **Queue token binding:** Token tied to browser fingerprint + IP
- **Proof of work:** Light computational challenge before queue join

---

## Reservation Engine

### Seat Lock Protocol

```typescript
// Step 1: Acquire Redis lock (optimistic, fast path)
const lockKey = `seat_lock:${eventId}:${seatId}`;
const acquired = await redis.set(lockKey, reservationId, 'NX', 'EX', 420); // 7min

if (!acquired) {
  throw new SeatUnavailableError(seatId);
}

// Step 2: Verify + persist in PostgreSQL (SERIALIZABLE)
await db.transaction(async (trx) => {
  const seat = await trx('seats')
    .where({ id: seatId, status: 'available' })
    .forUpdate()  // Row-level lock
    .first();

  if (!seat) {
    await redis.del(lockKey); // Release Redis lock
    throw new SeatUnavailableError(seatId);
  }

  await trx('seats').where({ id: seatId }).update({ status: 'locked' });
  await trx('reservations').insert({ ... });
});
```

### Lock Expiry & Cleanup

- Redis TTL: 7 minutes (auto-expires)
- Background worker: Scans for expired reservations every 30s
- PostgreSQL: Updates seat status back to 'available'
- WebSocket: Broadcasts newly available seats

---

## Payment Processing

### Idempotent Payment Flow

```
Client                    API                     Stripe              DB
  │                        │                        │                  │
  │──POST /payments───────►│                        │                  │
  │  {reservation_id,      │                        │                  │
  │   idempotency_key}     │                        │                  │
  │                        │──Check idempotency────►│                  │
  │                        │  (Redis SETNX)         │                  │
  │                        │                        │                  │
  │                        │──Create PaymentIntent─►│                  │
  │                        │                        │                  │
  │                        │◄──client_secret────────│                  │
  │◄─{client_secret}───────│                        │                  │
  │                        │                        │                  │
  │──Confirm (Stripe.js)──►│                        │                  │
  │                        │◄──webhook: succeeded───│                  │
  │                        │                        │                  │
  │                        │──Update reservation───►│──────────────────│
  │                        │  status='confirmed'    │                  │
  │                        │                        │                  │
  │                        │──Generate ticket──────►│──────────────────│
  │                        │  + QR code             │                  │
  │                        │                        │                  │
  │◄─WebSocket: confirmed──│                        │                  │
```

---

## Frontend Architecture

### Pages

| Route | Purpose | Caching |
|-------|---------|---------|
| `/` | Landing page, featured events | ISR (60s) |
| `/events` | Event listing with filters | ISR (30s) |
| `/events/:id` | Event detail, countdown | ISR + client revalidation |
| `/events/:id/queue` | Virtual waiting room | Client-side only |
| `/events/:id/book` | Seat map + selection | Client-side only |
| `/checkout/:reservationId` | Payment + confirmation | Client-side only |
| `/tickets` | User's ticket wallet | Client-side |
| `/tickets/:id` | Individual ticket + QR | Client-side |
| `/admin` | Admin dashboard | Client-side, role-gated |

### Component Architecture

```
<App>
├── <EventPage>
│   ├── <EventHero>           // Banner, dates, countdown
│   ├── <SaleCountdown>       // Animated countdown timer
│   └── <PricingTiers>        // Section prices overview
│
├── <QueuePage>
│   ├── <QueuePosition>       // Animated position counter
│   ├── <QueueProgress>       // Progress bar with ETA
│   └── <QueueEntertainment>  // Videos/content while waiting
│
├── <BookingPage>
│   ├── <VenueMap>            // Interactive SVG seat map
│   │   ├── <Section>         // Clickable venue sections
│   │   ├── <SeatGrid>        // Individual seat buttons
│   │   └── <SeatTooltip>     // Hover details
│   ├── <SelectionSummary>    // Selected seats + prices
│   ├── <LockTimer>           // Countdown to reservation expiry
│   └── <ProceedButton>       // CTA with price total
│
├── <CheckoutPage>
│   ├── <OrderSummary>        // Final price breakdown
│   ├── <StripePayment>       // Stripe Elements form
│   └── <ConfirmationView>    // Success + ticket preview
│
└── <TicketWallet>
    ├── <TicketCard>          // Ticket with event details
    └── <QRCode>              // Scannable entry code
```

---

## Deployment

### Production Architecture

```
┌────────────────────────────────────────────────────────────┐
│                      Cloudflare CDN                        │
│                   (Static assets, DDoS)                    │
└──────────────────────────┬─────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────┐
│                   Kubernetes Cluster                        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  API (x16)  │  │  WS (x8)   │  │ Worker(x20) │        │
│  │  HPA: CPU   │  │  HPA: conn │  │ HPA: queue  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌──────────────────────────────────────────────┐          │
│  │              Redis Cluster (6 nodes)          │          │
│  │  3 masters + 3 replicas, 64GB each           │          │
│  └──────────────────────────────────────────────┘          │
│                                                             │
│  ┌──────────────────────────────────────────────┐          │
│  │        PostgreSQL (RDS Multi-AZ)              │          │
│  │  Primary (r6g.4xlarge) + 3 Read Replicas      │          │
│  └──────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### Docker Services

```yaml
services:
  api:        Express API (16 replicas)
  websocket:  Socket.IO gateway (8 replicas)
  worker:     BullMQ processors (20 replicas)
  postgres:   PostgreSQL 16
  redis:      Redis 7 Cluster
  nginx:      Reverse proxy + SSL
  prometheus: Metrics collection
  grafana:    Dashboards
```

---

## Getting Started

### Prerequisites

- Node.js >= 20
- PostgreSQL 16
- Redis 7
- Docker & Docker Compose

### Quick Start

```bash
# Start infrastructure
cd stagerush
docker-compose up -d postgres redis

# Install dependencies
npm install

# Run migrations
npm run db:migrate

# Seed sample data (venue + event)
npm run db:seed

# Start development
npm run dev
# → API: http://localhost:4100
# → Frontend: http://localhost:3100
# → WebSocket: ws://localhost:4100
```

### Environment Variables

See `.env.example` for all configuration options.

---

## Performance Benchmarks

| Operation | Target | Implementation |
|-----------|--------|----------------|
| Queue join | < 50ms | Redis ZADD |
| Queue position check | < 10ms | Redis ZRANK |
| Seat lock acquisition | < 20ms | Redis SETNX |
| Seat availability check | < 5ms | Redis GETBIT |
| Reservation creation | < 100ms | PG SERIALIZABLE |
| Payment initiation | < 500ms | Stripe API |
| WebSocket broadcast | < 50ms | Redis pub/sub + Socket.IO |
| Seat map render | < 16ms | React virtualized SVG |

---

## Monitoring & Observability

### Key Metrics

- **Queue depth**: Users waiting / drain rate
- **Lock contention**: Failed SETNX / total attempts
- **Payment success rate**: Completed / initiated
- **Seat turnover**: Released locks / total locks
- **p99 latency**: Per endpoint
- **WebSocket connections**: Active / peak

### Alerts

- Queue depth > 1M for > 5 minutes
- Lock contention rate > 30%
- Payment failure rate > 5%
- API p99 > 500ms
- Redis memory > 80%
- PostgreSQL connections > 90% pool

---

*StageRush - Every seat, every fan, zero oversells.*
