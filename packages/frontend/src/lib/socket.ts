import { io, Socket } from 'socket.io-client';
import { WebSocketEventType } from '@flowforge/shared';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('WebSocket connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('WebSocket disconnected:', reason);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function subscribeToExecution(executionId: string): void {
  socket?.emit('subscribe:execution', executionId);
}

export function unsubscribeFromExecution(executionId: string): void {
  socket?.emit('unsubscribe:execution', executionId);
}

export function subscribeToWorkflow(workflowId: string): void {
  socket?.emit('subscribe:workflow', workflowId);
}

export function onSocketEvent(event: WebSocketEventType, handler: (data: any) => void): void {
  socket?.on(event, handler);
}

export function offSocketEvent(event: WebSocketEventType, handler: (data: any) => void): void {
  socket?.off(event, handler);
}
