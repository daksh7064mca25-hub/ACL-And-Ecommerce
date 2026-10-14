'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getRiderSocket, disconnectRiderSocket } from '@/lib/socket';
import { useAuth } from './AuthContext';

export interface RiderToast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  toasts: RiderToast[];
  removeToast: (id: string) => void;
  onDeliveryAssigned: (callback: (data: any) => void) => () => void;
  onDeliveryStatus: (callback: (data: any) => void) => () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [toasts, setToasts] = useState<RiderToast[]>([]);

  const addToast = useCallback((toast: Omit<RiderToast, 'id'>) => {
    const id = `rd_toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newToast: RiderToast = { ...toast, id };
    setToasts((prev) => [newToast, ...prev.slice(0, 3)]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const s = getRiderSocket(token);
    setSocket(s);

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    s.on('connect', handleConnect);
    s.on('disconnect', handleDisconnect);

    if (s.connected) setIsConnected(true);

    const handleDeliveryAssigned = (data: any) => {
      console.log('[Rider Socket] Received new assignment:', data);
      addToast({
        type: 'info',
        title: 'New Delivery Assigned! 🛵',
        message: `Order #${data.orderId?.slice(-6)?.toUpperCase()} has been assigned to you.`,
      });
    };

    s.on('delivery:assigned', handleDeliveryAssigned);

    return () => {
      s.off('connect', handleConnect);
      s.off('disconnect', handleDisconnect);
      s.off('delivery:assigned', handleDeliveryAssigned);
    };
  }, [token, isAuthenticated, addToast]);

  const onDeliveryAssigned = useCallback((callback: (data: any) => void) => {
    const s = getRiderSocket();
    if (!s) return () => {};
    s.on('delivery:assigned', callback);
    return () => {
      s.off('delivery:assigned', callback);
    };
  }, []);

  const onDeliveryStatus = useCallback((callback: (data: any) => void) => {
    const s = getRiderSocket();
    if (!s) return () => {};
    s.on('delivery:status', callback);
    return () => {
      s.off('delivery:status', callback);
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        toasts,
        removeToast,
        onDeliveryAssigned,
        onDeliveryStatus,
      }}
    >
      {children}
      {/* Real-time Rider Toast Alerts */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto p-4 rounded-2xl bg-orange-950/90 border border-orange-500/40 text-orange-100 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-3 flex items-start justify-between gap-3"
          >
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider">{toast.title}</h4>
              <p className="text-xs text-orange-200/90 mt-0.5">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-orange-400 hover:text-white text-xs p-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within a SocketProvider');
  return context;
};
