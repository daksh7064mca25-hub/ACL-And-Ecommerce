import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ||
                   process.env.NEXT_PUBLIC_API_URL ||
                   'http://localhost:5000';

let socketInstance: Socket | null = null;
let currentToken: string | null = null;

/**
 * Get or initialize the singleton Socket.IO client instance for Customer Panel.
 * Ensures only one socket connection exists throughout the application lifecycle.
 *
 * @param token - Optional JWT token from customer auth storage
 */
export function getSocket(token?: string | null): Socket {
  if (typeof window === 'undefined') {
    // Return a dummy object during SSR to prevent build errors
    return {} as Socket;
  }

  // If socket does not exist yet, create a new singleton connection
  if (!socketInstance) {
    currentToken = token || null;
    socketInstance = io(SOCKET_URL, {
      auth: {
        token: token ? (token.startsWith('Bearer ') ? token : `Bearer ${token}`) : undefined,
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      withCredentials: true,
    });

    socketInstance.on('connect', () => {
      console.log(`[Customer Socket] Connected successfully (ID: ${socketInstance?.id})`);
    });

    socketInstance.on('connect_error', (error) => {
      console.warn(`[Customer Socket] Connection error: ${error.message}`);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log(`[Customer Socket] Disconnected: ${reason}`);
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log(`[Customer Socket] Reconnected after ${attemptNumber} attempts`);
    });
  } else if (token !== undefined && token !== currentToken) {
    // If auth token changed (e.g. login or logout), update handshake auth and reconnect
    currentToken = token || null;
    socketInstance.auth = {
      token: token ? (token.startsWith('Bearer ') ? token : `Bearer ${token}`) : undefined,
    };

    if (socketInstance.connected) {
      socketInstance.disconnect().connect();
    } else {
      socketInstance.connect();
    }
  }

  return socketInstance;
}

/**
 * Disconnect and tear down the socket instance (e.g. on customer logout).
 */
export function disconnectSocket(): void {
  if (socketInstance) {
    try {
      socketInstance.disconnect();
    } catch (err) {
      console.error('[Customer Socket] Error during disconnect:', err);
    }
    socketInstance = null;
    currentToken = null;
  }
}

/**
 * Join an individual order room to listen for live status updates.
 */
export function joinOrderRoom(orderId: string): void {
  const socket = getSocket();
  if (socket && socket.connected && orderId) {
    socket.emit('join:order', { orderId });
  }
}

/**
 * Leave an individual order room when unmounting detail view.
 */
export function leaveOrderRoom(orderId: string): void {
  const socket = getSocket();
  if (socket && socket.connected && orderId) {
    socket.emit('leave:order', { orderId });
  }
}
