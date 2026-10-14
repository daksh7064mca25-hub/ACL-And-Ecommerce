import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-950 border-t border-gray-800/80 text-gray-400 py-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Col */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <span className="text-xl font-black text-white tracking-tight">
                Experto<span className="text-indigo-400">Store</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              Curated premium hardware, peripherals, and electronics delivered with real-time GPS tracking and secure Stripe payments.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-wider mb-4">Shop & Discover</h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <Link href="/products" className="hover:text-indigo-400 transition-colors">All Products</Link>
              </li>
              <li>
                <Link href="/products?inStock=true" className="hover:text-indigo-400 transition-colors">In Stock Items</Link>
              </li>
              <li>
                <Link href="/nearby" className="hover:text-indigo-400 transition-colors">Nearby Store Discovery</Link>
              </li>
              <li>
                <Link href="/cart" className="hover:text-indigo-400 transition-colors">Shopping Cart</Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-wider mb-4">Customer Support</h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <Link href="/orders" className="hover:text-indigo-400 transition-colors">My Orders & Tracking</Link>
              </li>
              <li>
                <span className="text-gray-400">⚡ Hyperlocal Zone Express Delivery</span>
              </li>
              <li>
                <span className="text-gray-400">↩ 30-Day Hassle-free Returns</span>
              </li>
            </ul>
          </div>

          {/* Payment & Security */}
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-wider mb-4">Guaranteed Safe Checkout</h4>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              All transactions are encrypted and processed securely via Stripe.
            </p>
            <div className="flex items-center space-x-2">
              <div className="px-2.5 py-1 rounded-xl bg-gray-900 border border-gray-800 text-[11px] font-bold text-gray-300">
                STRIPE
              </div>
              <div className="px-2.5 py-1 rounded-xl bg-gray-900 border border-gray-800 text-[11px] font-bold text-gray-300">
                VISA / MC
              </div>
              <div className="px-2.5 py-1 rounded-xl bg-gray-900 border border-gray-800 text-[11px] font-bold text-gray-300">
                SSL 256-BIT
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-900 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2">
          <p>© {new Date().getFullYear()} Experto Visuals Store Inc. All rights reserved.</p>
          <p className="flex items-center space-x-4 font-medium">
            <span>Powered by Next.js App Router & Socket.IO</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
