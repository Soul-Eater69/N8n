import { create } from 'zustand';

// =============================================================================
// Auth Store
// =============================================================================

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  tokens: TokenPair | null;
  setAuth: (user: User, tokens: TokenPair) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  tokens: null,

  setAuth: (user, tokens) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('stagerush_access_token', tokens.accessToken);
      localStorage.setItem('stagerush_refresh_token', tokens.refreshToken);
    }
    set({ user, isAuthenticated: true, tokens });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('stagerush_access_token');
      localStorage.removeItem('stagerush_refresh_token');
    }
    set({ user: null, isAuthenticated: false, tokens: null });
  },
}));

// =============================================================================
// Event Store
// =============================================================================

interface EventData {
  id: string;
  title: string;
  slug: string;
  date: string;
  venue: string;
  status: string;
  [key: string]: unknown;
}

interface SectionAvailability {
  sectionId: string;
  sectionName: string;
  totalSeats: number;
  availableSeats: number;
  price: number;
}

interface EventState {
  currentEvent: EventData | null;
  availability: SectionAvailability[];
  setEvent: (event: EventData | null) => void;
  setAvailability: (availability: SectionAvailability[]) => void;
}

export const useEventStore = create<EventState>((set) => ({
  currentEvent: null,
  availability: [],

  setEvent: (currentEvent) => set({ currentEvent }),
  setAvailability: (availability) => set({ availability }),
}));

// =============================================================================
// Queue Store
// =============================================================================

type QueueStatus = 'waiting' | 'your_turn' | 'expired' | 'idle';

interface QueueState {
  position: number;
  totalInQueue: number;
  estimatedWait: number;
  status: QueueStatus;
  queueToken: string | null;
  bookingToken: string | null;
  setPosition: (position: number) => void;
  setTotalInQueue: (total: number) => void;
  setEstimatedWait: (wait: number) => void;
  setStatus: (status: QueueStatus) => void;
  setQueueToken: (token: string | null) => void;
  setBookingToken: (token: string | null) => void;
  reset: () => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  position: 0,
  totalInQueue: 0,
  estimatedWait: 0,
  status: 'idle',
  queueToken: null,
  bookingToken: null,

  setPosition: (position) => set({ position }),
  setTotalInQueue: (totalInQueue) => set({ totalInQueue }),
  setEstimatedWait: (estimatedWait) => set({ estimatedWait }),
  setStatus: (status) => set({ status }),
  setQueueToken: (queueToken) => set({ queueToken }),
  setBookingToken: (bookingToken) => {
    if (typeof window !== 'undefined' && bookingToken) {
      sessionStorage.setItem('stagerush_booking_token', bookingToken);
    }
    set({ bookingToken });
  },
  reset: () =>
    set({
      position: 0,
      totalInQueue: 0,
      estimatedWait: 0,
      status: 'idle',
      queueToken: null,
      bookingToken: null,
    }),
}));

// =============================================================================
// Booking Store
// =============================================================================

interface Seat {
  id: string;
  sectionId: string;
  row: string;
  number: number;
  price: number;
  status: string;
  label?: string;
}

interface Reservation {
  id: string;
  eventId: string;
  seats: Seat[];
  totalPrice: number;
  expiresAt: string;
  status: string;
}

interface BookingState {
  selectedSeats: Seat[];
  reservation: Reservation | null;
  timer: number;
  addSeat: (seat: Seat) => void;
  removeSeat: (seatId: string) => void;
  clearSeats: () => void;
  setReservation: (reservation: Reservation | null) => void;
  setTimer: (seconds: number) => void;
  reset: () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  selectedSeats: [],
  reservation: null,
  timer: 0,

  addSeat: (seat) =>
    set((state) => {
      if (state.selectedSeats.find((s) => s.id === seat.id)) return state;
      return { selectedSeats: [...state.selectedSeats, seat] };
    }),

  removeSeat: (seatId) =>
    set((state) => ({
      selectedSeats: state.selectedSeats.filter((s) => s.id !== seatId),
    })),

  clearSeats: () => set({ selectedSeats: [] }),

  setReservation: (reservation) => set({ reservation }),

  setTimer: (timer) => set({ timer }),

  reset: () =>
    set({
      selectedSeats: [],
      reservation: null,
      timer: 0,
    }),
}));

// =============================================================================
// UI Store
// =============================================================================

type Theme = 'light' | 'dark' | 'system';

interface UIState {
  theme: Theme;
  mobileMenuOpen: boolean;
  setTheme: (theme: Theme) => void;
  toggleMobileMenu: () => void;
  setMobileMenuOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'system',
  mobileMenuOpen: false,

  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('stagerush_theme', theme);

      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.remove('dark');
      } else {
        // system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', prefersDark);
      }
    }
    set({ theme });
  },

  toggleMobileMenu: () => set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),

  setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),
}));
