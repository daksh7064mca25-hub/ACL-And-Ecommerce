'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { usePWA } from '@/context/PWAContext';
import SearchBar from './SearchBar';
import UserMenu from './UserMenu';

interface HeaderProps {
  onToggleMobileDrawer?: () => void;
}

export default function Header({ onToggleMobileDrawer }: HeaderProps) {
  const { totalItems } = useCart();
  const { isInstallable, promptInstall } = usePWA();
  const [mounted, setMounted] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'bg-gray-950/90 backdrop-blur-xl border-b border-gray-800/80 shadow-lg shadow-black/30'
          : 'bg-gray-950/75 backdrop-blur-md border-b border-gray-800/60'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Left: Mobile Toggle & Brand Logo */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Hamburger Button (Mobile Only) */}
            <button
              type="button"
              onClick={onToggleMobileDrawer}
              className="md:hidden p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/70 focus:outline-none transition-colors"
              aria-label="Open navigation menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Brand Logo */}
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 group-hover:shadow-indigo-500/30 transition-all duration-200">
                <svg
                  className="w-5 h-5 text-white transform group-hover:-rotate-3 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.2"
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
                Experto<span className="text-indigo-400">Store</span>
              </span>
            </Link>
          </div>

          {/* Center: Desktop Search Bar */}
          <div className="hidden md:flex flex-1 max-w-xl mx-4">
            <SearchBar />
          </div>

          {/* Right: Search Toggle (Mobile), PWA Install, Cart & User Profile */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Mobile Search Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
              className="md:hidden p-2 rounded-xl text-gray-300 hover:text-white hover:bg-gray-800/60 transition-colors"
              aria-label="Toggle search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* PWA Install Button (Desktop) */}
            {mounted && isInstallable && (
              <button
                type="button"
                onClick={promptInstall}
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all transform active:scale-95 cursor-pointer"
                title="Install Experto Store as a native PWA"
              >
                <span>📲</span>
                <span>Install App</span>
              </button>
            )}

            {/* Shopping Cart Link */}
            <Link
              href="/cart"
              className="relative p-2 sm:p-2.5 rounded-xl text-gray-300 hover:text-white hover:bg-gray-800/60 transition-all border border-gray-800/90 hover:border-gray-700 group flex items-center space-x-2"
              title="View Shopping Cart"
            >
              <div className="relative">
                <svg
                  className="w-5 h-5 text-gray-200 group-hover:text-indigo-400 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>

                {mounted && totalItems > 0 && (
                  <span className="absolute -top-2.5 -right-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center shadow-md animate-bounce">
                    {totalItems > 99 ? '99+' : totalItems}
                  </span>
                )}
              </div>
              <span className="hidden sm:inline text-xs font-semibold text-gray-200">
                Cart
              </span>
            </Link>

            {/* Desktop User Menu */}
            <div className="hidden md:block">
              <UserMenu />
            </div>
          </div>
        </div>

        {/* Mobile Expandable Search Bar */}
        {isMobileSearchOpen && (
          <div className="md:hidden py-3 border-t border-gray-800/80 animate-in fade-in slide-in-from-top-2">
            <SearchBar autoFocus onSearchSubmit={() => setIsMobileSearchOpen(false)} />
          </div>
        )}
      </div>
    </header>
  );
}
