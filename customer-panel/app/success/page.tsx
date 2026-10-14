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
    // Clear cart once order success page is reached
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
    <div className="max-w-3xl mx-auto py-12 px-4 space-y-8 animate-in fade-in pb-16">
      {/* Success Header Banner */}
      <div className="text-center space-y-4">
        <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/20 text-3xl">
          ✓
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Payment Successful!
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
          Thank you for your purchase. We&apos;ve received your order and our fulfillment team is preparing your package.
        </p>
      </div>

      {/* Order Summary Receipt Box */}
      {isLoading ? (
        <div className="p-8 rounded-3xl bg-gray-900 border border-gray-800 animate-pulse space-y-4 shadow-xl">
          <div className="h-6 bg-gray-800 rounded w-1/3" />
          <div className="h-24 bg-gray-950 rounded-2xl" />
          <div className="h-6 bg-gray-800 rounded w-1/2" />
        </div>
      ) : order ? (
        <div className="bg-gray-900/80 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Order Meta Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-gray-950/80 border border-gray-800/80 text-xs">
            <div>
              <span className="text-gray-500 block font-bold uppercase text-[10px]">Order Number</span>
              <span className="text-white font-mono font-bold truncate block mt-0.5">{order._id.slice(-8).toUpperCase()}</span>
            </div>
            <div>
              <span className="text-gray-500 block font-bold uppercase text-[10px]">Payment Status</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mt-0.5">
                {order.paymentStatus === 'paid' ? 'PAID' : 'CONFIRMED'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block font-bold uppercase text-[10px]">Recipient</span>
              <span className="text-white font-semibold truncate block mt-0.5">{order.customerEmail}</span>
            </div>
            <div>
              <span className="text-gray-500 block font-bold uppercase text-[10px]">Date</span>
              <span className="text-white font-medium block mt-0.5">
                {new Date(order.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Delivery Zone Information Snapshot */}
          {(order.deliveryZoneName || order.deliveryLocation || (order.deliveryFee !== undefined && order.deliveryFee > 0)) && (
            <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <span>⚡ Express Delivery:</span>
                  <span className="text-white font-bold">{order.deliveryZoneName || 'Express Zone'}</span>
                </span>
                {order.estimatedDeliveryTime && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-900/60 text-emerald-200 border border-emerald-500/30 text-[11px] font-bold">
                    Est. {order.estimatedDeliveryTime}
                  </span>
                )}
              </div>
              {order.deliveryLocation?.formattedAddress && (
                <p className="text-gray-300 text-[11px]">
                  📍 Destination: <strong>{order.deliveryLocation.formattedAddress}</strong>
                </p>
              )}
            </div>
          )}

          {/* Purchased Items List */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">
              Purchased Items
            </h3>
            <div className="divide-y divide-gray-800/80">
              {order.items.map((item, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <div className="w-11 h-11 rounded-xl bg-gray-950 border border-gray-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
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
                      <p className="font-bold text-white">{item.title}</p>
                      <p className="text-gray-400 text-[11px]">Qty: {item.quantity} × ₹{Number(item.priceAtPurchase).toFixed(2)}</p>
                    </div>
                  </div>
                  <span className="font-black text-white">
                    ₹{(Number(item.priceAtPurchase) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Summary */}
          <div className="pt-4 border-t border-gray-800 space-y-2 text-xs">
            <div className="flex justify-between text-gray-400">
              <span>Subtotal</span>
              <span className="text-white font-semibold">
                ₹{(order.subtotalAmount ?? (order.totalAmount - (order.deliveryFee ?? 0))).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Delivery Fee</span>
              <span className="text-white font-semibold">
                {order.deliveryFee === 0 || !order.deliveryFee ? (
                  <span className="text-emerald-400 font-bold">FREE</span>
                ) : (
                  `₹${order.deliveryFee.toFixed(2)}`
                )}
              </span>
            </div>
            <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-gray-800/80">
              <span className="font-bold uppercase tracking-wider text-xs sm:text-sm">Total Paid via Stripe</span>
              <span className="text-2xl font-black text-indigo-300">
                ₹{order.totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Live Delivery Tracking Button if available */}
          <div className="pt-3 border-t border-gray-800/80">
            <Link
              href={`/orders/${order._id}/track`}
              className="w-full py-3.5 px-4 rounded-2xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-orange-500/10"
            >
              <span>🛵</span>
              <span>Track Live Delivery Status</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-3xl bg-gray-900 border border-gray-800 text-center space-y-3">
          <p className="text-sm text-gray-300">Your checkout was processed.</p>
          <p className="text-xs text-gray-500">Order details have been securely logged.</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
        <Link
          href="/products"
          className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-xl shadow-indigo-600/25 transition-all"
        >
          Continue Shopping
        </Link>
        <button
          onClick={() => window.print()}
          className="px-6 py-3.5 rounded-2xl bg-gray-900 hover:bg-gray-800 text-gray-200 font-bold text-xs border border-gray-800 hover:border-gray-700 transition-colors cursor-pointer"
        >
          Print Receipt
        </button>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-400 font-bold">Loading receipt...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
