'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronUp,
  MapPin,
  QrCode,
  Ticket,
  TicketCheck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import type { ITicket } from '@stagerush/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface TicketWithEvent extends ITicket {
  eventName?: string;
  eventDate?: string;
  venueName?: string;
}

// ---------------------------------------------------------------------------
// QR Code Placeholder
// ---------------------------------------------------------------------------

function QrCodeDisplay({ data }: { data: string }) {
  // Generate a visual QR-like pattern from the data string
  const hash = data.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const grid: boolean[][] = [];
  for (let row = 0; row < 11; row++) {
    grid.push([]);
    for (let col = 0; col < 11; col++) {
      // Corner anchors
      const isCornerAnchor =
        (row < 3 && col < 3) ||
        (row < 3 && col > 7) ||
        (row > 7 && col < 3);
      if (isCornerAnchor) {
        grid[row].push(true);
      } else {
        grid[row].push(((hash * (row + 1) * (col + 1)) % 7) < 4);
      }
    }
  }

  return (
    <div className="inline-flex flex-col items-center p-4 bg-white rounded-xl border border-gray-200">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(11, 1fr)` }}>
        {grid.flat().map((filled, i) => (
          <div
            key={i}
            className={cn(
              'w-3 h-3 rounded-[1px]',
              filled ? 'bg-gray-900' : 'bg-white',
            )}
          />
        ))}
      </div>
      <p className="text-[10px] text-gray-400 font-mono mt-2 tracking-wider">
        {data.slice(0, 16).toUpperCase()}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ticket Card
// ---------------------------------------------------------------------------

function TicketCard({ ticket }: { ticket: TicketWithEvent }) {
  const [expanded, setExpanded] = useState(false);

  const statusColors: Record<string, string> = {
    valid: 'bg-green-100 text-green-700',
    used: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-100 text-red-700',
    transferred: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="card overflow-hidden group">
      {/* Top accent */}
      <div className="h-1.5 bg-gradient-to-r from-brand-500 to-brand-700" />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 line-clamp-1">
              {ticket.eventName || 'Event'}
            </h3>
            {ticket.eventDate && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                {formatDate(ticket.eventDate)}
              </div>
            )}
            {ticket.venueName && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                {ticket.venueName}
              </div>
            )}
          </div>
          <span
            className={cn(
              'text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ml-3',
              statusColors[ticket.status] || 'bg-gray-100 text-gray-700',
            )}
          >
            {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
          </span>
        </div>

        {/* Dashed separator with circle cutouts */}
        <div className="relative my-4">
          <div className="border-t-2 border-dashed border-gray-200" />
          <div className="absolute -left-7 top-1/2 -translate-y-1/2 w-5 h-5 bg-surface-light rounded-full" />
          <div className="absolute -right-7 top-1/2 -translate-y-1/2 w-5 h-5 bg-surface-light rounded-full" />
        </div>

        {/* Seat Info */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Section</p>
            <p className="font-bold text-gray-900 mt-0.5">{ticket.sectionName}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Row</p>
            <p className="font-bold text-gray-900 mt-0.5">{ticket.rowLabel}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Seat</p>
            <p className="font-bold text-gray-900 mt-0.5">{ticket.seatLabel}</p>
          </div>
        </div>

        {/* Expand/Collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-4 flex items-center justify-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 transition-colors py-2"
        >
          {expanded ? (
            <>
              Hide QR Code
              <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              Show QR Code
              <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>

        {/* QR Code (expanded) */}
        {expanded && (
          <div className="mt-3 flex flex-col items-center animate-slide-up">
            <QrCodeDisplay data={ticket.qrCode || ticket.barcode || ticket.id} />
            <p className="text-xs text-gray-400 mt-3">
              Present this QR code at the venue entrance
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TicketCardSkeleton() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="h-1.5 bg-gray-200" />
      <div className="p-5 space-y-4">
        <div className="h-5 bg-gray-200 rounded w-3/4 shimmer" />
        <div className="h-4 bg-gray-200 rounded w-1/2 shimmer" />
        <div className="border-t-2 border-dashed border-gray-200 my-4" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded shimmer" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tickets Page
// ---------------------------------------------------------------------------

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTickets() {
      try {
        const res = await api.get<ApiResponse<TicketWithEvent[]>>('/tickets');
        setTickets(Array.isArray(res.data) ? res.data : []);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to load tickets.';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    fetchTickets();
  }, []);

  return (
    <div className="min-h-screen bg-surface-light">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 text-brand-700 font-bold text-xl">
            <Ticket className="w-6 h-6" />
            StageRush
          </Link>
          <Link
            href="/events"
            className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
          >
            Browse Events
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        {/* Title */}
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-brand-100 text-brand-600 p-2.5 rounded-xl">
            <TicketCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Tickets</h1>
            <p className="text-sm text-gray-500">
              {loading
                ? 'Loading...'
                : `${tickets.length} ticket${tickets.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Ticket Grid */}
        <div className="grid sm:grid-cols-2 gap-5">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <TicketCardSkeleton key={i} />
              ))
            : tickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
        </div>

        {/* Empty state */}
        {!loading && tickets.length === 0 && !error && (
          <div className="text-center py-20">
            <Ticket className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No tickets yet
            </h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              Once you purchase tickets to an event, they will appear here in your wallet.
            </p>
            <Link href="/events" className="btn-primary">
              Browse Events
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
