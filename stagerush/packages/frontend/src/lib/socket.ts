import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:4100';

let socket: Socket | null = null;

// -----------------------------------------------------------------------------
// Connection Management
// -----------------------------------------------------------------------------

export function connectSocket(token?: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    transports: ['websocket', 'polling'],
    auth: token ? { token } : undefined,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    console.log('[Socket] Disconnected and cleaned up');
  }
}

export function getSocket(): Socket | null {
  return socket;
}

// -----------------------------------------------------------------------------
// Room Subscriptions
// -----------------------------------------------------------------------------

export function subscribeToEvent(eventId: string): void {
  if (!socket?.connected) {
    console.warn('[Socket] Not connected. Cannot subscribe to event.');
    return;
  }
  socket.emit('subscribe:event', { eventId });
}

export function subscribeToQueue(eventId: string): void {
  if (!socket?.connected) {
    console.warn('[Socket] Not connected. Cannot subscribe to queue.');
    return;
  }
  socket.emit('subscribe:queue', { eventId });
}

export function subscribeToReservation(reservationId: string): void {
  if (!socket?.connected) {
    console.warn('[Socket] Not connected. Cannot subscribe to reservation.');
    return;
  }
  socket.emit('subscribe:reservation', { reservationId });
}

// -----------------------------------------------------------------------------
// Event Listeners
// -----------------------------------------------------------------------------

export function onEvent(type: string, handler: (...args: unknown[]) => void): void {
  if (!socket) {
    console.warn('[Socket] Not connected. Cannot attach listener for:', type);
    return;
  }
  socket.on(type, handler);
}

export function offEvent(type: string, handler: (...args: unknown[]) => void): void {
  if (!socket) {
    return;
  }
  socket.off(type, handler);
}
