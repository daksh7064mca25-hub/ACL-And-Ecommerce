'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getOrderById, OrderDetail, getProductImageUrl } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useSocket, DeliveryLocationPayload, DeliveryStatusPayload, DeliveryAssignedPayload } from '@/context/SocketContext';
import LiveTrackingMap from '@/components/LiveTrackingMap';

interface TrackOrderPageProps {
  params: Promise<{ id: string }>;
}

const DELIVERY_STEPS = [
  { key: 'confirmed', label: 'Order Confirmed', icon: '📝' },
  { key: 'assigned', label: 'Rider Assigned', icon: '🛵' },
  { key: 'picked_up', label: 'Picked Up', icon: '📦' },
  { key: 'on_the_way', label: 'On the Way', icon: '🚀' },
  { key: 'delivered', label: 'Delivered', icon: '🎉' },
];

export default function TrackOrderPage({ params }: TrackOrderPageProps) {
  const { id: orderId } = use(params);
  const router = useRouter();
  const { token, isAuthenticated } = useAuth();
  const {
    socket,
    isConnected,
    joinOrder,
    leaveOrder,
    onDeliveryLocation,
    onDeliveryStatus,
    onDeliveryAssigned,
    onOrderStatusUpdated,
  } = useSocket();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live real-time Rider coordinates
  const [riderLocation, setRiderLocation] = useState<{
    lat: number;
    lng: number;
    accuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
    timestamp?: number;
  } | null>(null);

  const [deliveryStatus, setDeliveryStatus] = useState<string>('unassigned');
  const [lastLocationUpdate, setLastLocationUpdate] = useState<string | number | null>(null);

  // 1. Fetch authoritative order state from REST API
  const fetchOrderDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await getOrderById(orderId);
      if (res.success && res.order) {
        setOrder(res.order);
        setDeliveryStatus(res.order.deliveryStatus || 'unassigned');
        if (res.order.riderLocation?.coordinates && res.order.riderLocation.coordinates.length === 2) {
          const [lng, lat] = res.order.riderLocation.coordinates;
          setRiderLocation({
            lat,
            lng,
            accuracy: res.order.riderLocation.accuracy,
            heading: res.order.riderLocation.heading,
            speed: res.order.riderLocation.speed,
          });
        }
        if (res.order.lastLocationUpdate) {
          setLastLocationUpdate(res.order.lastLocationUpdate);
        }
      } else {
        setErrorMessage(res.message || 'Order not found');
      }
    } catch (err: any) {
      console.error('[TrackOrder] Fetch error:', err);
      setErrorMessage(err.message || 'Failed to load delivery details');
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  // 2. Join authorized Socket.IO order room & subscribe to real-time events
  useEffect(() => {
    if (!orderId) return;

    joinOrder(orderId);

    const unsubLocation = onDeliveryLocation((data: DeliveryLocationPayload) => {
      if (data.orderId === orderId && deliveryStatus !== 'delivered') {
        setRiderLocation({
          lat: data.latitude,
          lng: data.longitude,
          accuracy: data.accuracy,
          heading: data.heading,
          speed: data.speed,
          timestamp: data.timestamp,
        });
        setLastLocationUpdate(data.timestamp);
      }
    });

    const unsubStatus = onDeliveryStatus((data: DeliveryStatusPayload) => {
      if (data.orderId === orderId) {
        const nextStatus = data.status || data.deliveryStatus;
        setDeliveryStatus(nextStatus);
        setOrder((prev) =>
          prev
            ? {
                ...prev,
                deliveryStatus: nextStatus as any,
                orderStatus: (data.orderStatus as any) || (nextStatus === 'delivered' ? 'completed' : prev.orderStatus),
                deliveredAt: (data as any).deliveredAt || prev.deliveredAt,
              }
            : prev
        );
        if (nextStatus === 'delivered') {
          leaveOrder(orderId);
        }
      }
    });

    const unsubAssigned = onDeliveryAssigned((data: DeliveryAssignedPayload) => {
      if (data.orderId === orderId) {
        setDeliveryStatus(data.deliveryStatus || 'assigned');
        setOrder((prev) =>
          prev
            ? {
                ...prev,
                assignedRider: data.riderId,
                assignedRiderName: data.riderName,
                assignedRiderPhone: data.riderPhone,
                deliveryStatus: data.deliveryStatus as any,
              }
            : prev
        );
      }
    });

    const unsubOrder = onOrderStatusUpdated((data) => {
      if (data.orderId === orderId) {
        setOrder((prev) =>
          prev
            ? {
                ...prev,
                orderStatus: data.orderStatus as any,
                deliveryStatus: ((data as any).deliveryStatus as any) || prev.deliveryStatus,
                deliveredAt: ((data as any).deliveredAt as any) || prev.deliveredAt,
              }
            : prev
        );
        if ((data as any).deliveryStatus === 'delivered' || data.orderStatus === 'completed') {
          setDeliveryStatus('delivered');
          leaveOrder(orderId);
        }
      }
    });

    return () => {
      leaveOrder(orderId);
      unsubLocation();
      unsubStatus();
      unsubAssigned();
      unsubOrder();
    };
  }, [orderId, joinOrder, leaveOrder, onDeliveryLocation, onDeliveryStatus, onDeliveryAssigned, onOrderStatusUpdated, deliveryStatus]);

  // 3. Authoritative recovery on socket reconnection
  useEffect(() => {
    if (isConnected && deliveryStatus !== 'delivered' && order?.deliveryStatus !== 'delivered') {
      joinOrder(orderId);
    }
  }, [isConnected, orderId, joinOrder, deliveryStatus, order?.deliveryStatus]);

  const isDelivered = deliveryStatus === 'delivered' || order?.deliveryStatus === 'delivered' || order?.orderStatus === 'completed';

  const getStepStatus = (stepKey: string) => {
    if (isDelivered) {
      return 'completed';
    }
    const statusOrder = ['confirmed', 'assigned', 'accepted', 'picked_up', 'on_the_way', 'delivered'];
    const currentIdx = statusOrder.indexOf(deliveryStatus === 'accepted' ? 'assigned' : deliveryStatus);
    const stepIdx = statusOrder.indexOf(stepKey);

    if (currentIdx > stepIdx) return 'completed';
    if (currentIdx === stepIdx) return 'current';
    return 'upcoming';
  };

  const destinationCoords = order?.deliveryLocation?.coordinates && order.deliveryLocation.coordinates.length === 2
    ? { lat: order.deliveryLocation.coordinates[1], lng: order.deliveryLocation.coordinates[0] }
    : { lat: 30.7333, lng: 76.7794 };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-colors bg-gray-900/60 border border-gray-800 px-4 py-2 rounded-xl"
        >
          ← Back to Orders
        </Link>

        <div className="flex items-center gap-3">
          {isDelivered ? (
            <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-500/40 px-3.5 py-1.5 rounded-full text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-emerald-300 font-bold">Delivery Completed</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-gray-900/60 border border-gray-800 px-3.5 py-1.5 rounded-full text-xs font-medium">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span className="text-gray-300 font-semibold">{isConnected ? 'Live GPS Connected' : 'Reconnecting...'}</span>
            </div>
          )}

          <button
            onClick={fetchOrderDetails}
            className="text-xs bg-gray-800/80 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded-xl border border-gray-700 transition font-bold cursor-pointer"
            title="Refresh authoritative state"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Loading / Error States */}
      {isLoading && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-12 text-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 text-xs font-semibold">Connecting to live delivery telemetry...</p>
        </div>
      )}

      {errorMessage && !isLoading && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-3xl p-8 text-center space-y-3">
          <div className="text-3xl">⚠️</div>
          <h3 className="text-lg font-bold text-rose-200">Could not track delivery</h3>
          <p className="text-xs text-gray-400">{errorMessage}</p>
          <Link
            href="/orders"
            className="inline-block bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition"
          >
            Return to My Orders
          </Link>
        </div>
      )}

      {order && !isLoading && (
        <>
          {/* Title & Order Summary Banner */}
          <div className="bg-gradient-to-r from-gray-900 via-indigo-950/20 to-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-black tracking-tight text-white">
                  {isDelivered ? 'Order Delivery Completed' : 'Live Delivery Tracking'}
                </h1>
                <span
                  className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                    isDelivered
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                  }`}
                >
                  {isDelivered ? 'DELIVERED' : deliveryStatus.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Order #{order._id?.slice(-8)?.toUpperCase()} • Placed on {new Date(order.createdAt).toLocaleDateString()}
                {isDelivered && order.deliveredAt && (
                  <span className="text-emerald-400 font-semibold ml-2">
                    • Delivered at {new Date(order.deliveredAt).toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Total Amount</span>
                <span className="text-lg font-black text-white">₹{order.totalAmount}</span>
              </div>
              <div className="h-8 w-px bg-gray-800 mx-1"></div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Payment</span>
                <span className="text-xs font-black text-emerald-400 uppercase">{order.paymentStatus}</span>
              </div>
            </div>
          </div>

          {/* Clean Completed Delivery Action Box (Section 2.F) */}
          {isDelivered && (
            <div className="bg-gradient-to-r from-emerald-950/70 via-gray-900 to-emerald-950/70 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-3xl shadow-lg shadow-emerald-500/20">
                  🎉
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Your package has been delivered!</h2>
                  <p className="text-xs text-emerald-300 font-medium">
                    Order #{order._id?.slice(-8)?.toUpperCase()} was completed on{' '}
                    {order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : 'today'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Thank you for ordering with ExpertoStore. Live telemetry is now closed.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 w-full sm:w-auto">
                <Link
                  href="/orders"
                  className="flex-1 sm:flex-initial text-center px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold transition border border-gray-700"
                >
                  ← Return to My Orders
                </Link>
                <Link
                  href="/products"
                  className="flex-1 sm:flex-initial text-center px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/25"
                >
                  Continue Shopping →
                </Link>
              </div>
            </div>
          )}

          {/* LIVE GOOGLE MAP */}
          <LiveTrackingMap
            destination={{
              lat: destinationCoords.lat,
              lng: destinationCoords.lng,
              formattedAddress: order.deliveryLocation?.formattedAddress || order.shippingAddress?.line1 || 'Destination',
            }}
            riderLocation={riderLocation}
            riderName={order.assignedRiderName || 'Delivery Partner'}
            deliveryStatus={deliveryStatus}
            lastUpdated={isDelivered && order.deliveredAt ? order.deliveredAt : lastLocationUpdate}
            isCompleted={isDelivered}
          />

          {/* Delivery Progress Steps Timeline */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-6">Delivery Progress</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {DELIVERY_STEPS.map((step) => {
                const status = getStepStatus(step.key);
                const isCompleted = status === 'completed';
                const isCurrent = status === 'current';

                return (
                  <div
                    key={step.key}
                    className={`relative flex flex-col items-center p-3.5 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-orange-500/10 border-orange-500/50 shadow-lg shadow-orange-500/10'
                        : isCompleted
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-gray-900/30 border-gray-800/60 opacity-60'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-2 shadow-md ${
                        isCurrent
                          ? 'bg-orange-500 text-white animate-bounce'
                          : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-800 text-gray-500'
                      }`}
                    >
                      {isCompleted ? '✓' : step.icon}
                    </div>
                    <span
                      className={`text-xs font-bold text-center ${
                        isCurrent ? 'text-orange-400' : isCompleted ? 'text-emerald-300' : 'text-gray-400'
                      }`}
                    >
                      {step.label}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] text-orange-400/80 mt-1 animate-pulse font-bold">In Progress</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rider & Destination Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Rider Information Card */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Delivery Partner</h3>
                  <span className="text-xs bg-gray-800 text-gray-300 px-2.5 py-0.5 rounded-full font-bold">
                    {order.assignedRider ? 'Rider On Duty' : 'Assigning Soon'}
                  </span>
                </div>

                {order.assignedRider ? (
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-2xl shadow-lg shadow-orange-500/20">
                      🛵
                    </div>
                    <div>
                      <h4 className="text-base font-black text-white">{order.assignedRiderName || 'Delivery Partner'}</h4>
                      <p className="text-xs text-emerald-400 font-bold mt-0.5">Verified Delivery Specialist</p>
                      {order.assignedRiderPhone && (
                        <p className="text-xs text-gray-400 mt-1">📞 {order.assignedRiderPhone}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-gray-800/40 border border-dashed border-gray-700 text-center">
                    <span className="text-2xl block mb-1">⏳</span>
                    <p className="text-xs text-gray-300 font-bold">Matching your order with a nearby rider...</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">You will receive a live notification once assigned.</p>
                  </div>
                )}
              </div>

              {order.assignedRiderPhone && (
                <a
                  href={`tel:${order.assignedRiderPhone}`}
                  className="mt-5 w-full bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold py-3 rounded-2xl border border-gray-700 flex items-center justify-center gap-2 transition"
                >
                  <span>📞</span> Call Delivery Partner
                </a>
              )}
            </div>

            {/* Delivery Destination Card */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-6 shadow-xl">
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-4">Delivery Address</h3>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-lg flex-shrink-0">
                  📍
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white mb-0.5">
                    {order.customerName || order.customerEmail}
                  </h5>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {order.deliveryLocation?.formattedAddress ||
                      [
                        order.shippingAddress?.line1,
                        order.shippingAddress?.line2,
                        order.shippingAddress?.city,
                        order.shippingAddress?.state,
                        order.shippingAddress?.postal_code,
                      ]
                        .filter(Boolean)
                        .join(', ') ||
                      'Delivery Address'}
                  </p>
                  {order.estimatedDeliveryTime && (
                    <span className="inline-block mt-2 text-[11px] bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 px-2.5 py-0.5 rounded-full font-bold">
                      ⏱️ Est: {order.estimatedDeliveryTime}
                    </span>
                  )}
                </div>
              </div>

              {/* Items in this order */}
              <div className="border-t border-gray-800 pt-4 mt-4">
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Order Items ({order.items?.length || 0})
                </h4>
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {order.items?.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1">
                      <span className="text-gray-300 truncate max-w-[200px] font-medium">
                        {item.quantity}x {item.title}
                      </span>
                      <span className="font-bold text-white">₹{item.priceAtPurchase * item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
