'use client';

import React, { useState, useEffect } from 'react';
import { useDeliveryLocation } from '@/context/DeliveryLocationContext';

interface DeliveryLocationCardProps {
  className?: string;
  compact?: boolean;
}

export default function DeliveryLocationCard({ className = '', compact = false }: DeliveryLocationCardProps) {
  const {
    location,
    isDeliverable,
    deliveryZone,
    deliveryFee,
    estimatedDeliveryTime,
    openLocationModal,
  } = useDeliveryLocation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className={`p-4 sm:p-5 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl transition-all ${
        mounted && isDeliverable
          ? 'bg-gradient-to-r from-emerald-950/30 via-gray-900 to-indigo-950/20 border-emerald-500/30'
          : 'bg-gradient-to-r from-rose-950/30 via-gray-900 to-amber-950/20 border-rose-500/30'
      } ${className}`}
    >
      <div className="flex items-center space-x-3.5">
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg flex-shrink-0 ${
            mounted && isDeliverable
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
          }`}
        >
          {mounted && isDeliverable ? '⚡' : '📍'}
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs sm:text-sm font-bold text-white">
              {mounted && isDeliverable
                ? `Delivering to ${deliveryZone?.name || location?.city || 'Your Area'}`
                : 'Address Outside Delivery Range'}
            </span>
            {mounted && isDeliverable && deliveryZone && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {deliveryZone.code}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xl">
            {mounted && location?.address ? (
              <span>📍 {location.address}</span>
            ) : (
              'Sector 17, City Centre, Chandigarh'
            )}
            {mounted && isDeliverable && deliveryZone && (
              <span className="ml-2 text-indigo-300 font-semibold">
                • ₹{deliveryFee} Delivery • ~{estimatedDeliveryTime}
              </span>
            )}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={openLocationModal}
        className="self-start sm:self-auto px-4 py-2 rounded-xl bg-gray-800/90 hover:bg-gray-700 text-xs font-bold text-indigo-300 hover:text-white border border-gray-700/80 transition-all shadow-sm cursor-pointer whitespace-nowrap"
      >
        Change Location 📍
      </button>
    </div>
  );
}
