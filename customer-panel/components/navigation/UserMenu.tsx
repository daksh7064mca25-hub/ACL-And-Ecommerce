'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface UserMenuProps {
  className?: string;
}

export default function UserMenu({ className = '' }: UserMenuProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Deterministic fallback for SSR / unmounted state
  if (!mounted || !isAuthenticated) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Link
          href="/login"
          className="text-xs font-semibold text-gray-300 hover:text-white px-3 py-2 rounded-xl hover:bg-gray-800/60 transition-colors"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 rounded-xl shadow-md shadow-indigo-600/20 transition-all active:scale-95"
        >
          Register
        </Link>
      </div>
    );
  }

  const initial = user?.name ? user.name[0].toUpperCase() : user?.email ? user.email[0].toUpperCase() : 'U';
  const displayName = user?.name || user?.email?.split('@')[0] || 'Customer';

  return (
    <div ref={menuRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 pr-3 rounded-2xl border border-gray-800 hover:border-gray-700 bg-gray-900/80 hover:bg-gray-800 text-xs text-gray-200 transition-all cursor-pointer group"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white font-bold text-xs shadow-sm">
          {initial}
        </div>
        <span className="font-semibold max-w-[110px] truncate text-gray-200 group-hover:text-white">
          {displayName}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-indigo-400' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-800/90 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
          {/* User Info Header */}
          <div className="px-4 py-2.5 border-b border-gray-800/80">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-white truncate">{user?.name || 'Customer'}</p>
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                User
              </span>
            </div>
            <p className="text-[11px] text-gray-400 truncate mt-0.5">{user?.email}</p>
          </div>

          {/* Links */}
          <div className="py-1">
            <Link
              href="/orders"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <span>📦</span>
              <span>My Orders & Live Tracking</span>
            </Link>
            <Link
              href="/nearby"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <span>📍</span>
              <span>Nearby Stores Map</span>
            </Link>
          </div>

          <div className="border-t border-gray-800/80 my-1" />

          {/* Logout */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
            className="w-full text-left flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors cursor-pointer"
          >
            <span>🚪</span>
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}
