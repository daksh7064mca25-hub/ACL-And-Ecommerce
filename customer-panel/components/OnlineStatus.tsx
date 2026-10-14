'use client';

import React from 'react';
import { usePWA } from '@/context/PWAContext';

interface OnlineStatusProps {
  className?: string;
  showText?: boolean;
}

export default function OnlineStatus({ className = '', showText = true }: OnlineStatusProps) {
  const { isOnline } = usePWA();

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-300 ${
        isOnline
          ? 'bg-emerald-950/70 border-emerald-500/30 text-emerald-400 shadow-sm'
          : 'bg-red-950/90 border-red-500/50 text-red-300 shadow-lg shadow-red-950/50 animate-pulse'
      } ${className}`}
      title={isOnline ? 'Internet connection active' : 'Device is offline. Safe cached catalog is available.'}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          isOnline ? 'bg-emerald-400' : 'bg-red-400'
        }`}
      />
      {showText && (
        <span className="text-[11px] font-medium tracking-tight">
          {isOnline ? 'Online' : 'Offline'}
        </span>
      )}
    </div>
  );
}
