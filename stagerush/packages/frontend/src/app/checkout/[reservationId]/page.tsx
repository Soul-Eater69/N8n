'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  PartyPopper,
  ShieldCheck,
  Ticket,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useBookingStore } from '@/lib/store';
import { formatPrice, formatCountdown, formatDate, formatTime, cn } from '@/lib/utils';
import type {
  IEvent,
  IReservation,
  IFeeBreakdown,
  IPayment,
  ITicket,
} from '@stagerush/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface ReservationDetail extends IReservation {
  event?: IEvent;
  seatDetails?: Array<{
    sectionName: string;
    rowLabel: string;
    seatLabel: string;
    priceCents: number;
  }>;
}

type CheckoutStep = 'review' | 'processing' | 'success' | 'error';

// ---------------------------------------------------------------------------
// Lock Timer
// ---------------------------------------------------------------------------

function LockTimer({ expiresAt }: { expiresAt: string }) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
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

  const isLow = secondsLeft < 120;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 text-sm font-mono font-bold px-4 py-2 rounded-lg',
        isLow
          ? 'bg-red-100 text-red-700 animate-pulse'
          : 'bg-brand-100 text-brand-700',
      )}
    >
      <Clock className="w-4 h-4" />
      Time remaining: {formatCountdown(secondsLeft)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confetti-like Success Animation
// ---------------------------------------------------------------------------

function SuccessAnimation() {
  return (
    <div className="relative">
      {/* Floating particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{
            backgroundColor: [
              '#6366f1',
              '#ec4899',
              '#10b981',
              '#f59e0b',
              '#3b82f6',
              '#8b5cf6',
            ][i % 6],
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float ${2 + Math.random() * 3}s ease-in-out ${Math.random() * 2}s infinite alternate`,
            opacity: 0.7,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes float {
          0% {
            transform: translateY(0px) rotate(0deg) scale(1);
            opacity: 0.7;
          }
          100% {
            transform: translateY(-30px) rotate(180deg) scale(0.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checkout Page
// ---------------------------------------------------------------------------

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const reservationId = params.reservationId as string;

  const { reset: resetBooking } = useBookingStore();

  const [reservation, setReservation] = useState<ReservationDetail | null>(null);
  const [step, setStep] = useState<CheckoutStep>('review');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<IPayment | null>(null);
  const [tickets, setTickets] = useState<ITicket[]>([]);

  // Fetch reservation
  useEffect(() => {
    async function fetchReservation() {
      try {
        const res = await api.get<ApiResponse<ReservationDetail>>(
          `/reservations/${reservationId}`,
        );
        setReservation(res.data);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to load reservation.';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    if (reservationId) fetchReservation();
  }, [reservationId]);

  // Process payment
  async function handlePayment() {
    setStep('processing');
    setError(null);

    try {
      const res = await api.post<ApiResponse<{
        payment: IPayment;
        tickets: ITicket[];
      }>>('/payments', { reservationId });

      const data = res.data;
      setPayment(data.payment ?? (data as unknown as IPayment));
      setTickets(data.tickets ?? []);
      setStep('success');
      resetBooking();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Payment failed. Please try again.';
      setError(message);
      setStep('error');
    }
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-light">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center px-4">
          <div className="h-5 w-32 bg-gray-200 rounded shimmer" />
        </header>
        <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48 shimmer" />
          <div className="h-64 bg-gray-200 rounded-xl shimmer" />
          <div className="h-48 bg-gray-200 rounded-xl shimmer" />
        </div>
      </div>
    );
  }

  // Error loading reservation
  if (!reservation && error) {
    return (
      <div className="min-h-screen bg-surface-light flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <CreditCard className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Reservation not found
          </h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <Link href="/events" className="btn-primary">
            <ArrowLeft className="w-4 h-4" />
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const fees: IFeeBreakdown = reservation?.fees || {
    subtotalCents: 0,
    serviceFeesCents: 0,
    facilityFeeCents: 0,
    taxCents: 0,
    totalCents: reservation?.totalCents || 0,
  };

  // ========== SUCCESS STATE ==========
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-surface-light">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-16">
            <Link href="/" className="flex items-center gap-2 text-brand-700 font-bold text-xl">
              <Ticket className="w-6 h-6" />
              StageRush
            </Link>
          </div>
        </header>

        <div className="max-w-lg mx-auto px-4 py-12 text-center relative">
          <SuccessAnimation />

          <div className="animate-slide-up relative z-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>

            <h1 className="text-3xl font-extrabold text-gray-900 mb-3">
              Tickets Confirmed!
            </h1>
            <p className="text-gray-500 mb-8">
              Your tickets have been issued and are ready in your wallet.
            </p>

            {/* Ticket Preview */}
            {tickets.length > 0 && (
              <div className="space-y-3 mb-8">
                {tickets.slice(0, 3).map((ticket) => (
                  <div
                    key={ticket.id}
                    className="card p-4 flex items-center gap-3 text-left"
                  >
                    <div className="bg-brand-100 text-brand-600 p-2 rounded-lg">
                      <Ticket className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900">
                        {ticket.sectionName} - Row {ticket.rowLabel} - Seat{' '}
                        {ticket.seatLabel}
                      </p>
                      <p className="text-xs text-gray-500">
                        Ticket #{ticket.id.slice(0, 8)}
                      </p>
                    </div>
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  </div>
                ))}
                {tickets.length > 3 && (
                  <p className="text-sm text-gray-500">
                    +{tickets.length - 3} more tickets
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/tickets" className="btn-primary">
                <Ticket className="w-4 h-4" />
                View My Tickets
              </Link>
              <Link href="/events" className="btn-secondary">
                Browse More Events
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========== PROCESSING STATE ==========
  if (step === 'processing') {
    return (
      <div className="min-h-screen bg-surface-light flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4 animate-slide-up">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-brand-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative bg-brand-100 p-6 rounded-full">
              <CreditCard className="w-12 h-12 text-brand-600" />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-3">
            Processing Payment
          </h1>
          <p className="text-gray-500 mb-6">
            Please wait while we process your payment...
          </p>
          <Loader2 className="w-8 h-8 animate-spin text-brand-600 mx-auto" />
          <p className="text-xs text-gray-400 mt-4">Do not close this window</p>
        </div>
      </div>
    );
  }

  // ========== REVIEW / ERROR STATE ==========
  return (
    <div className="min-h-screen bg-surface-light">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 text-brand-700 font-bold text-xl">
            <Ticket className="w-6 h-6" />
            StageRush
          </Link>
          {reservation?.expiresAt && (
            <LockTimer expiresAt={reservation.expiresAt} />
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href={`/events/${reservation?.eventId}/book`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to seat selection
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-8">Checkout</h1>

        {/* Error banner */}
        {step === 'error' && error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700 text-sm font-medium">{error}</p>
            <button
              onClick={() => setStep('review')}
              className="mt-2 text-red-600 underline text-sm hover:text-red-700"
            >
              Try again
            </button>
          </div>
        )}

        {/* Event Info */}
        {reservation?.event && (
          <div className="card p-5 mb-6">
            <h2 className="font-bold text-gray-900 mb-3">Event Details</h2>
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-gray-900">{reservation.event.name}</p>
              <div className="flex items-center gap-1.5 text-gray-500">
                <MapPin className="w-3.5 h-3.5" />
                {reservation.event.venue?.name || 'TBA'}
              </div>
              <div className="flex items-center gap-1.5 text-gray-500">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(reservation.event.date)} at{' '}
                {formatTime(reservation.event.showTime)}
              </div>
            </div>
          </div>
        )}

        {/* Seat Details */}
        <div className="card p-5 mb-6">
          <h2 className="font-bold text-gray-900 mb-3">Your Seats</h2>
          <div className="space-y-2">
            {reservation?.seatDetails?.map((seat, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-brand-500" />
                  <span className="text-sm text-gray-900">
                    {seat.sectionName} - Row {seat.rowLabel} - Seat {seat.seatLabel}
                  </span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {formatPrice(seat.priceCents)}
                </span>
              </div>
            )) ?? (
              <p className="text-sm text-gray-500">
                {reservation?.seatIds?.length || 0} seat(s) reserved
              </p>
            )}
          </div>
        </div>

        {/* Fee Breakdown */}
        <div className="card p-5 mb-6">
          <h2 className="font-bold text-gray-900 mb-3">Price Breakdown</h2>
          <div className="space-y-2 text-sm">
            {fees.subtotalCents > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatPrice(fees.subtotalCents)}</span>
              </div>
            )}
            {fees.serviceFeesCents > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Service fees</span>
                <span>{formatPrice(fees.serviceFeesCents)}</span>
              </div>
            )}
            {fees.facilityFeeCents > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Facility fee</span>
                <span>{formatPrice(fees.facilityFeeCents)}</span>
              </div>
            )}
            {fees.taxCents > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <span>{formatPrice(fees.taxCents)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 pt-3 border-t border-gray-100 text-base">
              <span>Total</span>
              <span>
                {formatPrice(fees.totalCents || reservation?.totalCents || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Section */}
        <div className="card p-5 mb-6">
          <h2 className="font-bold text-gray-900 mb-3">Payment</h2>
          <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 rounded-lg">
            <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              Your payment is secure and encrypted. This is a simulated payment for demo purposes.
            </p>
          </div>
          <button
            onClick={handlePayment}
            className="btn-primary w-full text-base py-4"
          >
            <CreditCard className="w-5 h-5" />
            Pay {formatPrice(fees.totalCents || reservation?.totalCents || 0)}
          </button>
        </div>

        {/* Timer reminder */}
        {reservation?.expiresAt && (
          <p className="text-xs text-center text-gray-400">
            Your seats are reserved until the timer expires. Complete payment before time runs out.
          </p>
        )}
      </div>
    </div>
  );
}
