import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-950 border-t border-gray-800/80 text-gray-400 py-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Col */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-pink-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-white tracking-tight">
                Nova<span className="text-indigo-400">Store</span>
              </span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Curated premium gear, peripherals, and electronics delivered with lightning-fast fulfillment and secure Stripe payments.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Shop</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/products" className="hover:text-indigo-400 transition-colors">All Products</Link>
              </li>
              <li>
                <Link href="/products?inStock=true" className="hover:text-indigo-400 transition-colors">In Stock Items</Link>
              </li>
              <li>
                <Link href="/cart" className="hover:text-indigo-400 transition-colors">Shopping Cart</Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Customer Support</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/orders" className="hover:text-indigo-400 transition-colors">Track Order</Link>
              </li>
              <li>
                <span className="text-gray-400">Fast 2-4 Days Shipping</span>
              </li>
              <li>
                <span className="text-gray-400">30-Day Money Back Guarantee</span>
              </li>
            </ul>
          </div>

          {/* Payment & Security */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Guaranteed Safe Checkout</h4>
            <p className="text-xs text-gray-400 mb-3">
              All transactions are encrypted and processed securely via Stripe.
            </p>
            <div className="flex items-center space-x-2">
              <div className="px-2.5 py-1 rounded bg-gray-900 border border-gray-800 text-xs font-semibold text-gray-300">
                STRIPE
              </div>
              <div className="px-2.5 py-1 rounded bg-gray-900 border border-gray-800 text-xs font-semibold text-gray-300">
                VISA / MC
              </div>
              <div className="px-2.5 py-1 rounded bg-gray-900 border border-gray-800 text-xs font-semibold text-gray-300">
                SSL 256-BIT
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-900 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500">
          <p>© {new Date().getFullYear()} NovaStore Inc. All rights reserved.</p>
          <p className="mt-2 sm:mt-0 flex items-center space-x-4">
            <span>Powered by Next.js & Stripe</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
