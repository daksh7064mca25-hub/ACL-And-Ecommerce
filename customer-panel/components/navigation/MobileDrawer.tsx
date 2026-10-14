'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useDeliveryLocation } from '@/context/DeliveryLocationContext';
import { usePWA } from '@/context/PWAContext';
import SearchBar from './SearchBar';
import ConnectionStatus from './ConnectionStatus';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const { totalItems } = useCart();
  const { location, isDeliverable, deliveryZone, deliveryFee, openLocationModal } = useDeliveryLocation();
  const { isInstallable, promptInstall } = usePWA();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close drawer on route change
  useEffect(() => {
    onClose();
  }, [pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const navLinks = [
    { name: 'Home', href: '/', icon: '🏠' },
    { name: 'Products Catalog', href: '/products', icon: '🛍️' },
    { name: 'Nearby Stores', href: '/nearby', icon: '📍' },
    ...(mounted && isAuthenticated ? [{ name: 'My Orders & Tracking', href: '/orders', icon: '📦' }] : []),
    { name: 'Shopping Cart', href: '/cart', icon: '🛒', count: totalItems },
  ];

  return (
    <div className="fixed inset-0 z-50 md:hidden animate-in fade-in duration-200">
      {/* Dark Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Slide-in Navigation Panel */}
      <div className="fixed inset-y-0 left-0 w-[85%] max-w-xs bg-gray-950 border-r border-gray-800 shadow-2xl flex flex-col justify-between p-5 overflow-y-auto animate-in slide-in-from-left duration-300">
        <div className="space-y-6">
          {/* Header with Logo and Close button */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-800">
            <Link href="/" onClick={onClose} className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white text-base shadow-sm">
                🛍️
              </div>
              <span className="text-lg font-bold text-white tracking-tight">
                Experto<span className="text-indigo-400">Store</span>
              </span>
            </Link>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white transition-colors"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search Bar */}
          <div>
            <SearchBar onSearchSubmit={onClose} />
          </div>

          {/* Navigation Links */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2 px-1">
              Menu
            </p>
            <nav className="space-y-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={onClose}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                        : 'text-gray-300 hover:text-white hover:bg-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base">{link.icon}</span>
                      <span>{link.name}</span>
                    </div>

                    {link.count && link.count > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-pink-500 text-white text-[10px] font-bold">
                        {link.count}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Delivery Location Widget */}
          <div className="pt-2 border-t border-gray-900">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Delivering to
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openLocationModal();
                }}
                className="text-[10px] font-bold text-indigo-400"
              >
                Change 📍
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                openLocationModal();
              }}
              className="w-full text-left p-3 rounded-2xl bg-gray-900 border border-gray-800 text-xs"
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                    mounted && isDeliverable ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white truncate">
                    {mounted
                      ? location?.city || location?.address?.split(',')[0] || 'Select Location'
                      : 'Select Location'}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {mounted && isDeliverable && deliveryZone ? (
                      <span className="text-emerald-400 font-semibold">
                        {deliveryZone.code} • ₹{deliveryFee} fee
                      </span>
                    ) : (
                      <span className="text-rose-400 font-semibold">Out of Zone</span>
                    )}
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* PWA Install Button (Mobile) */}
          {mounted && isInstallable && (
            <button
              type="button"
              onClick={() => {
                onClose();
                promptInstall();
              }}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xs shadow-md"
            >
              <div className="flex items-center gap-2">
                <span>📲</span>
                <span>Install Native App</span>
              </div>
              <span className="text-[10px] uppercase bg-white/20 px-2 py-0.5 rounded-full font-bold">
                PWA
              </span>
            </button>
          )}

          {/* System Status */}
          <div className="pt-2 border-t border-gray-900">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2 px-1">
              System Status
            </p>
            <ConnectionStatus />
          </div>
        </div>

        {/* Customer Account Section (Bottom) */}
        <div className="pt-4 border-t border-gray-800">
          {mounted && isAuthenticated ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 px-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                  {user?.name ? user.name[0].toUpperCase() : user?.email ? user.email[0].toUpperCase() : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{user?.name || 'Customer'}</p>
                  <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  logout();
                }}
                className="w-full py-2 px-3 rounded-xl bg-gray-900 hover:bg-rose-500/10 text-rose-400 text-xs font-bold border border-gray-800 transition-colors"
              >
                Sign Out 🚪
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <Link
                href="/login"
                onClick={onClose}
                className="w-full block text-center py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold border border-gray-800 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                onClick={onClose}
                className="w-full block text-center py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-colors"
              >
                Create Account
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
