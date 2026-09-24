'use client';

import React from 'react';
import Link from 'next/link';
import CartItem from '@/components/CartItem';
import CartSummary from '@/components/CartSummary';
import { useCart } from '@/context/CartContext';

export default function CartPage() {
  const { items, clearCart, isMounted } = useCart();

  if (!isMounted) {
    return (
      <div className="py-16 space-y-6 animate-pulse max-w-4xl mx-auto">
        <div className="h-8 bg-gray-800 rounded w-48" />
        <div className="h-32 bg-gray-900 rounded-2xl" />
        <div className="h-32 bg-gray-900 rounded-2xl" />
      </div>
    );
  }

  const isCartEmpty = items.length === 0;

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div className="flex items-center justify-between pb-6 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Shopping Cart</h1>
          <p className="text-sm text-gray-400 mt-1">
            Review your selected items and proceed to secure checkout.
          </p>
        </div>

        {!isCartEmpty && (
          <button
            type="button"
            onClick={clearCart}
            className="text-xs font-semibold text-gray-400 hover:text-red-400 transition-colors flex items-center space-x-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Clear Cart</span>
          </button>
        )}
      </div>

      {isCartEmpty ? (
        /* Empty Cart State */
        <div className="py-20 text-center rounded-3xl bg-gray-900/40 border border-gray-800 p-8 space-y-5 max-w-2xl mx-auto">
          <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20 shadow-inner">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">Your Cart is Currently Empty</h3>
            <p className="text-xs sm:text-sm text-gray-400 max-w-md mx-auto">
              Looks like you haven&apos;t added any products to your cart yet. Check out our latest products!
            </p>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center space-x-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
          >
            <span>Start Shopping</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      ) : (
        /* Cart Grid */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Cart Items List */}
          <div className="lg:col-span-2 bg-gray-900/40 border border-gray-800/80 rounded-2xl p-6 divide-y divide-gray-800/60 shadow-xl">
            {items.map((item) => (
              <CartItem key={item.product._id} item={item} />
            ))}

            <div className="pt-6 flex justify-between items-center text-xs">
              <Link
                href="/products"
                className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Continue Shopping</span>
              </Link>
              <span className="text-gray-500">Prices locked at checkout time</span>
            </div>
          </div>

          {/* Cart Summary Card */}
          <div className="lg:col-span-1">
            <CartSummary showCheckoutButton={true} />
          </div>
        </div>
      )}
    </div>
  );
}
