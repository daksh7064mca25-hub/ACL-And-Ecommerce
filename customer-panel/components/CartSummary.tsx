'use client';

import React from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';

interface CartSummaryProps {
  showCheckoutButton?: boolean;
  onCheckoutClick?: () => void;
  isLoading?: boolean;
}

export default function CartSummary({
  showCheckoutButton = true,
  onCheckoutClick,
  isLoading = false,
}: CartSummaryProps) {
  const { subtotal, shipping, tax, totalPrice, totalItems, items } = useCart();

  const isCartEmpty = items.length === 0;

  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 shadow-xl sticky top-24">
      <h3 className="text-lg font-bold text-white mb-5 pb-3 border-b border-gray-800">
        Order Summary
      </h3>

      <div className="space-y-3.5 text-sm">
        <div className="flex justify-between text-gray-400">
          <span>Items ({totalItems})</span>
          <span className="text-white font-medium">${subtotal.toFixed(2)}</span>
        </div>

        <div className="flex justify-between text-gray-400">
          <span>Shipping</span>
          <span className="text-white font-medium">
            {shipping === 0 ? (
              <span className="text-emerald-400 font-semibold">FREE</span>
            ) : (
              `$${shipping.toFixed(2)}`
            )}
          </span>
        </div>

        {subtotal > 0 && subtotal < 100 && (
          <p className="text-[11px] text-indigo-300 bg-indigo-950/40 p-2 rounded-lg border border-indigo-500/20">
            💡 Add ${(100 - subtotal).toFixed(2)} more for <strong>FREE Shipping</strong>!
          </p>
        )}

        <div className="flex justify-between text-gray-400">
          <span>Estimated Tax (8%)</span>
          <span className="text-white font-medium">${tax.toFixed(2)}</span>
        </div>

        <div className="pt-4 border-t border-gray-800 flex justify-between items-baseline">
          <span className="text-base font-bold text-white">Estimated Total</span>
          <span className="text-2xl font-black bg-gradient-to-r from-white via-gray-100 to-indigo-200 bg-clip-text text-transparent">
            ${totalPrice.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Checkout CTA */}
      {showCheckoutButton && (
        <div className="mt-6 space-y-3">
          {onCheckoutClick ? (
            <button
              onClick={onCheckoutClick}
              disabled={isCartEmpty || isLoading}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center space-x-2 ${
                isCartEmpty || isLoading
                  ? 'bg-gray-800 text-gray-500 border border-gray-800 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-98 shadow-indigo-500/20'
              }`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Connecting to Stripe...</span>
                </>
              ) : (
                <>
                  <span>Proceed to Checkout</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          ) : (
            <Link
              href="/checkout"
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center space-x-2 ${
                isCartEmpty
                  ? 'bg-gray-800 text-gray-500 border border-gray-800 pointer-events-none'
                  : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-98 shadow-indigo-500/20'
              }`}
            >
              <span>Proceed to Checkout</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          )}

          <div className="pt-3 flex items-center justify-center space-x-2 text-xs text-gray-500">
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Guaranteed Safe Stripe Checkout</span>
          </div>
        </div>
      )}
    </div>
  );
}
