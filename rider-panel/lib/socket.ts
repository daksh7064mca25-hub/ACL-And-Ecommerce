import { io, Socket } from 'socket.io-client';

const BACKEND_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

let riderSocketInstance: Socket | null = null;

export function getRiderSocket(token?: string | null): Socket {
  if (typeof window === 'undefined') {
    return null as unknown as Socket;
  }

  if (riderSocketInstance && riderSocketInstance.connected) {
    return riderSocketInstance;
  }

  if (!riderSocketInstance) {
    riderSocketInstance = io(BACKEND_URL, {
      auth: {
        token: token || undefined,
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    riderSocketInstance.on('connect', () => {
      console.log(`[Rider Socket] Connected successfully (ID: ${riderSocketInstance?.id})`);
    });

    riderSocketInstance.on('disconnect', (reason) => {
      console.log(`[Rider Socket] Disconnected: ${reason}`);
    });

    riderSocketInstance.on('connect_error', (error) => {
      console.warn(`[Rider Socket] Connection error:`, error.message);
    });
  } else if (token && riderSocketInstance.auth && (riderSocketInstance.auth as any).token !== token) {
    riderSocketInstance.auth = { token };
    riderSocketInstance.disconnect().connect();
  }

  return riderSocketInstance;
}

export function disconnectRiderSocket(): void {
  if (riderSocketInstance) {
    riderSocketInstance.disconnect();
    riderSocketInstance = null;
  }
}

export function emitLocationUpdate(
  socket: Socket,
  payload: {
    orderId: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    heading?: number;
    speed?: number;
    timestamp?: number;
  },
  callback?: (response: any) => void
): void {
  if (!socket || !socket.connected) {
    console.warn('[Rider Socket] Cannot emit location update - socket is not connected');
    return;
  }

  socket.emit('delivery:location:update', payload, callback);
}
