'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  Loader2,
  LogOut,
  Music,
  Ticket,
  Users,
  Zap,
  TrendingDown,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useQueueStore } from '@/lib/store';
import {
  connectSocket,
  disconnectSocket,
  subscribeToQueue,
  onEvent,
  offEvent,
} from '@/lib/socket';
import { formatDuration, cn } from '@/lib/utils';
import type { IEvent, IQueueEntry, IQueueStats } from '@stagerush/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// ---------------------------------------------------------------------------
// Animated Position Display
// ---------------------------------------------------------------------------

function PositionDisplay({ position }: { position: number }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-brand-500/20 rounded-3xl blur-2xl animate-pulse-slow" />
      <div className="relative bg-gradient-to-br from-brand-600 to-brand-800 rounded-3xl p-8 sm:p-12 text-center">
        <p className="text-brand-200 text-sm font-semibold uppercase tracking-wider mb-3">
          Your position
        </p>
        <div className="text-6xl sm:text-8xl lg:text-9xl font-extrabold text-white font-mono animate-countdown">
          #{position.toLocaleString()}
        </div>
        <p className="text-brand-300 text-sm mt-3">in the queue</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress Bar
// ---------------------------------------------------------------------------

function QueueProgress({
  position,
  total,
}: {
  position: number;
  total: number;
}) {
  const pct = total > 0 ? Math.max(0, Math.min(100, ((total - position) / total) * 100)) : 0;

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-500 mb-2">
        <span>You</span>
        <span>{Math.round(pct)}% through the queue</span>
        <span>Front</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="bg-gradient-to-r from-brand-600 to-brand-400 h-3 rounded-full transition-all duration-1000 ease-out relative"
          style={{ width: `${pct}%` }}
        >
          <div className="absolute inset-0 bg-white/20 shimmer rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats Card
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <div className="card p-4 text-center">
      <Icon className="w-5 h-5 text-brand-500 mx-auto mb-2" />
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
      {subtext && <p className="text-xs text-gray-500 mt-0.5">{subtext}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queue Page
// ---------------------------------------------------------------------------

export default function QueuePage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const {
    position,
    totalInQueue,
    estimatedWait,
    status,
    setPosition,
    setTotalInQueue,
    setEstimatedWait,
    setStatus,
    setBookingToken,
    reset: resetQueue,
  } = useQueueStore();

  const [event, setEvent] = useState<IEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drainRate, setDrainRate] = useState(0);
  const hasJoined = useRef(false);

  // Fetch event info
  useEffect(() => {
    async function fetchEvent() {
      try {
        const res = await api.get<ApiResponse<IEvent>>(`/events/${eventId}`);
        setEvent(res.data);
      } catch {
        setError('Failed to load event details.');
      }
    }
    fetchEvent();
  }, [eventId]);

  // Join queue
  const joinQueue = useCallback(async () => {
    if (hasJoined.current) return;
    hasJoined.current = true;
    setJoining(true);
    setError(null);

    try {
      const res = await api.post<ApiResponse<IQueueEntry>>(
        `/queue/${eventId}/join`,
      );
      const entry = res.data;

      setPosition(entry.position);
      setTotalInQueue(entry.totalInQueue);
      setEstimatedWait(entry.estimatedWaitSeconds);
      setStatus('waiting');

      // Connect socket and subscribe to queue updates
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('stagerush_access_token') || undefined
          : undefined;
      connectSocket(token);
      subscribeToQueue(eventId);
    } catch (err: unknown) {
      hasJoined.current = false;
      const message =
        err instanceof Error ? err.message : 'Failed to join queue.';
      setError(message);
    } finally {
      setJoining(false);
      setLoading(false);
    }
  }, [eventId, setPosition, setTotalInQueue, setEstimatedWait, setStatus]);

  // Auto-join on mount
  useEffect(() => {
    joinQueue();
  }, [joinQueue]);

  // Listen for WebSocket events
  useEffect(() => {
    const handlePosition = (data: unknown) => {
      const d = data as {
        position: number;
        totalInQueue: number;
        estimatedWaitSeconds: number;
      };
      setPosition(d.position);
      setTotalInQueue(d.totalInQueue);
      setEstimatedWait(d.estimatedWaitSeconds);
    };

    const handleAdmitted = (data: unknown) => {
      const d = data as { bookingToken: string };
      setStatus('your_turn');
      setBookingToken(d.bookingToken);
      // Auto-redirect to booking page
      setTimeout(() => {
        router.push(`/events/${eventId}/book`);
      }, 1500);
    };

    const handleStats = (data: unknown) => {
      const d = data as IQueueStats;
      setTotalInQueue(d.totalInQueue);
      setDrainRate(d.drainRatePerSecond);
    };

    onEvent('queue:position', handlePosition);
    onEvent('queue:admitted', handleAdmitted);
    onEvent('queue:stats', handleStats);

    return () => {
      offEvent('queue:position', handlePosition);
      offEvent('queue:admitted', handleAdmitted);
      offEvent('queue:stats', handleStats);
    };
  }, [eventId, router, setPosition, setTotalInQueue, setEstimatedWait, setStatus, setBookingToken]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  // Leave queue
  async function handleLeave() {
    try {
      await api.delete(`/queue/${eventId}/leave`);
    } catch {
      // Ignore errors on leave
    }
    resetQueue();
    disconnectSocket();
    router.push(`/events/${eventId}`);
  }

  // Admitted state
  if (status === 'your_turn') {
    return (
      <div className="min-h-screen bg-surface-light flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4 animate-slide-up">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative bg-green-100 p-6 rounded-full">
              <Zap className="w-12 h-12 text-green-600" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-3">
            It&apos;s your turn!
          </h1>
          <p className="text-gray-500 mb-6">
            Redirecting you to seat selection...
          </p>
          <Loader2 className="w-6 h-6 animate-spin text-brand-600 mx-auto" />
        </div>
      </div>
    );
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
          <button
            onClick={handleLeave}
            className="btn-ghost text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            Leave Queue
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Back link */}
        <Link
          href={`/events/${eventId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to event
        </Link>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">
            Virtual Waiting Room
          </h1>
          {event && (
            <p className="text-gray-500">
              {event.name} &mdash; {event.artist}
            </p>
          )}
        </div>

        {/* Loading / Error */}
        {loading && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600 mx-auto mb-3" />
            <p className="text-gray-500">Joining the queue...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => {
                hasJoined.current = false;
                joinQueue();
              }}
              className="mt-3 text-red-600 underline text-sm hover:text-red-700"
            >
              Try again
            </button>
          </div>
        )}

        {/* Queue position display */}
        {!loading && !error && position > 0 && (
          <>
            <PositionDisplay position={position} />

            <QueueProgress position={position} total={totalInQueue} />

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                icon={Users}
                label="In Queue"
                value={totalInQueue.toLocaleString()}
              />
              <StatCard
                icon={Clock}
                label="Est. Wait"
                value={
                  estimatedWait > 0 ? formatDuration(estimatedWait) : '--'
                }
              />
              <StatCard
                icon={TrendingDown}
                label="Drain Rate"
                value={drainRate > 0 ? `${drainRate}/s` : '--'}
                subtext="users admitted"
              />
            </div>

            {/* While you wait section */}
            {event && (
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Music className="w-4 h-4 text-brand-500" />
                  While you wait
                </h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    <span className="font-medium text-gray-800">Event:</span>{' '}
                    {event.name}
                  </p>
                  <p>
                    <span className="font-medium text-gray-800">Artist:</span>{' '}
                    {event.artist}
                  </p>
                  <p>
                    <span className="font-medium text-gray-800">Venue:</span>{' '}
                    {event.venue?.name || 'TBA'}
                  </p>
                  {event.description && (
                    <p className="mt-3 text-gray-500 leading-relaxed">
                      {event.description}
                    </p>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Queue position updates automatically. Do not close this page.
                </div>
              </div>
            )}

            {/* Cancel button */}
            <div className="text-center">
              <button
                onClick={handleLeave}
                className="btn-ghost text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                Leave Queue
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
