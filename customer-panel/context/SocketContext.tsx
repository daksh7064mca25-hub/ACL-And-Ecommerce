'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket, joinOrderRoom, leaveOrderRoom } from '@/lib/socket';
import { useAuth } from './AuthContext';

export interface RealtimeToast {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
}

export interface StockUpdatePayload {
  productId: string;
  stock: number;
}

export interface OrderStatusPayload {
  orderId: string;
  orderStatus: string;
  paymentStatus: string;
  refundStatus?: string;
  totalAmount?: number;
  updatedAt?: string;
}

export interface PaymentSuccessPayload {
  orderId: string;
  paymentStatus: string;
  orderStatus?: string;
  totalAmount?: number;
}

export interface RefundStatusPayload {
  refundRequestId: string;
  orderId: string;
  status: string;
  refundStatus?: string;
  approvedAmount?: number;
  adminNote?: string;
}

export interface DeliveryAssignedPayload {
  orderId: string;
  riderId: string;
  riderName?: string;
  riderPhone?: string;
  deliveryStatus: string;
  assignedAt: string | number;
}

export interface DeliveryStatusPayload {
  orderId: string;
  status: string;
  deliveryStatus: string;
  orderStatus?: string;
  riderId?: string;
  riderName?: string;
  updatedAt?: string;
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

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  toasts: RealtimeToast[];
  removeToast: (id: string) => void;
  joinOrder: (orderId: string) => void;
  leaveOrder: (orderId: string) => void;
  onStockUpdated: (callback: (data: StockUpdatePayload) => void) => () => void;
  onProductCreated: (callback: (data: any) => void) => () => void;
  onProductUpdated: (callback: (data: any) => void) => () => void;
  onOrderStatusUpdated: (callback: (data: OrderStatusPayload) => void) => () => void;
  onPaymentSuccess: (callback: (data: PaymentSuccessPayload) => void) => () => void;
  onPaymentFailed: (callback: (data: any) => void) => () => void;
  onRefundStatusUpdated: (callback: (data: RefundStatusPayload) => void) => () => void;
  onDeliveryAssigned: (callback: (data: DeliveryAssignedPayload) => void) => () => void;
  onDeliveryStatus: (callback: (data: DeliveryStatusPayload) => void) => () => void;
  onDeliveryLocation: (callback: (data: DeliveryLocationPayload) => void) => () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [toasts, setToasts] = useState<RealtimeToast[]>([]);

  // Push a live notification toast
  const addToast = useCallback((toast: Omit<RealtimeToast, 'id' | 'timestamp'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newToast: RealtimeToast = {
      ...toast,
      id,
      timestamp: Date.now(),
    };

    setToasts((prev) => [newToast, ...prev.slice(0, 4)]);

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Initialize and synchronize socket on auth changes
  useEffect(() => {
    const s = getSocket(token);
    setSocket(s);

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    s.on('connect', handleConnect);
    s.on('disconnect', handleDisconnect);

    if (s.connected) {
      setIsConnected(true);
    }

    // Register global customer real-time event listeners
    const handleStockUpdate = (data: StockUpdatePayload) => {
      console.log('[Customer Socket] Received stock update:', data);
    };

    const handleOrderStatus = (data: OrderStatusPayload) => {
      console.log('[Customer Socket] Received order status update:', data);
      addToast({
        type: 'info',
        title: 'Order Status Updated',
        message: `Order #${data.orderId?.slice(-6)?.toUpperCase()} is now ${data.orderStatus?.toUpperCase()}`,
      });
    };

    const handlePaymentSuccess = (data: PaymentSuccessPayload) => {
      console.log('[Customer Socket] Received payment success event:', data);
      addToast({
        type: 'success',
        title: 'Payment Confirmed! 🎉',
        message: `Payment confirmed for Order #${data.orderId?.slice(-6)?.toUpperCase()}`,
      });
    };

    const handlePaymentFailed = (data: any) => {
      console.warn('[Customer Socket] Received payment failed event:', data);
      addToast({
        type: 'error',
        title: 'Payment Failed',
        message: data.failureReason || `Payment failed for Order #${data.orderId?.slice(-6)?.toUpperCase()}`,
      });
    };

    const handleRefundStatus = (data: RefundStatusPayload) => {
      console.log('[Customer Socket] Received refund status update:', data);
      const statusText = data.status === 'refunded' ? 'Approved & Refunded' : data.status?.toUpperCase();
      addToast({
        type: data.status === 'refunded' ? 'success' : data.status === 'rejected' ? 'error' : 'info',
        title: 'Refund Status Update',
        message: `Your refund request for Order #${data.orderId?.slice(-6)?.toUpperCase()} is now: ${statusText}`,
      });
    };

    const handleDeliveryAssigned = (data: DeliveryAssignedPayload) => {
      console.log('[Customer Socket] Received delivery:assigned:', data);
      addToast({
        type: 'info',
        title: 'Rider Assigned 🛵',
        message: `Rider ${data.riderName || 'assigned'} is getting ready to deliver your order #${data.orderId?.slice(-6)?.toUpperCase()}`,
      });
    };

    const handleDeliveryStatus = (data: DeliveryStatusPayload) => {
      console.log('[Customer Socket] Received delivery:status:', data);
      const statusMessages: Record<string, string> = {
        assigned: 'Rider has been assigned to your order.',
        accepted: 'Rider has accepted your delivery request.',
        picked_up: 'Your order has been picked up from store.',
        on_the_way: 'Your rider is on the way!',
        delivered: 'Your order has been delivered. Enjoy!',
        cancelled: 'Delivery was cancelled.',
      };
      const msg = statusMessages[data.status] || `Delivery status changed to ${data.status}`;
      addToast({
        type: data.status === 'delivered' ? 'success' : data.status === 'cancelled' ? 'error' : 'info',
        title: `Delivery: ${data.status.replace(/_/g, ' ').toUpperCase()} 📍`,
        message: msg,
      });
    };

    const handleNotification = (data: any) => {
      if (data?.title && data?.message) {
        addToast({
          type: data.type === 'payment' ? 'success' : 'info',
          title: data.title,
          message: data.message,
        });
      }
    };

    s.on('product:stockUpdated', handleStockUpdate);
    s.on('order:statusUpdated', handleOrderStatus);
    s.on('payment:success', handlePaymentSuccess);
    s.on('payment:failed', handlePaymentFailed);
    s.on('refund:statusUpdated', handleRefundStatus);
    s.on('delivery:assigned', handleDeliveryAssigned);
    s.on('delivery:status', handleDeliveryStatus);
    s.on('notification:new', handleNotification);

    return () => {
      s.off('connect', handleConnect);
      s.off('disconnect', handleDisconnect);
      s.off('product:stockUpdated', handleStockUpdate);
      s.off('order:statusUpdated', handleOrderStatus);
      s.off('payment:success', handlePaymentSuccess);
      s.off('payment:failed', handlePaymentFailed);
      s.off('refund:statusUpdated', handleRefundStatus);
      s.off('delivery:assigned', handleDeliveryAssigned);
      s.off('delivery:status', handleDeliveryStatus);
      s.off('notification:new', handleNotification);
    };
  }, [token, isAuthenticated, addToast]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      // Keep socket alive during page transitions, disconnect only on window unload
    };
  }, []);

