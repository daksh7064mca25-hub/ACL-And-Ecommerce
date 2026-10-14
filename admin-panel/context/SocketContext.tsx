'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getAdminSocket, disconnectAdminSocket } from '@/lib/socket';
import { getToken } from '@/lib/auth';

export interface AdminToast {
  id: string;
  type: 'order' | 'refund' | 'payment' | 'product' | 'info';
  title: string;
  message: string;
  timestamp: number;
}

export interface AdminNotification {
  id: string;
  type: 'order' | 'refund' | 'payment' | 'product' | 'system';
  title: string;
  message: string;
  createdAt: string;
  relatedId?: string | null;
  read: boolean;
}

export interface OrderCreatedPayload {
  orderId: string;
  customerName?: string;
  customerEmail?: string;
  totalAmount: number;
  currency?: string;
  itemsCount?: number;
  createdAt?: string;
}

export interface RefundRequestedPayload {
  refundRequestId: string;
  orderId: string;
  customerEmail: string;
  requestedAmount: number;
  reason: string;
  status: string;
  createdAt?: string;
}

export interface DeliveryLocationPayload {
  orderId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

interface AdminSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  notifications: AdminNotification[];
  unreadCount: number;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  toasts: AdminToast[];
  removeToast: (id: string) => void;
  onOrderCreated: (callback: (data: OrderCreatedPayload) => void) => () => void;
  onRefundRequested: (callback: (data: RefundRequestedPayload) => void) => () => void;
  onRefundStatusUpdated: (callback: (data: any) => void) => () => void;
  onPaymentSuccess: (callback: (data: any) => void) => () => void;
  onPaymentFailed: (callback: (data: any) => void) => () => void;
  onStockUpdated: (callback: (data: { productId: string; stock: number }) => void) => () => void;
  onProductCreated: (callback: (data: any) => void) => () => void;
  onProductUpdated: (callback: (data: any) => void) => () => void;
  onDeliveryAssigned: (callback: (data: any) => void) => () => void;
  onDeliveryStatus: (callback: (data: any) => void) => () => void;
  onDeliveryLocation: (callback: (data: DeliveryLocationPayload) => void) => () => void;
}

