'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Clock,
  DoorOpen,
  MapPin,
  Music,
  Ticket,
  Users,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  formatPrice,
  formatDate,
  formatTime,
  getInitialColor,
  getEventStatusLabel,
  getEventStatusColor,
  getTimeUntil,
  formatLargeCountdown,
  cn,
} from '@/lib/utils';
import type { IEvent, ISection, ISectionAvailability } from '@stagerush/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// ---------------------------------------------------------------------------
// Sale Countdown Timer
// ---------------------------------------------------------------------------

function SaleCountdown({ saleStartsAt }: { saleStartsAt: string }) {
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
    <div className="bg-gradient-to-r from-brand-900 to-brand-800 rounded-2xl p-6 sm:p-8 text-white text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand-300 mb-3">
        Sale starts in
      </p>
      <div className="flex justify-center gap-3 sm:gap-6">
        {[
          { value: days, label: 'Days' },
          { value: hours, label: 'Hours' },
          { value: minutes, label: 'Mins' },
          { value: secs, label: 'Secs' },
        ].map(({ value, label }) => (
          <div key={label} className="flex flex-col items-center">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center border border-white/20">
              <span className="text-2xl sm:text-4xl font-bold font-mono animate-countdown">
                {String(value).padStart(2, '0')}
              </span>
            </div>
            <span className="text-xs text-brand-300 mt-2 font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Price Card
// ---------------------------------------------------------------------------

function SectionCard({
  section,
  availability,
}: {
  section: ISection;
  availability?: ISectionAvailability;
}) {
  const available = availability?.available ?? 0;
  const total = availability?.total ?? section.capacity;
  const pct = total > 0 ? Math.round((available / total) * 100) : 0;

  return (
    <div className="card p-4 flex items-center gap-4">
      <div
        className="w-4 h-12 rounded-full flex-shrink-0"
        style={{ backgroundColor: section.color || '#6366f1' }}
      />
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900">{section.name}</h4>
        <p className="text-xs text-gray-500 mt-0.5">
          {available} of {total} available
        </p>
        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
          <div
            className={cn(
              'h-1.5 rounded-full transition-all',
              pct > 50 ? 'bg-green-500' : pct > 20 ? 'bg-yellow-500' : 'bg-red-500',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-lg font-bold text-gray-900">{formatPrice(section.priceCents)}</p>
        <p className="text-xs text-gray-400">per seat</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-surface-light">
      <div className="h-64 sm:h-80 bg-gray-200 shimmer" />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="h-8 bg-gray-200 rounded w-2/3 shimmer" />
        <div className="h-5 bg-gray-200 rounded w-1/3 shimmer" />
        <div className="h-5 bg-gray-200 rounded w-1/2 shimmer" />
        <div className="grid sm:grid-cols-2 gap-4 mt-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl shimmer" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event Detail Page
// ---------------------------------------------------------------------------

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<IEvent | null>(null);
  const [sections, setSections] = useState<ISection[]>([]);
  const [availability, setAvailability] = useState<ISectionAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [eventRes, sectionsRes, availRes] = await Promise.all([
          api.get<ApiResponse<IEvent>>(`/events/${eventId}`),
          api.get<ApiResponse<ISection[]>>(`/events/${eventId}/sections`),
          api.get<ApiResponse<{ sections: ISectionAvailability[] }>>(
            `/events/${eventId}/availability`,
          ),
        ]);

        setEvent(eventRes.data);
        setSections(Array.isArray(sectionsRes.data) ? sectionsRes.data : []);
        setAvailability(
          Array.isArray(availRes.data)
            ? availRes.data
            : availRes.data?.sections ?? [],
        );
      } catch (err) {
        console.error('Failed to load event', err);
        setError('Failed to load event details. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    if (eventId) fetchData();
  }, [eventId]);

  if (loading) return <DetailSkeleton />;

  if (error || !event) {
    return (
      <div className="min-h-screen bg-surface-light flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {error || 'Event not found'}
          </h2>
          <p className="text-gray-500 mb-6">
            The event you are looking for may not exist or could not be loaded.
          </p>
          <Link href="/events" className="btn-primary">
            <ArrowLeft className="w-4 h-4" />
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const initial = event.name.charAt(0).toUpperCase();
  const gradientClass = getInitialColor(event.name);
  const isSaleUpcoming =
    event.status === 'published' && getTimeUntil(event.saleStartsAt) > 0;
  const isOnSale = event.status === 'on_sale';
  const isSoldOut = event.status === 'sold_out';

  function handleAction() {
    if (isOnSale) {
      router.push(`/events/${eventId}/queue`);
    }
  }

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
            <Link href="/login" className="btn-primary text-sm px-4 py-2">
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div
        className={cn(
          'relative h-64 sm:h-80 bg-gradient-to-br flex items-center justify-center overflow-hidden',
          gradientClass,
        )}
      >
        <span className="text-[10rem] font-bold text-white/10 select-none leading-none">
          {initial}
        </span>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Status badge */}
        <span
          className={cn(
            'absolute top-4 right-4 text-xs font-bold px-3 py-1.5 rounded-full',
            getEventStatusColor(event.status),
          )}
        >
          {getEventStatusLabel(event.status)}
        </span>

        {/* Back button */}
        <Link
          href="/events"
          className="absolute top-4 left-4 bg-black/30 backdrop-blur-sm text-white p-2 rounded-lg hover:bg-black/50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        {/* Event title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
          <div className="max-w-4xl mx-auto">
            <p className="text-brand-200 font-semibold text-sm mb-1">{event.artist}</p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">{event.name}</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Event Details Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4 flex items-center gap-3">
            <div className="bg-brand-100 text-brand-600 p-2.5 rounded-xl">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Venue</p>
              <p className="font-semibold text-gray-900 text-sm">
                {event.venue?.name || 'TBA'}
              </p>
              {event.venue && (
                <p className="text-xs text-gray-500">
                  {event.venue.city}, {event.venue.country}
                </p>
              )}
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3">
            <div className="bg-brand-100 text-brand-600 p-2.5 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Date</p>
              <p className="font-semibold text-gray-900 text-sm">{formatDate(event.date)}</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3">
            <div className="bg-brand-100 text-brand-600 p-2.5 rounded-xl">
              <DoorOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Doors Open</p>
              <p className="font-semibold text-gray-900 text-sm">
                {formatTime(event.doorsOpen)}
              </p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3">
            <div className="bg-brand-100 text-brand-600 p-2.5 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Show Time</p>
              <p className="font-semibold text-gray-900 text-sm">
                {formatTime(event.showTime)}
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        {event.description && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">About</h2>
            <p className="text-gray-600 leading-relaxed">{event.description}</p>
          </div>
        )}

        {/* Sale countdown */}
        {isSaleUpcoming && <SaleCountdown saleStartsAt={event.saleStartsAt} />}

        {/* Available Seats Counter */}
        <div className="card p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 text-green-600 p-2.5 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Available Seats</p>
              <p className="text-2xl font-bold text-gray-900">
                {event.availableSeats.toLocaleString()}
                <span className="text-sm font-normal text-gray-400 ml-1">
                  / {event.totalSeats.toLocaleString()}
                </span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Price range</p>
            <p className="font-bold text-gray-900">
              {formatPrice(event.minPriceCents)} - {formatPrice(event.maxPriceCents)}
            </p>
          </div>
        </div>

        {/* Price Tiers / Sections */}
        {sections.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Seating Sections</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {sections
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((section) => (
                  <SectionCard
                    key={section.id}
                    section={section}
                    availability={availability.find(
                      (a) => a.sectionId === section.id,
                    )}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {event.tags && event.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {event.tags.map((tag) => (
              <span
                key={tag}
                className="bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* CTA Button */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 text-center shadow-sm">
          {isOnSale && (
            <>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Ready to get your tickets?
              </h3>
              <p className="text-gray-500 mb-6 text-sm">
                Join the virtual queue and you will be directed to seat selection when it is your turn.
              </p>
              <button onClick={handleAction} className="btn-primary text-base px-8 py-4">
                <Music className="w-5 h-5" />
                Join Queue
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {isSaleUpcoming && (
            <>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Sale has not started yet
              </h3>
              <p className="text-gray-500 text-sm">
                The countdown above shows when tickets become available. Come back when the sale starts!
              </p>
            </>
          )}

          {isSoldOut && (
            <>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Sold Out</h3>
              <p className="text-gray-500 text-sm">
                All tickets for this event have been sold. Check back later for possible cancellations.
              </p>
            </>
          )}

          {!isOnSale && !isSaleUpcoming && !isSoldOut && (
            <>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Tickets unavailable
              </h3>
              <p className="text-gray-500 text-sm">
                Tickets for this event are not currently available.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
