'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Loader2,
  ShoppingCart,
  Ticket,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useBookingStore } from '@/lib/store';
import { formatPrice, formatCountdown, cn } from '@/lib/utils';
import SeatMap from '@/components/SeatMap';
import type { IEvent, ISection, ISectionAvailability, ISeat } from '@stagerush/shared';
import { SEAT_LOCK_DURATION_SEC, SERVICE_FEE_PERCENT, FACILITY_FEE_CENTS, TAX_RATE, MAX_TICKETS_PER_ORDER } from '@stagerush/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface SectionWithAvail extends ISection {
  available: number;
}

// ---------------------------------------------------------------------------
// Lock Timer
// ---------------------------------------------------------------------------

function LockTimer({ expiresAt }: { expiresAt: string | null }) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) return null;

  const isLow = secondsLeft < 120;

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-sm font-mono font-bold px-3 py-1.5 rounded-lg',
        isLow
          ? 'bg-red-100 text-red-700 animate-pulse'
          : 'bg-brand-100 text-brand-700',
      )}
    >
      <Clock className="w-4 h-4" />
      {formatCountdown(secondsLeft)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Sidebar Item
// ---------------------------------------------------------------------------

function SectionItem({
  section,
  isSelected,
  onClick,
}: {
  section: SectionWithAvail;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg border transition-all',
        isSelected
          ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: section.color || '#6366f1' }}
        />
        <span className="font-semibold text-sm text-gray-900">{section.name}</span>
      </div>
      <div className="flex items-center justify-between mt-1.5 text-xs text-gray-500">
        <span>{section.available} available</span>
        <span className="font-semibold text-gray-900">
          {formatPrice(section.priceCents)}
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Book Page
// ---------------------------------------------------------------------------

export default function BookPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const {
    selectedSeats,
    reservation,
    addSeat,
    removeSeat,
    clearSeats,
    setReservation,
    setTimer,
    reset: resetBooking,
  } = useBookingStore();

  const [event, setEvent] = useState<IEvent | null>(null);
  const [sections, setSections] = useState<SectionWithAvail[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockExpiresAt, setLockExpiresAt] = useState<string | null>(null);

  // Fetch event and sections
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

        const sectionList = Array.isArray(sectionsRes.data)
          ? sectionsRes.data
          : [];
        const availList = Array.isArray(availRes.data)
          ? availRes.data
          : availRes.data?.sections ?? [];

        const merged: SectionWithAvail[] = sectionList
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((s) => {
            const avail = availList.find((a) => a.sectionId === s.id);
            return { ...s, available: avail?.available ?? 0 };
          });

        setSections(merged);

        // Auto-select first section with availability
        const first = merged.find((s) => s.available > 0);
        if (first) setSelectedSectionId(first.id);
      } catch {
        setError('Failed to load event data.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [eventId]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Don't reset if user is navigating to checkout
    };
  }, []);

  // Selected seat IDs as a Set
  const selectedSeatIds = useMemo(
    () => new Set(selectedSeats.map((s) => s.id)),
    [selectedSeats],
  );

  // Price calculations
  const subtotalCents = selectedSeats.reduce((sum, s) => sum + s.price, 0);
  const serviceFees = Math.round(subtotalCents * SERVICE_FEE_PERCENT);
  const facilityFees = selectedSeats.length * FACILITY_FEE_CENTS;
  const taxable = subtotalCents + serviceFees + facilityFees;
  const tax = Math.round(taxable * TAX_RATE);
  const totalCents = taxable + tax;

  // Handle seat toggle
  const handleSeatToggle = useCallback(
    (seat: ISeat) => {
      if (selectedSeatIds.has(seat.id)) {
        removeSeat(seat.id);
      } else {
        if (selectedSeats.length >= MAX_TICKETS_PER_ORDER) return;
        addSeat({
          id: seat.id,
          sectionId: seat.sectionId,
          row: seat.rowId,
          number: parseInt(seat.label) || 0,
          price: seat.priceCents,
          status: seat.status,
          label: seat.label,
        });
      }
    },
    [selectedSeatIds, selectedSeats.length, addSeat, removeSeat],
  );

  // Create reservation
  async function handleProceedToCheckout() {
    if (selectedSeats.length === 0) return;
    setSubmitting(true);
    setError(null);

    try {
      const seatIds = selectedSeats.map((s) => s.id);
      const res = await api.post<ApiResponse<{ id: string; expiresAt: string }>>(
        `/reservations/${eventId}`,
        { seatIds },
      );

      const resData = res.data;
      setReservation({
        id: resData.id,
        eventId,
        seats: selectedSeats,
        totalPrice: totalCents,
        expiresAt: resData.expiresAt,
        status: 'locked',
      });
      setLockExpiresAt(resData.expiresAt);

      router.push(`/checkout/${resData.id}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create reservation.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-light">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center px-4">
          <div className="h-5 w-32 bg-gray-200 rounded shimmer" />
        </header>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 rounded-lg shimmer" />
              ))}
            </div>
            <div className="lg:col-span-2 h-96 bg-gray-200 rounded-xl shimmer" />
            <div className="lg:col-span-1 h-64 bg-gray-200 rounded-xl shimmer" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-light">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-brand-700 font-bold text-xl">
              <Ticket className="w-6 h-6" />
              StageRush
            </Link>
            {event && (
              <span className="hidden sm:inline text-sm text-gray-500 border-l border-gray-200 pl-4">
                {event.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {lockExpiresAt && <LockTimer expiresAt={lockExpiresAt} />}
            <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">
              <ShoppingCart className="w-4 h-4" />
              {selectedSeats.length}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back link */}
        <Link
          href={`/events/${eventId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to event
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Select Your Seats</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Section Selector Sidebar */}
          <div className="lg:col-span-1">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Sections
            </h2>
            <div className="space-y-2">
              {sections.map((section) => (
                <SectionItem
                  key={section.id}
                  section={section}
                  isSelected={selectedSectionId === section.id}
                  onClick={() => setSelectedSectionId(section.id)}
                />
              ))}
            </div>

            {sections.length === 0 && (
              <p className="text-sm text-gray-500 py-4">No sections available.</p>
            )}
          </div>

          {/* Seat Map */}
          <div className="lg:col-span-2">
            <div className="card p-4 sm:p-6">
              {selectedSectionId ? (
                <SeatMap
                  eventId={eventId}
                  sectionId={selectedSectionId}
                  selectedSeatIds={selectedSeatIds}
                  maxSelectable={MAX_TICKETS_PER_ORDER}
                  onSeatToggle={handleSeatToggle}
                />
              ) : (
                <div className="py-16 text-center text-gray-400">
                  <Ticket className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Select a section to view available seats</p>
                </div>
              )}
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="card p-5 sticky top-24">
              <h2 className="font-bold text-gray-900 mb-4">Order Summary</h2>

              {selectedSeats.length === 0 ? (
                <div className="py-8 text-center text-gray-400">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No seats selected</p>
                  <p className="text-xs mt-1">
                    Click on available seats to add them
                  </p>
                </div>
              ) : (
                <>
                  {/* Selected Seats List */}
                  <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                    {selectedSeats.map((seat) => {
                      const section = sections.find(
                        (s) => s.id === seat.sectionId,
                      );
                      return (
                        <div
                          key={seat.id}
                          className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {section?.name || 'Section'} - Seat {seat.label || seat.number}
                            </p>
                            <p className="text-xs text-gray-500">
                              Row {seat.row}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {formatPrice(seat.price)}
                            </span>
                            <button
                              onClick={() => removeSeat(seat.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Fee Breakdown */}
                  <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal ({selectedSeats.length} tickets)</span>
                      <span>{formatPrice(subtotalCents)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Service fees</span>
                      <span>{formatPrice(serviceFees)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Facility fee</span>
                      <span>{formatPrice(facilityFees)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Tax</span>
                      <span>{formatPrice(tax)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100">
                      <span>Total</span>
                      <span>{formatPrice(totalCents)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-5 space-y-2">
                    <button
                      onClick={handleProceedToCheckout}
                      disabled={submitting || selectedSeats.length === 0}
                      className="btn-primary w-full"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating reservation...
                        </>
                      ) : (
                        <>
                          Proceed to Checkout
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                    <button
                      onClick={clearSeats}
                      className="btn-ghost w-full text-sm text-gray-500"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear all
                    </button>
                  </div>
                </>
              )}

              {/* Max tickets notice */}
              <p className="text-xs text-gray-400 text-center mt-4">
                Max {MAX_TICKETS_PER_ORDER} tickets per order
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
