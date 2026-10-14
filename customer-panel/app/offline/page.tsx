'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    setIsRetrying(true);
    if (navigator.onLine) {
      window.location.href = '/';
    } else {
      setTimeout(() => {
        setIsRetrying(false);
      }, 1000);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center space-y-6 bg-gray-900/60 border border-gray-800 backdrop-blur-xl p-8 rounded-3xl shadow-2xl">
        {/* Visual Icon */}
        <div className="relative mx-auto w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30 flex items-center justify-center text-4xl shadow-xl shadow-indigo-500/10">
          <span>📡</span>
          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-gray-950 flex items-center justify-center text-[10px] text-white font-bold">
            !
          </span>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-950/60 text-red-400 border border-red-500/30">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
            <span>Offline Mode Active</span>
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight">
            You Are Offline
          </h1>

          <p className="text-xs text-gray-400 leading-relaxed max-w-sm mx-auto">
            It looks like your device lost its internet connection. Live ordering, Stripe checkout, and real-time GPS delivery tracking will resume as soon as you reconnect.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 hover:from-indigo-500 hover:to-pink-400 text-white font-bold text-xs py-3.5 px-6 rounded-2xl shadow-lg shadow-indigo-600/30 transition transform active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isRetrying ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Checking Connectivity...</span>
              </>
            ) : (
              <>
                <span>🔄</span>
                <span>Try Reconnecting</span>
              </>
            )}
          </button>

          <Link
            href="/products"
            className="inline-block w-full bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 font-semibold text-xs py-3 px-6 rounded-2xl border border-gray-700 transition"
          >
            Browse Cached Catalog
          </Link>
        </div>

        {/* Helper Footer */}
        <div className="pt-4 border-t border-gray-800/80 text-[11px] text-gray-500">
          <p>Cached static app shell is active • Powered by Progressive Web App</p>
        </div>
      </div>
    </div>
  );
}
