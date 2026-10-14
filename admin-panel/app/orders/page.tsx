'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { getToken, getAdmin, AdminUser } from '@/lib/auth';
import { getAdminOrders, getAdminRiders, assignRiderToOrder, updateAdminOrderStatus } from '@/lib/api';
import { useSocket, DeliveryLocationPayload } from '@/context/SocketContext';
import AdminLiveTrackingMap from '@/components/AdminLiveTrackingMap';

export default function AdminOrdersPage() {
  const router = useRouter();
  const { socket, isConnected, onDeliveryStatus, onDeliveryLocation } = useSocket();

  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedRiderMap, setSelectedRiderMap] = useState<Record<string, string>>({});
  const [trackingOrder, setTrackingOrder] = useState<any | null>(null);

  // Live real-time location for the active tracking modal
  const [modalRiderLoc, setModalRiderLoc] = useState<{ lat: number; lng: number } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = getToken();
      if (!token) {
        router.replace('/login');
        return;
      }
      const cachedAdmin = getAdmin();
      if (cachedAdmin) setAdmin(cachedAdmin);

      const [ordersRes, ridersRes] = await Promise.all([
        getAdminOrders(token),
        getAdminRiders(token),
      ]);

      if (ordersRes.success && ordersRes.orders) {
        setOrders(ordersRes.orders);
      }
      if (ridersRes.success && ridersRes.riders) {
        setRiders(ridersRes.riders);
      }
    } catch (err) {
      console.error('[AdminOrders] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time listener for delivery status & location updates
  useEffect(() => {
    const unsubStatus = onDeliveryStatus((data) => {
      console.log('[Admin Orders] Socket delivery status update:', data);
      const nextDeliveryStatus = data.status || data.deliveryStatus;
      setOrders((prev) =>
        prev.map((ord) =>
          ord._id === data.orderId
            ? {
                ...ord,
                deliveryStatus: nextDeliveryStatus,
                orderStatus: data.orderStatus || (nextDeliveryStatus === 'delivered' ? 'completed' : ord.orderStatus),
                assignedRiderName: data.riderName || ord.assignedRiderName,
              }
            : ord
        )
      );
      if (trackingOrder && trackingOrder._id === data.orderId) {
        setTrackingOrder((prev: any) => ({
          ...prev,
          deliveryStatus: nextDeliveryStatus,
          orderStatus: data.orderStatus || (nextDeliveryStatus === 'delivered' ? 'completed' : prev.orderStatus),
        }));
      }
    });

    const unsubLoc = onDeliveryLocation((data: DeliveryLocationPayload) => {
      if (trackingOrder && trackingOrder._id === data.orderId) {
        setModalRiderLoc({ lat: data.latitude, lng: data.longitude });
      }
    });

    return () => {
      unsubStatus();
      unsubLoc();
    };
  }, [onDeliveryStatus, onDeliveryLocation, trackingOrder]);

  // Join order room when live tracking modal opens, and leave when closed
  useEffect(() => {
    if (!trackingOrder?._id || !socket) return;
    socket.emit('join:order', { orderId: trackingOrder._id });

    return () => {
      socket.emit('leave:order', { orderId: trackingOrder._id });
    };
  }, [trackingOrder?._id, socket]);

  const handleAssignRider = async (orderId: string) => {
    const riderId = selectedRiderMap[orderId];
    if (!riderId) return;

    try {
      setActionLoading(orderId);
      const token = getToken();
      const res = await assignRiderToOrder(orderId, riderId, token || undefined);
      if (res.success && res.order) {
        setOrders((prev) =>
          prev.map((ord) => (ord._id === orderId ? { ...ord, ...res.order } : ord))
        );
      }
    } catch (err) {
      console.error('Failed to assign rider:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateStatus = async (orderId: string, orderStatus: string) => {
    try {
      setActionLoading(orderId);
      const token = getToken();
      const res = await updateAdminOrderStatus(orderId, { orderStatus }, token || undefined);
      if (res.success && res.order) {
        setOrders((prev) =>
          prev.map((ord) => (ord._id === orderId ? { ...ord, orderStatus: res.order.orderStatus } : ord))
        );
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header admin={admin} title="Orders & Live Deliveries" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white tracking-tight">Orders & Live Delivery Monitoring</h1>
                <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {orders.length} Total
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Dispatch delivery riders, monitor real-time GPS locations, and manage customer order fulfillment.
              </p>
            </div>

            <button
              onClick={loadData}
              className="bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 px-4 py-2 rounded-xl border border-slate-700 transition flex items-center gap-2"
            >
              <span>🔄</span> Refresh
            </button>
          </div>

          {/* Orders Table */}
          {isLoading ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-xs text-slate-400">Loading live orders & assignments...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center">
              <div className="text-3xl mb-2">📦</div>
              <h3 className="text-sm font-bold text-white">No Orders Found</h3>
              <p className="text-xs text-slate-400 mt-1">Orders placed by customers will appear here in real-time.</p>
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3.5">Order ID & Date</th>
                      <th className="px-4 py-3.5">Customer</th>
                      <th className="px-4 py-3.5">Total & Payment</th>
                      <th className="px-4 py-3.5">Order Status</th>
                      <th className="px-4 py-3.5">Delivery Status</th>
                      <th className="px-4 py-3.5">Assigned Rider</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {orders.map((order) => {
                      const isAssigning = actionLoading === order._id;
                      const hasRider = Boolean(order.assignedRider);

                      return (
                        <tr key={order._id} className="hover:bg-slate-800/30 transition-colors">
                          {/* Order ID */}
                          <td className="px-4 py-3.5 font-mono">
                            <span className="font-bold text-white block">#{order._id.slice(-6).toUpperCase()}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>

                          {/* Customer */}
                          <td className="px-4 py-3.5">
                            <span className="font-semibold text-white block">{order.customerName || order.customerEmail || 'Guest'}</span>
                            <span className="text-[11px] text-slate-400 block truncate max-w-[150px]">{order.customerEmail}</span>
                          </td>

                          {/* Total & Payment */}
                          <td className="px-4 py-3.5">
                            <span className="font-bold text-white block">₹{order.totalAmount}</span>
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                                order.paymentStatus === 'paid'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {order.paymentStatus}
                            </span>
                          </td>

                          {/* Order Status */}
                          <td className="px-4 py-3.5">
                            <select
                              value={order.orderStatus}
                              onChange={(e) => handleUpdateStatus(order._id, e.target.value)}
                              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                            >
                              <option value="pending">Pending</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="processing">Processing</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>

                          {/* Delivery Status */}
                          <td className="px-4 py-3.5">
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-block ${
                                order.deliveryStatus === 'delivered'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : order.deliveryStatus === 'on_the_way'
                                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 animate-pulse'
                                  : order.deliveryStatus === 'assigned' || order.deliveryStatus === 'accepted' || order.deliveryStatus === 'picked_up'
                                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {(order.deliveryStatus || 'unassigned').replace(/_/g, ' ')}
                            </span>
                          </td>

                          {/* Assigned Rider & Selector */}
                          <td className="px-4 py-3.5">
                            {hasRider ? (
                              <div className="flex items-center gap-2">
                                <span className="text-base">🛵</span>
                                <div>
                                  <span className="font-bold text-white block">{order.assignedRiderName || 'Rider Assigned'}</span>
                                  {order.assignedRiderPhone && (
                                    <span className="text-[10px] text-slate-400 block">{order.assignedRiderPhone}</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={selectedRiderMap[order._id] || ''}
                                  onChange={(e) =>
                                    setSelectedRiderMap((prev) => ({ ...prev, [order._id]: e.target.value }))
                                  }
                                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white max-w-[130px] outline-none"
                                >
                                  <option value="">Select Rider</option>
                                  {riders.map((r) => (
                                    <option key={r._id} value={r._id}>
                                      {r.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  disabled={!selectedRiderMap[order._id] || isAssigning}
                                  onClick={() => handleAssignRider(order._id)}
                                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg transition"
                                >
                                  {isAssigning ? '...' : 'Assign'}
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5 text-right">
                            <button
                              onClick={() => {
                                setTrackingOrder(order);
                                if (order.riderLocation?.coordinates && order.riderLocation.coordinates.length === 2) {
                                  setModalRiderLoc({
                                    lat: order.riderLocation.coordinates[1],
                                    lng: order.riderLocation.coordinates[0],
                                  });
                                } else {
                                  setModalRiderLoc(null);
                                }
                              }}
                              className={`font-bold px-3 py-1.5 rounded-xl transition text-[11px] inline-flex items-center gap-1 border ${
                                order.deliveryStatus === 'delivered'
                                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                                  : 'bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 border-orange-500/30'
                              }`}
                            >
                              <span>{order.deliveryStatus === 'delivered' ? '✓' : '🗺️'}</span>
                              <span>{order.deliveryStatus === 'delivered' ? 'View Route' : 'Track Live'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Live Delivery Tracking Modal */}
          {trackingOrder && (() => {
            const isCompleted = trackingOrder.deliveryStatus === 'delivered' || trackingOrder.orderStatus === 'completed';
            const destinationCoords = trackingOrder.deliveryLocation?.coordinates && trackingOrder.deliveryLocation.coordinates.length === 2
              ? {
                  lat: trackingOrder.deliveryLocation.coordinates[1],
                  lng: trackingOrder.deliveryLocation.coordinates[0],
                  formattedAddress: trackingOrder.deliveryLocation.formattedAddress || trackingOrder.deliveryLocation.address,
                }
              : null;

            return (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{isCompleted ? '🎉' : '🛵'}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white">
                            {isCompleted ? 'Delivery Completed:' : 'Live Tracking:'} Order #{trackingOrder._id?.slice(-6)?.toUpperCase()}
                          </h3>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border ${
                              isCompleted
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                : 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                            }`}
                          >
                            {isCompleted ? 'DELIVERED' : (trackingOrder.deliveryStatus || 'pending').replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Rider: {trackingOrder.assignedRiderName || 'Unassigned'} • Customer: {trackingOrder.customerName || trackingOrder.customerEmail}
                          {isCompleted && trackingOrder.deliveredAt && (
                            <span className="text-emerald-400 font-semibold ml-2">
                              • Delivered at {new Date(trackingOrder.deliveredAt).toLocaleTimeString()}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setTrackingOrder(null);
                        setModalRiderLoc(null);
                      }}
                      className="text-slate-400 hover:text-white text-base p-1"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Telemetry Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Customer</span>
                      <span className="font-semibold text-white truncate block">
                        {trackingOrder.customerName || trackingOrder.customerEmail}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Delivery Status</span>
                      <span
                        className={`font-bold uppercase ${
                          isCompleted ? 'text-emerald-400' : 'text-orange-400'
                        }`}
                      >
                        {(trackingOrder.deliveryStatus || 'unassigned').replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">
                        {isCompleted ? 'Final Location' : 'Live GPS Telemetry'}
                      </span>
                      <span className="font-mono text-emerald-400 font-bold truncate block">
                        {modalRiderLoc
                          ? `${modalRiderLoc.lat.toFixed(4)}, ${modalRiderLoc.lng.toFixed(4)}`
                          : 'Awaiting updates...'}
                      </span>
                    </div>
                  </div>

                  {/* Google Map */}
                  <AdminLiveTrackingMap
                    destination={destinationCoords}
                    riderLocation={modalRiderLoc}
                    riderName={trackingOrder.assignedRiderName || 'Assigned Rider'}
                    deliveryStatus={trackingOrder.deliveryStatus || 'pending'}
                    isCompleted={isCompleted}
                  />

                  <div className="flex justify-between items-center pt-2">
                    <p className="text-[11px] text-slate-400">
                      {isCompleted
                        ? 'Delivery completed. Live GPS updates have halted for this order.'
                        : 'Real-time GPS telemetry updates stream continuously from the assigned rider.'}
                    </p>
                    <button
                      onClick={() => {
                        setTrackingOrder(null);
                        setModalRiderLoc(null);
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2 rounded-xl transition"
                    >
                      Close Monitor
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </main>
      </div>
    </div>
  );
}
