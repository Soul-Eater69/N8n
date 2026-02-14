'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  Calendar,
  MapPin,
  ArrowRight,
  Filter,
  Ticket,
  Music,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  formatPrice,
  formatDate,
  getInitialColor,
  getEventStatusLabel,
  getEventStatusColor,
  getTimeUntil,
  formatLargeCountdown,
  cn,
} from '@/lib/utils';
import type { IEvent } from '@stagerush/shared';

interface EventsResponse {
  success: boolean;
  data: IEvent[];
}

// ---------------------------------------------------------------------------
// Countdown Badge
// ---------------------------------------------------------------------------

function CountdownBadge({ saleStartsAt }: { saleStartsAt: string }) {
  const [secondsLeft, setSecondsLeft] = useState(() => getTimeUntil(saleStartsAt));

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft(getTimeUntil(saleStartsAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [saleStartsAt, secondsLeft]);

  if (secondsLeft <= 0) return null;

  const { days, hours, minutes, secs } = formatLargeCountdown(secondsLeft);

  return (
    <div className="absolute bottom-3 left-3 right-3 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-yellow-300 font-semibold mb-1">
        Sale starts in
      </p>
      <div className="flex gap-2 text-white text-xs font-mono font-bold">
        {days > 0 && (
          <span>
            {days}<span className="text-white/50 font-normal">d</span>
          </span>
        )}
        <span>
          {String(hours).padStart(2, '0')}
          <span className="text-white/50 font-normal">h</span>
        </span>
        <span>
          {String(minutes).padStart(2, '0')}
          <span className="text-white/50 font-normal">m</span>
        </span>
        <span className="animate-countdown">
          {String(secs).padStart(2, '0')}
          <span className="text-white/50 font-normal">s</span>
        </span>
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
  const isSaleUpcoming =
    event.status === 'published' && getTimeUntil(event.saleStartsAt) > 0;

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

        {/* Status badge */}
        <span
          className={cn(
            'absolute top-3 right-3 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm',
            getEventStatusColor(event.status),
          )}
        >
          {getEventStatusLabel(event.status)}
        </span>

        {/* Countdown overlay */}
        {isSaleUpcoming && <CountdownBadge saleStartsAt={event.saleStartsAt} />}
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
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 group-hover:text-brand-700">
            Get Tickets
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
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
          <div className="h-5 bg-gray-200 rounded w-24 shimmer" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Events Page
// ---------------------------------------------------------------------------

export default function EventsPage() {
  const [events, setEvents] = useState<IEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let path = '/events?limit=20';
      if (debouncedSearch) path += `&search=${encodeURIComponent(debouncedSearch)}`;
      if (dateFilter) path += `&startDate=${encodeURIComponent(new Date(dateFilter).toISOString())}`;

      const res = await api.get<EventsResponse>(path);
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load events', err);
      setError('Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, dateFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return (
    <div className="min-h-screen bg-surface-light">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 text-brand-700 font-bold text-xl">
            <Ticket className="w-6 h-6" />
            StageRush
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/tickets"
              className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
            >
              My Tickets
            </Link>
            <Link
              href="/login"
              className="btn-primary text-sm px-4 py-2"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">All Events</h1>
          <p className="text-gray-500 mt-1">
            Find your next unforgettable experience
          </p>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search events, artists, venues..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <div className="relative sm:w-56">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          {(search || dateFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setDateFilter('');
              }}
              className="btn-ghost text-sm flex items-center gap-1.5"
            >
              <Filter className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading events...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={fetchEvents}
              className="mt-2 text-red-600 underline text-sm hover:text-red-700"
            >
              Try again
            </button>
          </div>
        )}

        {/* Events Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading
            ? Array.from({ length: 9 }).map((_, i) => <EventCardSkeleton key={i} />)
            : events.map((event) => <EventCard key={event.id} event={event} />)}
        </div>

        {/* Empty state */}
        {!loading && events.length === 0 && !error && (
          <div className="text-center py-20">
            <Music className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No events found
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              {search || dateFilter
                ? 'Try adjusting your search or filters to find what you are looking for.'
                : 'There are no events available right now. Check back soon!'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
