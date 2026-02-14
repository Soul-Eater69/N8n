'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Ticket,
  ArrowRight,
  Music,
  Shield,
  Zap,
  Clock,
  MapPin,
  Calendar,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatPrice, formatDate, getInitialColor, cn } from '@/lib/utils';
import type { IEvent } from '@stagerush/shared';

interface EventsResponse {
  success: boolean;
  data: IEvent[];
}

// ---------------------------------------------------------------------------
// Skeleton for loading state
// ---------------------------------------------------------------------------

function EventCardSkeleton() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="h-48 bg-gray-200 shimmer" />
      <div className="p-5 space-y-3">
        <div className="h-5 bg-gray-200 rounded w-3/4 shimmer" />
        <div className="h-4 bg-gray-200 rounded w-1/2 shimmer" />
        <div className="h-4 bg-gray-200 rounded w-2/3 shimmer" />
        <div className="flex justify-between items-center pt-2">
          <div className="h-5 bg-gray-200 rounded w-20 shimmer" />
          <div className="h-9 bg-gray-200 rounded-lg w-28 shimmer" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event Card
// ---------------------------------------------------------------------------

function EventCard({ event }: { event: IEvent }) {
  const initial = event.name.charAt(0).toUpperCase();
  const gradientClass = getInitialColor(event.name);

  return (
    <Link
      href={`/events/${event.id}`}
      className="card overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
    >
      {/* Image placeholder */}
      <div
        className={cn(
          'h-48 bg-gradient-to-br flex items-center justify-center relative overflow-hidden',
          gradientClass,
        )}
      >
        <span className="text-6xl font-bold text-white/30 select-none">
          {initial}
        </span>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
        {event.status === 'on_sale' && (
          <span className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg">
            On Sale
          </span>
        )}
        {event.status === 'sold_out' && (
          <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg">
            Sold Out
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-5">
        <h3 className="font-bold text-lg text-gray-900 group-hover:text-brand-600 transition-colors line-clamp-1">
          {event.name}
        </h3>
        <p className="text-sm text-brand-600 font-medium mt-1">{event.artist}</p>
        <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-2">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="line-clamp-1">{event.venue?.name || 'Venue TBA'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{formatDate(event.date)}</span>
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <div>
            <span className="text-xs text-gray-400 uppercase tracking-wide">From</span>
            <p className="text-lg font-bold text-gray-900">
              {formatPrice(event.minPriceCents)}
            </p>
          </div>
          <span className="btn-primary text-sm px-4 py-2 group-hover:bg-brand-700">
            Get Tickets
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Feature card
// ---------------------------------------------------------------------------

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center p-6">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-100 text-brand-600 mb-4">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="font-semibold text-lg text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Landing Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const [events, setEvents] = useState<IEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const res = await api.get<EventsResponse>('/events?limit=6');
        setEvents(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Failed to load events', err);
        setError('Failed to load events. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    fetchFeatured();
  }, []);

  return (
    <div className="min-h-screen">
      {/* ==================== Navbar ==================== */}
      <nav className="absolute top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 text-white font-bold text-xl">
            <Ticket className="w-7 h-7" />
            StageRush
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/events"
              className="text-white/80 hover:text-white text-sm font-medium transition-colors"
            >
              Events
            </Link>
            <Link
              href="/tickets"
              className="text-white/80 hover:text-white text-sm font-medium transition-colors"
            >
              My Tickets
            </Link>
            <Link
              href="/login"
              className="bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-lg backdrop-blur-sm transition-colors border border-white/20"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* ==================== Hero Section ==================== */}
      <section className="hero-gradient relative overflow-hidden">
        {/* Mesh overlay */}
        <div className="absolute inset-0 hero-mesh opacity-50" />

        {/* Decorative circles */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/5 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 lg:pt-40 lg:pb-28">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white/90 text-sm font-medium px-4 py-1.5 rounded-full border border-white/20 mb-8">
              <Zap className="w-4 h-4 text-yellow-300" />
              Real-time queue system for fair ticket access
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-white leading-tight tracking-tight">
              Get tickets to the{' '}
              <span className="relative">
                <span className="relative z-10 bg-gradient-to-r from-yellow-200 via-pink-200 to-cyan-200 bg-clip-text text-transparent">
                  world&apos;s biggest
                </span>
              </span>{' '}
              shows
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
              Fair virtual queues, real-time seat selection, and instant digital
              tickets. No bots, no scalpers -- just fans.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/events"
                className="btn-primary text-base px-8 py-4 bg-white text-brand-700 hover:bg-gray-100 hover:text-brand-800 shadow-xl shadow-white/10"
              >
                <Music className="w-5 h-5" />
                Browse Events
              </Link>
              <Link
                href="/login"
                className="btn-ghost text-white border border-white/30 hover:bg-white/10"
              >
                Create Account
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Wave separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg
            viewBox="0 0 1440 120"
            className="w-full h-auto fill-surface-light"
            preserveAspectRatio="none"
          >
            <path d="M0,60 C360,120 1080,0 1440,60 L1440,120 L0,120 Z" />
          </svg>
        </div>
      </section>

      {/* ==================== Features ==================== */}
      <section className="py-16 lg:py-24 bg-surface-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">
              Why StageRush?
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">
              We built a fairer way to buy tickets to your favorite shows.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={Shield}
              title="Bot Protection"
              description="Advanced queue system ensures real fans get tickets, not bots or scalpers."
            />
            <FeatureCard
              icon={Zap}
              title="Real-Time Selection"
              description="Interactive seat maps update live so you always see what's available."
            />
            <FeatureCard
              icon={Clock}
              title="Fair Queues"
              description="Everyone waits their turn. Your queue position is based on when you joined."
            />
            <FeatureCard
              icon={Ticket}
              title="Instant Tickets"
              description="Digital tickets delivered instantly with QR codes. No printing needed."
            />
          </div>
        </div>
      </section>

      {/* ==================== Featured Events ==================== */}
      <section className="py-16 lg:py-24 bg-surface-light-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">
                Featured Events
              </h2>
              <p className="text-gray-500 mt-1">
                Don&apos;t miss out on these upcoming shows
              </p>
            </div>
            <Link
              href="/events"
              className="hidden sm:inline-flex items-center gap-1.5 text-brand-600 font-semibold hover:text-brand-700 transition-colors"
            >
              View all events
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {error && (
            <div className="text-center py-12">
              <p className="text-red-500">{error}</p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <EventCardSkeleton key={i} />
                ))
              : events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
          </div>

          {!loading && events.length === 0 && !error && (
            <div className="text-center py-16">
              <Music className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                No events yet
              </h3>
              <p className="text-gray-500">
                Check back soon for exciting upcoming shows!
              </p>
            </div>
          )}

          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/events"
              className="btn-secondary"
            >
              View all events
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ==================== Footer ==================== */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-white font-bold text-lg">
              <Ticket className="w-5 h-5" />
              StageRush
            </div>
            <p className="text-sm">
              &copy; {new Date().getFullYear()} StageRush. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