const SocketContext = createContext<AdminSocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [toasts, setToasts] = useState<AdminToast[]>([]);

  // Add a real-time toast alert
  const addToast = useCallback((toast: Omit<AdminToast, 'id' | 'timestamp'>) => {
    const id = `adm_toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newToast: AdminToast = {
      ...toast,
      id,
      timestamp: Date.now(),
    };

    setToasts((prev) => [newToast, ...prev.slice(0, 4)]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Add an item to the notification drawer
  const addNotification = useCallback((notif: Omit<AdminNotification, 'read'>) => {
    setNotifications((prev) => [
      {
        ...notif,
        read: false,
      },
      ...prev.slice(0, 49), // Keep last 50
    ]);
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    const token = getToken();
    const s = getAdminSocket(token);
    setSocket(s);

    const handleConnect = () => {
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    s.on('connect', handleConnect);
    s.on('disconnect', handleDisconnect);

    if (s.connected) {
      setIsConnected(true);
    }

    // Admin Real-time Event Handlers
    const handleOrderCreated = (data: OrderCreatedPayload) => {
      console.log('[Admin Socket] New order created:', data);
      addToast({
        type: 'order',
        title: 'New Order Received! 🛍️',
        message: `Order #${data.orderId?.slice(-6)?.toUpperCase()} for ₹${data.totalAmount} by ${data.customerName || data.customerEmail}`,
      });
      addNotification({
        id: `notif_ord_${data.orderId}_${Date.now()}`,
        type: 'order',
        title: 'New Order Placed',
        message: `Order #${data.orderId} (₹${data.totalAmount}) placed by ${data.customerName || data.customerEmail}`,
        createdAt: new Date().toISOString(),
        relatedId: data.orderId,
      });
    };

    const handleRefundRequested = (data: RefundRequestedPayload) => {
      console.log('[Admin Socket] New refund requested:', data);
      addToast({
        type: 'refund',
        title: 'New Refund Request! ⚠️',
        message: `Refund of ₹${data.requestedAmount} requested for Order #${data.orderId?.slice(-6)?.toUpperCase()}`,
      });
      addNotification({
        id: `notif_ref_${data.refundRequestId}_${Date.now()}`,
        type: 'refund',
        title: 'Refund Request Received',
        message: `Customer ${data.customerEmail} requested refund for Order #${data.orderId} (${data.reason})`,
        createdAt: new Date().toISOString(),
        relatedId: data.refundRequestId,
      });
    };

    const handlePaymentSuccess = (data: any) => {
      console.log('[Admin Socket] Payment success:', data);
      addToast({
        type: 'payment',
        title: 'Payment Confirmed 💳',
        message: `Payment confirmed for Order #${data.orderId?.slice(-6)?.toUpperCase()}`,
      });
    };

    const handlePaymentFailed = (data: any) => {
      console.warn('[Admin Socket] Payment failed:', data);
      addToast({
        type: 'payment',
        title: 'Payment Transaction Failed ❌',
        message: data.failureReason || `Payment failed for Order #${data.orderId?.slice(-6)?.toUpperCase()}`,
      });
    };

    const handleNotificationNew = (data: any) => {
      if (data?.title) {
        addNotification({
          id: data.id || `notif_${Date.now()}`,
          type: data.type || 'system',
          title: data.title,
          message: data.message || '',
          createdAt: data.createdAt || new Date().toISOString(),
          relatedId: data.relatedId,
        });
      }
    };

    s.on('order:created', handleOrderCreated);
    s.on('refund:requested', handleRefundRequested);
    s.on('payment:success', handlePaymentSuccess);
    s.on('payment:failed', handlePaymentFailed);
    s.on('notification:new', handleNotificationNew);

    return () => {
      s.off('connect', handleConnect);
      s.off('disconnect', handleDisconnect);
      s.off('order:created', handleOrderCreated);
      s.off('refund:requested', handleRefundRequested);
      s.off('payment:success', handlePaymentSuccess);
      s.off('payment:failed', handlePaymentFailed);
      s.off('notification:new', handleNotificationNew);
    };
  }, [addToast, addNotification]);

  // Subscription helpers for components
  const onOrderCreated = useCallback((callback: (data: OrderCreatedPayload) => void) => {
    const s = getAdminSocket();
    if (!s) return () => {};
    s.on('order:created', callback);
    return () => {
      s.off('order:created', callback);
    };
  }, []);

  const onRefundRequested = useCallback((callback: (data: RefundRequestedPayload) => void) => {
    const s = getAdminSocket();
    if (!s) return () => {};
    s.on('refund:requested', callback);
    return () => {
      s.off('refund:requested', callback);
    };
  }, []);

  const onRefundStatusUpdated = useCallback((callback: (data: any) => void) => {
    const s = getAdminSocket();
    if (!s) return () => {};
    s.on('refund:statusUpdated', callback);
    return () => {
      s.off('refund:statusUpdated', callback);
    };
  }, []);

  const onPaymentSuccess = useCallback((callback: (data: any) => void) => {
    const s = getAdminSocket();
    if (!s) return () => {};
    s.on('payment:success', callback);
    return () => {
      s.off('payment:success', callback);
    };
  }, []);

  const onPaymentFailed = useCallback((callback: (data: any) => void) => {
    const s = getAdminSocket();
    if (!s) return () => {};
    s.on('payment:failed', callback);
    return () => {
      s.off('payment:failed', callback);
    };
  }, []);

  const onStockUpdated = useCallback((callback: (data: { productId: string; stock: number }) => void) => {
    const s = getAdminSocket();
    if (!s) return () => {};
    s.on('product:stockUpdated', callback);
    return () => {
      s.off('product:stockUpdated', callback);
    };
  }, []);

  const onProductCreated = useCallback((callback: (data: any) => void) => {
    const s = getAdminSocket();
    if (!s) return () => {};
    s.on('product:created', callback);
    return () => {
      s.off('product:created', callback);
    };
  }, []);

  const onProductUpdated = useCallback((callback: (data: any) => void) => {
    const s = getAdminSocket();
    if (!s) return () => {};
    s.on('product:updated', callback);
    return () => {
      s.off('product:updated', callback);
    };
  }, []);

  const onDeliveryAssigned = useCallback((callback: (data: any) => void) => {
    const s = getAdminSocket();
    if (!s) return () => {};
    s.on('delivery:assigned', callback);
    return () => {
      s.off('delivery:assigned', callback);
    };
  }, []);

  const onDeliveryStatus = useCallback((callback: (data: any) => void) => {
    const s = getAdminSocket();
    if (!s) return () => {};
    s.on('delivery:status', callback);
    return () => {
      s.off('delivery:status', callback);
    };
  }, []);

  const onDeliveryLocation = useCallback((callback: (data: DeliveryLocationPayload) => void) => {
    const s = getAdminSocket();
    if (!s) return () => {};
    s.on('delivery:location', callback);
    return () => {
      s.off('delivery:location', callback);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        notifications,
        unreadCount,
        markAllAsRead,
        clearNotifications,
        toasts,
        removeToast,
        onOrderCreated,
        onRefundRequested,
        onRefundStatusUpdated,
        onPaymentSuccess,
        onPaymentFailed,
        onStockUpdated,
        onProductCreated,
        onProductUpdated,
        onDeliveryAssigned,
        onDeliveryStatus,
        onDeliveryLocation,
      }}
    >
      {children}
      {/* Floating Real-time Admin Toasts */}
      <div className="fixed top-20 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-xl border backdrop-blur-md transition-all duration-300 transform animate-in fade-in slide-in-from-top-3 ${
              toast.type === 'order'
                ? 'bg-indigo-900/95 border-indigo-500/50 text-white'
                : toast.type === 'refund'
                ? 'bg-amber-900/95 border-amber-500/50 text-white'
                : toast.type === 'payment'
                ? 'bg-emerald-900/95 border-emerald-500/50 text-white'
                : 'bg-slate-900/95 border-slate-700 text-white'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="text-lg leading-none mt-0.5">
                  {toast.type === 'order' ? '📦' : toast.type === 'refund' ? '↩️' : toast.type === 'payment' ? '💳' : '🔔'}
                </span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider">{toast.title}</h4>
                  <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">{toast.message}</p>
                </div>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer p-0.5"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
