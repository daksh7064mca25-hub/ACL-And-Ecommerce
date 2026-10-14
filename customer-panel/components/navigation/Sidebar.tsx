'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useDeliveryLocation } from '@/context/DeliveryLocationContext';
import ConnectionStatus from './ConnectionStatus';

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className = '' }: SidebarProps) {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const { location, isDeliverable, deliveryZone, deliveryFee, openLocationModal } = useDeliveryLocation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navLinks = [
    { name: 'Home', href: '/', icon: '🏠' },
    { name: 'Products', href: '/products', icon: '🛍️' },
    { name: 'Nearby Stores', href: '/nearby', icon: '📍' },
    ...(mounted && isAuthenticated ? [{ name: 'My Orders', href: '/orders', icon: '📦' }] : []),
  ];

  return (
    <aside
      className={`hidden md:flex flex-col w-64 shrink-0 sticky top-22 h-[calc(100vh-6.5rem)] rounded-3xl border border-gray-800/80 bg-gray-900/40 backdrop-blur-md p-4 justify-between overflow-y-auto select-none shadow-xl ${className}`}
      aria-label="Desktop Sidebar Navigation"
    >
      <div className="space-y-6">
        {/* Section 1: Main Navigation */}
        <div>
          <p className="px-3 text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
            Main Menu
          </p>
          <nav className="space-y-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all duration-150 group ${
                    isActive
                      ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm shadow-indigo-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-gray-900/80'
                  }`}
                >
                  <span className="text-base group-hover:scale-110 transition-transform">{link.icon}</span>
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Section 2: Delivery Location Card */}
        <div className="pt-2 border-t border-gray-900">
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Delivery Zone
            </p>
            <button
              type="button"
              onClick={openLocationModal}
              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
            >
              Change 📍
            </button>
          </div>

          <button
            type="button"
            onClick={openLocationModal}
            className="w-full text-left p-3 rounded-2xl bg-gray-900/60 hover:bg-gray-900 border border-gray-800/80 hover:border-indigo-500/40 transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-2.5">
              <span
                className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                  mounted && isDeliverable ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
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

        {/* Section 3: System Status */}
        <div className="pt-2 border-t border-gray-900">
          <p className="px-3 text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
            System Status
          </p>
          <ConnectionStatus />
        </div>
      </div>

      {/* Section 4: Customer Account Card (Bottom) */}
      <div className="pt-4 border-t border-gray-900">
        {mounted && isAuthenticated ? (
          <div className="p-3 rounded-2xl bg-gray-900/80 border border-gray-800/80 space-y-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0">
                {user?.name ? user.name[0].toUpperCase() : user?.email ? user.email[0].toUpperCase() : 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{user?.name || 'Customer'}</p>
                <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="w-full py-1.5 px-3 rounded-xl bg-gray-800/60 hover:bg-rose-500/10 text-gray-400 hover:text-rose-300 text-xs font-semibold border border-gray-800 hover:border-rose-500/30 transition-all cursor-pointer"
            >
              Sign Out 🚪
            </button>
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-gray-900/60 border border-gray-800 text-center space-y-2">
            <p className="text-xs font-semibold text-gray-300">Welcome to Experto Store</p>
            <div className="flex items-center gap-1.5">
              <Link
                href="/login"
                className="flex-1 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="flex-1 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
              >
                Register
              </Link>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
