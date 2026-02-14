import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// -----------------------------------------------------------------------------
// Class Name Utility
// -----------------------------------------------------------------------------

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// -----------------------------------------------------------------------------
// Price Formatting
// -----------------------------------------------------------------------------

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// -----------------------------------------------------------------------------
// Date & Time Formatting
// -----------------------------------------------------------------------------

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const target = new Date(dateStr).getTime();
  const diffMs = target - now;
  const absDiff = Math.abs(diffMs);
  const isFuture = diffMs > 0;

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  let label: string;
  if (months > 0) {
    label = `${months} month${months > 1 ? 's' : ''}`;
  } else if (weeks > 0) {
    label = `${weeks} week${weeks > 1 ? 's' : ''}`;
  } else if (days > 0) {
    label = `${days} day${days > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    label = `${hours} hour${hours > 1 ? 's' : ''}`;
  } else if (minutes > 0) {
    label = `${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    label = 'just now';
    return label;
  }

  return isFuture ? `in ${label}` : `${label} ago`;
}

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

export function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00';
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// -----------------------------------------------------------------------------
// Status Color Utilities
// -----------------------------------------------------------------------------

export function getStatusColor(
  type: 'seat' | 'event',
  status: string,
): string {
  const seatColors: Record<string, string> = {
    available: 'bg-seat-available text-white',
    locked: 'bg-seat-locked text-white',
    sold: 'bg-seat-sold text-white',
    reserved: 'bg-seat-locked text-white',
    unavailable: 'bg-seat-unavailable text-white',
    selected: 'bg-brand-600 text-white',
  };

  const eventColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    published: 'bg-blue-100 text-blue-700',
    on_sale: 'bg-green-100 text-green-700',
    sold_out: 'bg-red-100 text-red-700',
    cancelled: 'bg-red-100 text-red-700',
    completed: 'bg-gray-100 text-gray-700',
    upcoming: 'bg-blue-100 text-blue-700',
    live: 'bg-emerald-100 text-emerald-700',
  };

  if (type === 'seat') {
    return seatColors[status] || seatColors.unavailable;
  }

  return eventColors[status] || 'bg-gray-100 text-gray-700';
}

// -----------------------------------------------------------------------------
// String Utilities
// -----------------------------------------------------------------------------

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

// -----------------------------------------------------------------------------
// Time Utilities
// -----------------------------------------------------------------------------

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateTime(dateStr: string): string {
  return `${formatDate(dateStr)} at ${formatTime(dateStr)}`;
}

export function getTimeUntil(dateStr: string): number {
  return Math.max(0, Math.floor((new Date(dateStr).getTime() - Date.now()) / 1000));
}

export function formatLargeCountdown(seconds: number): {
  days: number;
  hours: number;
  minutes: number;
  secs: number;
} {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return { days, hours, minutes, secs };
}

// -----------------------------------------------------------------------------
// Event Status Utilities
// -----------------------------------------------------------------------------

export function getEventStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    published: 'Upcoming',
    on_sale: 'On Sale',
    sold_out: 'Sold Out',
    cancelled: 'Cancelled',
    completed: 'Completed',
  };
  return labels[status] || status;
}

export function getEventStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    published: 'bg-blue-100 text-blue-700',
    on_sale: 'bg-green-100 text-green-700',
    sold_out: 'bg-red-100 text-red-700',
    cancelled: 'bg-red-100 text-red-700',
    completed: 'bg-gray-100 text-gray-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
}

// -----------------------------------------------------------------------------
// Visual Utilities
// -----------------------------------------------------------------------------

export function getInitialColor(name: string): string {
  const colors = [
    'from-brand-500 to-brand-700',
    'from-purple-500 to-purple-700',
    'from-orange-500 to-orange-700',
    'from-cyan-500 to-cyan-700',
    'from-rose-500 to-rose-700',
    'from-teal-500 to-teal-700',
    'from-indigo-500 to-indigo-700',
    'from-amber-500 to-amber-700',
  ];
  const idx = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  return colors[idx];
}
