'use client';

import React, { useState, useEffect } from 'react';
import { useSocket } from '@/context/SocketContext';
import { usePWA } from '@/context/PWAContext';

interface ConnectionStatusProps {
  className?: string;
  compact?: boolean;
}

export default function ConnectionStatus({ className = '', compact = false }: ConnectionStatusProps) {
  const { isConnected } = useSocket();
  const { isOnline } = usePWA();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // SSR / initial client deterministic fallback
  if (!mounted) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-900/60 border border-gray-800 text-xs text-gray-400 ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" />
        <span className="text-[11px] font-medium">Connecting...</span>
      </div>
    );
  }

  // If client device is offline
  if (!isOnline) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-950/60 border border-rose-500/30 text-xs text-rose-300 ${className}`}
        title="Device is offline. Safe cached catalog is available."
      >
        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
        <span className="text-[11px] font-semibold">{compact ? 'Offline' : 'Offline (Cached Mode)'}</span>
      </div>
    );
  }

  // Online & Socket status
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-200 ${
        isConnected
          ? 'bg-emerald-950/50 border border-emerald-500/30 text-emerald-400'
          : 'bg-amber-950/50 border border-amber-500/30 text-amber-300'
      } ${className}`}
      title={isConnected ? 'Real-time telemetry and order sync connected' : 'Connecting to live updates...'}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
        }`}
      />
      <span className="text-[11px] font-semibold">
        {isConnected ? 'Live Sync' : 'Reconnecting...'}
      </span>
    </div>
  );
}
