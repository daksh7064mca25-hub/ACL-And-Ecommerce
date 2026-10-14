'use client';

import React, { useState } from 'react';
import { usePWA } from '@/context/PWAContext';

export default function PWAInstallPrompt() {
  const { isInstallable, isInstalled, promptInstall, dismissInstallPrompt } = usePWA();
  const [isInstalling, setIsInstalling] = useState(false);

  if (!isInstallable || isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await promptInstall();
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-40 max-w-md w-full animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-gray-900/95 border border-indigo-500/40 rounded-3xl p-4 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-4">
        {/* App Logo & Details */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-xl shadow-lg shadow-indigo-500/30 flex-shrink-0">
            🛍️
          </div>
          <div>
            <h4 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>Install Experto Store</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full uppercase font-extrabold">
                Fast App
              </span>
            </h4>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">
              Enjoy standalone browsing, offline speed & instant order tracking.
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-md shadow-indigo-600/30 transition transform active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {isInstalling ? 'Installing...' : 'Install App'}
          </button>
          <button
            type="button"
            onClick={dismissInstallPrompt}
            className="text-gray-400 hover:text-white text-xs p-1.5 rounded-lg hover:bg-gray-800 transition"
            aria-label="Dismiss install prompt"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
