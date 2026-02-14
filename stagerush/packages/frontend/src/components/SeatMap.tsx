'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn, formatPrice } from '@/lib/utils';
import type { ISeat, IRow } from '@stagerush/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface SeatMapProps {
  eventId: string;
  sectionId: string;
  selectedSeatIds: Set<string>;
  maxSelectable: number;
  onSeatToggle: (seat: ISeat) => void;
}

// ---------------------------------------------------------------------------
// Seat Button
// ---------------------------------------------------------------------------

function SeatButton({
  seat,
  isSelected,
  canSelect,
  onToggle,
}: {
  seat: ISeat;
  isSelected: boolean;
  canSelect: boolean;
  onToggle: (seat: ISeat) => void;
}) {
  const isAvailable = seat.status === 'available';
  const isClickable = (isAvailable && canSelect) || isSelected;

  let seatClass = 'seat-unavailable';
  if (isSelected) {
    seatClass = 'seat-selected';
  } else if (seat.status === 'available') {
    seatClass = canSelect ? 'seat-available' : 'seat-available opacity-50 cursor-not-allowed';
  } else if (seat.status === 'locked') {
    seatClass = 'seat-locked';
  } else if (seat.status === 'sold' || seat.status === 'reserved') {
    seatClass = 'seat-sold';
  }

  return (
    <button
      type="button"
      disabled={!isClickable}
      onClick={() => isClickable && onToggle(seat)}
      className={cn(
        'w-8 h-8 sm:w-9 sm:h-9 rounded-md text-[10px] sm:text-xs font-semibold flex items-center justify-center transition-all duration-150',
        seatClass,
      )}
      title={`Seat ${seat.label} - ${formatPrice(seat.priceCents)} - ${seat.status}`}
    >
      {seat.label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// SeatMap Component
// ---------------------------------------------------------------------------

export default function SeatMap({
  eventId,
  sectionId,
  selectedSeatIds,
  maxSelectable,
  onSeatToggle,
}: SeatMapProps) {
  const [seats, setSeats] = useState<ISeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSeats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiResponse<ISeat[]>>(
        `/events/${eventId}/sections/${sectionId}/seats`,
      );
      setSeats(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError('Failed to load seats.');
    } finally {
      setLoading(false);
    }
  }, [eventId, sectionId]);

  useEffect(() => {
    if (sectionId) fetchSeats();
  }, [sectionId, fetchSeats]);

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="inline-flex items-center gap-2 text-gray-500 text-sm">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          Loading seats...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-red-500 text-sm">{error}</p>
        <button
          onClick={fetchSeats}
          className="mt-2 text-brand-600 text-sm underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (seats.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500 text-sm">
        No seats found for this section.
      </div>
    );
  }

  // Group seats by row
  const rowMap = new Map<string, ISeat[]>();
  seats.forEach((seat) => {
    const rowKey = seat.rowId;
    if (!rowMap.has(rowKey)) rowMap.set(rowKey, []);
    rowMap.get(rowKey)!.push(seat);
  });

  // Sort seats within each row by label (number)
  rowMap.forEach((rowSeats) => {
    rowSeats.sort((a, b) => parseInt(a.label) - parseInt(b.label));
  });

  const canSelectMore = selectedSeatIds.size < maxSelectable;

  return (
    <div className="space-y-4">
      {/* Stage indicator */}
      <div className="text-center mb-6">
        <div className="inline-block bg-gray-800 text-white text-xs font-semibold px-12 py-2 rounded-t-xl">
          STAGE
        </div>
        <div className="h-0.5 bg-gray-300 mx-8 rounded-full" />
      </div>

      {/* Seat grid */}
      <div className="space-y-2 overflow-x-auto">
        {Array.from(rowMap.entries()).map(([rowId, rowSeats]) => (
          <div key={rowId} className="flex items-center gap-1 justify-center min-w-max">
            <span className="w-8 text-xs text-gray-400 font-mono text-right flex-shrink-0">
              {/* Extract row label from first seat - show rowId as fallback */}
              R{rowSeats[0]?.label ? '' : rowId.slice(0, 2)}
            </span>
            <div className="flex gap-1">
              {rowSeats.map((seat) => (
                <SeatButton
                  key={seat.id}
                  seat={seat}
                  isSelected={selectedSeatIds.has(seat.id)}
                  canSelect={canSelectMore}
                  onToggle={onSeatToggle}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-6 pt-4 border-t border-gray-100">
        {[
          { label: 'Available', className: 'bg-seat-available-light border-seat-available' },
          { label: 'Selected', className: 'bg-brand-600 border-brand-700' },
          { label: 'Locked', className: 'bg-seat-locked-light border-seat-locked' },
          { label: 'Sold', className: 'bg-seat-sold-light border-seat-sold' },
        ].map(({ label, className }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className={cn('w-4 h-4 rounded border-2', className)} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