  // Event listener subscription helpers for individual components
  const onStockUpdated = useCallback((callback: (data: StockUpdatePayload) => void) => {
    const s = getSocket();
    if (!s) return () => {};
    s.on('product:stockUpdated', callback);
    return () => {
      s.off('product:stockUpdated', callback);
    };
  }, []);

  const onProductCreated = useCallback((callback: (data: any) => void) => {
    const s = getSocket();
    if (!s) return () => {};
    s.on('product:created', callback);
    return () => {
      s.off('product:created', callback);
    };
  }, []);

  const onProductUpdated = useCallback((callback: (data: any) => void) => {
    const s = getSocket();
    if (!s) return () => {};
    s.on('product:updated', callback);
    return () => {
      s.off('product:updated', callback);
    };
  }, []);

  const onOrderStatusUpdated = useCallback((callback: (data: OrderStatusPayload) => void) => {
    const s = getSocket();
    if (!s) return () => {};
    s.on('order:statusUpdated', callback);
    return () => {
      s.off('order:statusUpdated', callback);
    };
  }, []);

  const onPaymentSuccess = useCallback((callback: (data: PaymentSuccessPayload) => void) => {
    const s = getSocket();
    if (!s) return () => {};
    s.on('payment:success', callback);
    return () => {
      s.off('payment:success', callback);
    };
  }, []);

  const onPaymentFailed = useCallback((callback: (data: any) => void) => {
    const s = getSocket();
    if (!s) return () => {};
    s.on('payment:failed', callback);
    return () => {
      s.off('payment:failed', callback);
    };
  }, []);

  const onRefundStatusUpdated = useCallback((callback: (data: RefundStatusPayload) => void) => {
    const s = getSocket();
    if (!s) return () => {};
    s.on('refund:statusUpdated', callback);
    return () => {
      s.off('refund:statusUpdated', callback);
    };
  }, []);

  const onDeliveryAssigned = useCallback((callback: (data: DeliveryAssignedPayload) => void) => {
    const s = getSocket();
    if (!s) return () => {};
    s.on('delivery:assigned', callback);
    return () => {
      s.off('delivery:assigned', callback);
    };
  }, []);

  const onDeliveryStatus = useCallback((callback: (data: DeliveryStatusPayload) => void) => {
    const s = getSocket();
    if (!s) return () => {};
    s.on('delivery:status', callback);
    return () => {
      s.off('delivery:status', callback);
    };
  }, []);

  const onDeliveryLocation = useCallback((callback: (data: DeliveryLocationPayload) => void) => {
    const s = getSocket();
    if (!s) return () => {};
    s.on('delivery:location', callback);
    return () => {
      s.off('delivery:location', callback);
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        toasts,
        removeToast,
        joinOrder: joinOrderRoom,
        leaveOrder: leaveOrderRoom,
        onStockUpdated,
        onProductCreated,
        onProductUpdated,
        onOrderStatusUpdated,
        onPaymentSuccess,
        onPaymentFailed,
        onRefundStatusUpdated,
        onDeliveryAssigned,
        onDeliveryStatus,
        onDeliveryLocation,
      }}
    >
      {children}
      {/* Real-time Floating Toast Notification View */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-2xl border backdrop-blur-md transition-all duration-300 transform translate-y-0 animate-in fade-in slide-in-from-bottom-3 ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100'
                : toast.type === 'error'
                ? 'bg-red-950/90 border-red-500/40 text-red-100'
                : toast.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/40 text-amber-100'
                : 'bg-indigo-950/90 border-indigo-500/40 text-indigo-100'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-base">
                  {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : toast.type === 'warning' ? '⚠️' : '⚡'}
                </span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider">{toast.title}</h4>
                  <p className="text-xs text-gray-200 mt-0.5">{toast.message}</p>
                </div>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-gray-400 hover:text-white text-xs cursor-pointer p-1"
                aria-label="Close notification"
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
