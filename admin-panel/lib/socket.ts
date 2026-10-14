import { io, Socket } from 'socket.io-client';
import { getToken } from './auth';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ||
                   process.env.NEXT_PUBLIC_API_URL ||
                   'http://localhost:5000';

let adminSocketInstance: Socket | null = null;
let currentAdminToken: string | null = null;

/**
 * Get or initialize the singleton Socket.IO client instance for Admin Panel.
 * Authenticates using the stored Admin JWT token.
 *
 * @param token - Optional JWT token from admin storage
 */
export function getAdminSocket(token?: string | null): Socket {
  if (typeof window === 'undefined') {
    return {} as Socket;
  }

  const effectiveToken = token !== undefined ? token : getToken();

  if (!adminSocketInstance) {
    currentAdminToken = effectiveToken || null;
    adminSocketInstance = io(SOCKET_URL, {
      auth: {
        token: effectiveToken ? (effectiveToken.startsWith('Bearer ') ? effectiveToken : `Bearer ${effectiveToken}`) : undefined,
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      withCredentials: true,
    });

    adminSocketInstance.on('connect', () => {
      console.log(`[Admin Socket] Connected successfully (ID: ${adminSocketInstance?.id})`);
    });

    adminSocketInstance.on('connect_error', (error) => {
      console.warn(`[Admin Socket] Connection error: ${error.message}`);
    });

    adminSocketInstance.on('disconnect', (reason) => {
      console.log(`[Admin Socket] Disconnected: ${reason}`);
    });

    adminSocketInstance.on('reconnect', (attemptNumber) => {
      console.log(`[Admin Socket] Reconnected after ${attemptNumber} attempts`);
    });
  } else if (effectiveToken !== undefined && effectiveToken !== currentAdminToken) {
    currentAdminToken = effectiveToken || null;
    adminSocketInstance.auth = {
      token: effectiveToken ? (effectiveToken.startsWith('Bearer ') ? effectiveToken : `Bearer ${effectiveToken}`) : undefined,
    };

    if (adminSocketInstance.connected) {
      adminSocketInstance.disconnect().connect();
    } else {
      adminSocketInstance.connect();
    }
  }

  return adminSocketInstance;
}

/**
 * Disconnect and destroy the admin socket instance (e.g. on logout).
 */
export function disconnectAdminSocket(): void {
  if (adminSocketInstance) {
    try {
      adminSocketInstance.disconnect();
    } catch (err) {
      console.error('[Admin Socket] Error during disconnect:', err);
    }
    adminSocketInstance = null;
    currentAdminToken = null;
  }
}
