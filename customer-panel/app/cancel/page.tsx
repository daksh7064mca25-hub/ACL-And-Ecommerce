'use client';

import React from 'react';
import Link from 'next/link';

export default function CancelPage() {
  return (
    <div className="max-w-xl mx-auto py-20 px-4 text-center space-y-6 animate-in fade-in pb-16">
      <div className="w-20 h-20 rounded-3xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto shadow-2xl shadow-amber-500/15 text-3xl">
        ✕
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-black text-white tracking-tight">Checkout Cancelled</h1>
        <p className="text-xs sm:text-sm text-gray-400 leading-relaxed max-w-md mx-auto">
          Your payment was not completed and your card was not charged. Don&apos;t worry—your cart items are safely preserved!
        </p>
      </div>

      <div className="p-5 rounded-3xl bg-gray-900/60 border border-gray-800 text-xs text-gray-400 space-y-2 max-w-md mx-auto shadow-xl">
        <p className="font-bold text-gray-200">Need help completing your order?</p>
        <p className="leading-relaxed">If you experienced any card or network issues on Stripe, you can retry whenever you are ready.</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
        <Link
          href="/cart"
          className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-xl shadow-indigo-600/25 transition-all active:scale-95"
        >
          Return to Cart & Retry
        </Link>
        <Link
          href="/products"
          className="px-6 py-3.5 rounded-2xl bg-gray-900 hover:bg-gray-800 text-gray-200 font-bold text-xs border border-gray-800 hover:border-gray-700 transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
