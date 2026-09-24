'use client';

import React from 'react';
import Link from 'next/link';

export default function CancelPage() {
  return (
    <div className="max-w-xl mx-auto py-16 text-center space-y-6 animate-in fade-in">
      <div className="w-20 h-20 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto shadow-xl shadow-amber-500/10">
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-black text-white tracking-tight">Checkout Cancelled</h1>
        <p className="text-sm text-gray-400 leading-relaxed">
          Your payment was not completed and your card was not charged. Don&apos;t worry—your cart items are safely preserved!
        </p>
      </div>

      <div className="p-5 rounded-2xl bg-gray-900/60 border border-gray-800 text-xs text-gray-400 space-y-2 max-w-md mx-auto">
        <p className="font-semibold text-gray-200">Need help completing your order?</p>
        <p>If you experienced any card or network issues on Stripe, you can retry whenever you are ready.</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
        <Link
          href="/cart"
          className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
        >
          Return to Cart & Retry
        </Link>
        <Link
          href="/products"
          className="px-6 py-3.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-200 font-semibold text-xs border border-gray-800 hover:border-gray-700 transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
