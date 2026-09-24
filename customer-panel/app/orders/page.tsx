'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getMyOrders, OrderDetail, getProductImageUrl } from '@/lib/api';

export default function OrdersPage() {
  const { user, token, isAuthenticated, isMounted } = useAuth();
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrders() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);
        const data = await getMyOrders(token);
        if (data.success && Array.isArray(data.orders)) {
          setOrders(data.orders);
        }
      } catch (err: any) {
        console.error('Failed to load customer orders:', err);
        setErrorMessage(err.message || 'Failed to retrieve order history.');
      } finally {
        setIsLoading(false);
      }
    }

    if (isMounted) {
      loadOrders();
    }
  }, [token, isMounted]);

  if (!isMounted) return null;

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-white">Sign In to View Orders</h2>
        <p className="text-xs text-gray-400">Please sign in with your customer account to view your past orders and receipts.</p>
        <Link
          href="/login"
          className="inline-block px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-gray-800">
        <h1 className="text-3xl font-black text-white tracking-tight">Order History</h1>
        <p className="text-sm text-gray-400 mt-1">
          Track and review all purchases placed under <span className="text-white font-semibold">{user?.email}</span>.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-900 rounded-2xl" />
          ))}
        </div>
      ) : errorMessage ? (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-sm">
          {errorMessage}
        </div>
      ) : orders.length === 0 ? (
        <div className="py-20 text-center rounded-3xl bg-gray-900/40 border border-gray-800 p-8 space-y-4 max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-gray-800 text-gray-500 flex items-center justify-center mx-auto">
            📦
          </div>
          <h3 className="text-lg font-bold text-white">No Orders Placed Yet</h3>
          <p className="text-xs text-gray-400">
            Once you complete a purchase through Stripe, your orders will appear here.
          </p>
          <Link
            href="/products"
            className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div
              key={order._id}
              className="bg-gray-900/60 border border-gray-800 hover:border-gray-700 rounded-2xl p-6 shadow-xl space-y-4 transition-all"
            >
              {/* Top Row: Meta */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-800/80 text-xs">
                <div className="flex items-center space-x-3">
                  <span className="font-mono font-bold text-white">#{order._id.slice(-8).toUpperCase()}</span>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-400">{new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      order.paymentStatus === 'paid'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : order.paymentStatus === 'failed'
                        ? 'bg-red-500/15 text-red-400 border-red-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {order.paymentStatus.toUpperCase()}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-800 text-gray-300 border border-gray-700">
                    {order.orderStatus.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Items in this Order */}
              <div className="divide-y divide-gray-800/40">
                {order.items.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
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
                        <p className="text-gray-500 text-[11px]">Qty: {item.quantity} × ${Number(item.priceAtPurchase).toFixed(2)}</p>
                      </div>
                    </div>
                    <span className="font-bold text-white">
                      ${(Number(item.priceAtPurchase) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Bottom Row: Total */}
              <div className="pt-3 border-t border-gray-800/80 flex justify-between items-baseline">
                <span className="text-xs text-gray-400">Total Paid via Stripe:</span>
                <span className="text-lg font-black text-indigo-300">
                  ${order.totalAmount.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
