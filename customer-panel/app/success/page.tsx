'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getOrderBySessionId, getOrderById, OrderDetail, getProductImageUrl } from '@/lib/api';
import { useCart } from '@/context/CartContext';

function SuccessContent() {
  const searchParams = useSearchParams();
  const { clearCart } = useCart();

  const sessionId = searchParams.get('session_id');
  const orderIdParam = searchParams.get('order_id');

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Clear the cart once user hits the verified success page
    clearCart();

    async function loadOrder() {
      try {
        setIsLoading(true);
        let data;
        if (sessionId) {
          data = await getOrderBySessionId(sessionId);
        } else if (orderIdParam) {
          data = await getOrderById(orderIdParam);
        }

        if (data?.success && data.order) {
          setOrder(data.order);
        } else {
          setErrorMessage('Could not locate order details.');
        }
      } catch (err: any) {
        console.error('Error fetching confirmed order:', err);
        setErrorMessage(err.message || 'Failed to retrieve order confirmation details.');
      } finally {
        setIsLoading(false);
      }
    }

    if (sessionId || orderIdParam) {
      loadOrder();
    } else {
      setIsLoading(false);
    }
  }, [sessionId, orderIdParam]);

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8 animate-in fade-in">
      {/* Success Header Banner */}
      <div className="text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Payment Successful!
        </h1>
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          Thank you for your purchase. We&apos;ve received your order and our fulfillment team is preparing your package.
        </p>
      </div>

      {/* Order Summary Receipt Box */}
      {isLoading ? (
        <div className="p-8 rounded-3xl bg-gray-900 border border-gray-800 animate-pulse space-y-4">
          <div className="h-6 bg-gray-800 rounded w-1/3" />
          <div className="h-20 bg-gray-950 rounded-xl" />
          <div className="h-6 bg-gray-800 rounded w-1/2" />
        </div>
      ) : order ? (
        <div className="bg-gray-900/80 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Order Meta Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-gray-950/80 border border-gray-800/80 text-xs">
            <div>
              <span className="text-gray-500 block">Order Number</span>
              <span className="text-white font-mono font-bold truncate block">{order._id.slice(-8).toUpperCase()}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Payment Status</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 mt-0.5">
                {order.paymentStatus === 'paid' ? 'PAID' : 'CONFIRMED'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block">Recipient</span>
              <span className="text-white font-semibold truncate block">{order.customerEmail}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Date</span>
              <span className="text-white font-medium block">
                {new Date(order.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Purchased Items List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Purchased Items
            </h3>
            <div className="divide-y divide-gray-800/80">
              {order.items.map((item, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-950 border border-gray-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {item.image ? (
                        <img
                          src={getProductImageUrl(item.image)}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs">📦</span>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{item.title}</p>
                      <p className="text-gray-400">Qty: {item.quantity} × ${Number(item.priceAtPurchase).toFixed(2)}</p>
                    </div>
                  </div>
                  <span className="font-bold text-white">
                    ${(Number(item.priceAtPurchase) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Summary */}
          <div className="pt-4 border-t border-gray-800 space-y-2 text-xs">
            <div className="flex justify-between text-gray-400">
              <span>Subtotal</span>
              <span className="text-white font-medium">${order.totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Shipping</span>
              <span className="text-emerald-400 font-semibold">FREE</span>
            </div>
            <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-gray-800/80">
              <span>Total Paid via Stripe</span>
              <span className="text-xl font-black text-indigo-300">
                ${order.totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Stripe Session Note */}
          {order.stripeCheckoutSessionId && (
            <div className="pt-2 text-[11px] text-gray-500 font-mono">
              Stripe Session Reference: {order.stripeCheckoutSessionId}
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 rounded-3xl bg-gray-900 border border-gray-800 text-center space-y-3">
          <p className="text-sm text-gray-300">Your checkout was processed.</p>
          <p className="text-xs text-gray-500">Order details have been logged on the server.</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
        <Link
          href="/products"
          className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all"
        >
          Continue Shopping
        </Link>
        <button
          onClick={() => window.print()}
          className="px-6 py-3.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-200 font-semibold text-xs border border-gray-800 hover:border-gray-700 transition-colors"
        >
          Print Receipt
        </button>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-400">Loading receipt...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
