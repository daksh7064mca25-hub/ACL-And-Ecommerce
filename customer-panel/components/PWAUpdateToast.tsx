'use client';

import React, { useState } from 'react';
import { usePWA } from '@/context/PWAContext';

export default function PWAUpdateToast() {
  const { isUpdateAvailable, updateServiceWorker } = usePWA();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!isUpdateAvailable || isDismissed) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 sm:right-6 z-50 max-w-sm w-full animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="bg-gradient-to-r from-gray-900 via-gray-900 to-indigo-950 border border-indigo-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-lg text-indigo-300 flex-shrink-0">
            ⚡
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">New Version Available</h4>
            <p className="text-[11px] text-gray-300 mt-0.5">An updated version of the store is ready.</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={updateServiceWorker}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-md transition"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="text-gray-400 hover:text-white text-xs p-1"
            aria-label="Dismiss update alert"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
