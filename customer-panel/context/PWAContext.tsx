'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAContextType {
  isOnline: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  isUpdateAvailable: boolean;
  isPromptDismissed: boolean;
  promptInstall: () => Promise<boolean>;
  dismissInstallPrompt: () => void;
  updateServiceWorker: () => void;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

const DISMISSED_STORAGE_KEY = 'experto_pwa_install_dismissed';

export const PWAProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState<boolean>(false);
  const [isPromptDismissed, setIsPromptDismissed] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  // 1. Online / Offline state tracking
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      console.log('[PWA] Network status: Online');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log('[PWA] Network status: Offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Detect Standalone / Installed PWA mode & dismissal state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check display-mode: standalone (Chrome/Android/Desktop)
    const isStandaloneDisplay = window.matchMedia('(display-mode: standalone)').matches;
    // Check iOS standalone
    const isIosStandalone = (window.navigator as any).standalone === true;

    const installed = isStandaloneDisplay || isIosStandalone;
    setIsInstalled(installed);

    // Check local dismissal
    const dismissedAt = localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (dismissedAt) {
      const parsedTime = parseInt(dismissedAt, 10);
      // Re-enable install prompt after 7 days if previously dismissed
      if (Date.now() - parsedTime < 7 * 24 * 60 * 60 * 1000) {
        setIsPromptDismissed(true);
      } else {
        localStorage.removeItem(DISMISSED_STORAGE_KEY);
      }
    }
  }, []);

  // 3. Service Worker Registration & Update Detection
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // Purge outdated or legacy caches to prevent stale chunk mismatch
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          if (name !== 'experto-store-pwa-v2') {
            console.log('[PWA] Purging outdated cache:', name);
            caches.delete(name);
          }
        }
      });
    }

    // Register service worker with direct network check for SW updates
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        console.log('[PWA] Service Worker registered successfully (Scope:', registration.scope, ')');

        // Check if a service worker is already waiting to activate
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setIsUpdateAvailable(true);
        }

        // Listen for new service worker installation updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New service worker version is available.');
              setWaitingWorker(newWorker);
              setIsUpdateAvailable(true);
            }
          });
        });
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });

    // Listen for controller changes (when new SW takes over)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  // 4. Capture `beforeinstallprompt` event
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent automatic browser mini-infobar prompt
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      console.log('[PWA] beforeinstallprompt event captured');
      setDeferredPrompt(promptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      console.log('[PWA] Application was successfully installed');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Trigger browser install prompt
  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      console.warn('[PWA] Install prompt is not available');
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      console.log('[PWA] User install choice:', choiceResult.outcome);

      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      } else {
        dismissInstallPrompt();
        return false;
      }
    } catch (err) {
      console.error('[PWA] Error during promptInstall:', err);
      return false;
    }
  }, [deferredPrompt]);

  // Dismiss prompt locally
  const dismissInstallPrompt = useCallback(() => {
    setIsPromptDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(DISMISSED_STORAGE_KEY, Date.now().toString());
    }
  }, []);

  // Activate waiting service worker and reload
  const updateServiceWorker = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [waitingWorker]);

  return (
    <PWAContext.Provider
      value={{
        isOnline,
        isInstallable: isInstallable && !isInstalled && !isPromptDismissed,
        isInstalled,
        isUpdateAvailable,
        isPromptDismissed,
        promptInstall,
        dismissInstallPrompt,
        updateServiceWorker,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
};

export const usePWA = () => {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
};
