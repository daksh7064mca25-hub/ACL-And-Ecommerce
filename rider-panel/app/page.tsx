'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { getAssignedDeliveries, updateDeliveryStatus, RiderDeliveryItem } from '@/lib/api';
import { useRiderLocation } from '@/hooks/useRiderLocation';

export default function RiderDashboardPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, logout } = useAuth();
  const { socket, isConnected, onDeliveryAssigned } = useSocket();

  const [deliveries, setDeliveries] = useState<RiderDeliveryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Active delivery that is currently in progress
  const activeDelivery = deliveries.find((d) =>
    ['assigned', 'accepted', 'picked_up', 'on_the_way'].includes(d.deliveryStatus)
  );

  const isTrackingActive = activeDelivery?.deliveryStatus === 'on_the_way';

  // GPS Tracking Hook
  const { gpsState, toggleSimulation } = useRiderLocation({
    activeOrderId: activeDelivery?._id || null,
    isTrackingActive,
    socket,
  });

  const loadDeliveries = useCallback(async () => {
    try {
      setIsLoading(true);
      if (!token) {
        router.replace('/login');
        return;
      }
      const res = await getAssignedDeliveries(token);
      if (res.success && res.deliveries) {
        setDeliveries(res.deliveries);
      }
    } catch (err) {
      console.error('[RiderDashboard] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    loadDeliveries();
  }, [isAuthenticated, loadDeliveries, router]);

  // Listen for real-time delivery assignments
  useEffect(() => {
    const unsub = onDeliveryAssigned(() => {
      loadDeliveries();
    });
    return () => {
      unsub();
    };
  }, [onDeliveryAssigned, loadDeliveries]);

  const handleStatusTransition = async (orderId: string, nextStatus: string) => {
    try {
      setActionLoading(orderId);
      const res = await updateDeliveryStatus(orderId, nextStatus, token || undefined);
      if (res.success && res.delivery) {
        setDeliveries((prev) =>
          prev.map((d) => (d._id === orderId ? { ...d, deliveryStatus: res.delivery.deliveryStatus } : d))
        );
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update delivery status');
    } finally {
      setActionLoading(null);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#070b14] text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-gray-800/80 bg-gray-950/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-lg shadow-md shadow-orange-500/20">
            🛵
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-white leading-tight">Rider Partner Console</h1>
            <p className="text-[11px] text-gray-400">{user?.name || 'Delivery Specialist'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live Socket Status */}
          <div className="flex items-center gap-2 bg-gray-900 px-3 py-1 rounded-full border border-gray-800 text-xs">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            <span className="text-gray-300 text-[11px] font-medium">{isConnected ? 'Online' : 'Connecting...'}</span>
          </div>

          <button
            onClick={logout}
            className="text-xs bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white px-3 py-1.5 rounded-xl border border-gray-800 transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Active Delivery Highlight Banner */}
        {activeDelivery ? (
          <div className="bg-gradient-to-b from-gray-900 to-gray-950 border-2 border-orange-500/40 rounded-3xl p-6 shadow-2xl shadow-orange-500/10 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-800">
              <div>
                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest block mb-0.5">Active Assignment</span>
                <h2 className="text-xl font-extrabold text-white">Order #{activeDelivery._id.slice(-6).toUpperCase()}</h2>
              </div>
              <span className="bg-orange-500/20 text-orange-400 border border-orange-500/40 text-xs font-black uppercase px-3 py-1 rounded-full">
                {activeDelivery.deliveryStatus.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Customer & Destination Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-gray-950/80 p-4 rounded-2xl border border-gray-800/80 space-y-1">
                <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider block">Customer Information</span>
                <p className="font-bold text-white text-sm">{activeDelivery.customerName || activeDelivery.customerEmail}</p>
                <p className="text-gray-400">{activeDelivery.customerEmail}</p>
              </div>

              <div className="bg-gray-950/80 p-4 rounded-2xl border border-gray-800/80 space-y-1">
                <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider block">Delivery Destination</span>
                <p className="font-semibold text-gray-200">
                  {activeDelivery.deliveryLocation?.formattedAddress ||
                    activeDelivery.shippingAddress?.line1 ||
                    'Sector 17, Chandigarh'}
                </p>
              </div>
            </div>

            {/* Order Items */}
            <div className="bg-gray-950/60 p-4 rounded-2xl border border-gray-800/80">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Package Items</span>
              <div className="space-y-1.5">
                {activeDelivery.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-gray-300">
                    <span>{item.quantity}x {item.title}</span>
                    <span className="font-bold text-white">₹{item.priceAtPurchase * item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* LIVE GPS TELEMETRY PANEL (Shown when on_the_way) */}
            {isTrackingActive && (
              <div className="bg-orange-950/30 border border-orange-500/40 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-orange-300">
                      Live GPS Telemetry Stream Active
                    </h3>
                  </div>

                  {/* Simulation Toggle Button for Desktop Demo Testing */}
                  <button
                    onClick={toggleSimulation}
                    className={`text-[11px] font-bold px-3 py-1 rounded-xl border transition ${
                      gpsState.isSimulating
                        ? 'bg-orange-500 text-white border-orange-400'
                        : 'bg-gray-900 text-gray-300 border-gray-700 hover:bg-gray-800'
                    }`}
                  >
                    {gpsState.isSimulating ? '🚗 Simulation Active' : '⚙️ Simulate GPS Route'}
                  </button>
                </div>

                {gpsState.error && (
                  <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-xs text-red-200">
                    ⚠️ {gpsState.error}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                    <span className="text-gray-500 text-[10px] font-sans block">Latitude</span>
                    <span className="font-bold text-orange-400">
                      {gpsState.latitude ? gpsState.latitude.toFixed(5) : 'Acquiring...'}
                    </span>
                  </div>

                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                    <span className="text-gray-500 text-[10px] font-sans block">Longitude</span>
                    <span className="font-bold text-orange-400">
                      {gpsState.longitude ? gpsState.longitude.toFixed(5) : 'Acquiring...'}
                    </span>
                  </div>

                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                    <span className="text-gray-500 text-[10px] font-sans block">Accuracy</span>
                    <span className="font-bold text-emerald-400">
                      {gpsState.accuracy ? `±${gpsState.accuracy.toFixed(1)}m` : 'High (GPS)'}
                    </span>
                  </div>

                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                    <span className="text-gray-500 text-[10px] font-sans block">Updates Emitted</span>
                    <span className="font-bold text-white">{gpsState.emitCount} pings</span>
                  </div>
                </div>

                <p className="text-[11px] text-gray-400">
                  GPS coordinates are throttled to every 3.5 seconds and transmitted securely via Socket.IO directly to the customer tracking map.
                </p>
              </div>
            )}

            {/* ACTION BUTTONS BASED ON STATE MACHINE */}
            <div className="pt-2">
              {activeDelivery.deliveryStatus === 'assigned' && (
                <button
                  disabled={actionLoading === activeDelivery._id}
                  onClick={() => handleStatusTransition(activeDelivery._id, 'accepted')}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm py-4 rounded-2xl shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2"
                >
                  <span>✓</span>
                  <span>Accept Delivery</span>
                </button>
              )}

              {activeDelivery.deliveryStatus === 'accepted' && (
                <button
                  disabled={actionLoading === activeDelivery._id}
                  onClick={() => handleStatusTransition(activeDelivery._id, 'picked_up')}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-sm py-4 rounded-2xl shadow-lg shadow-amber-600/30 transition flex items-center justify-center gap-2"
                >
                  <span>📦</span>
                  <span>Confirm Pickup from Store</span>
                </button>
              )}

              {activeDelivery.deliveryStatus === 'picked_up' && (
                <button
                  disabled={actionLoading === activeDelivery._id}
                  onClick={() => handleStatusTransition(activeDelivery._id, 'on_the_way')}
                  className="w-full bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-extrabold text-sm py-4 rounded-2xl shadow-lg shadow-orange-500/30 transition flex items-center justify-center gap-2"
                >
                  <span>🚀</span>
                  <span>Start Delivery & Stream Live GPS</span>
                </button>
              )}

              {activeDelivery.deliveryStatus === 'on_the_way' && (
                <button
                  disabled={actionLoading === activeDelivery._id}
                  onClick={() => handleStatusTransition(activeDelivery._id, 'delivered')}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm py-4 rounded-2xl shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
                >
                  <span>🎉</span>
                  <span>Mark Order as Delivered</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-10 text-center space-y-3">
            <div className="text-4xl">🛵</div>
            <h3 className="text-base font-bold text-white">No Active Deliveries</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              You are currently online. When an admin assigns an order to you, it will appear here in real-time.
            </p>
          </div>
        )}

        {/* Deliveries History List */}
        <div className="space-y-3 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">All Assigned Deliveries</h3>
          {deliveries.length === 0 ? (
            <p className="text-xs text-gray-500 italic">No assigned deliveries yet.</p>
          ) : (
            <div className="space-y-3">
              {deliveries.map((delivery) => (
                <div
                  key={delivery._id}
                  className="bg-gray-900/40 border border-gray-800/80 rounded-2xl p-4 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white">Order #{delivery._id.slice(-6).toUpperCase()}</span>
                      <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full uppercase">
                        {delivery.deliveryStatus}
                      </span>
                    </div>
                    <p className="text-gray-400 text-[11px]">
                      {delivery.customerName || delivery.customerEmail} • ₹{delivery.totalAmount}
                    </p>
                  </div>

                  <span className="text-[11px] text-gray-500">
                    {new Date(delivery.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
