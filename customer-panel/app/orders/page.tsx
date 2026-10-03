'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  getMyOrders,
  createRefundRequest,
  OrderDetail,
  getProductImageUrl,
} from '@/lib/api';

const REFUND_REASONS = [
  'Product is incorrect',
  'Wrong product received',
  'Product damaged',
  'Product not as described',
  'Product missing',
  'Other',
];

export default function OrdersPage() {
  const { user, token, logout, isAuthenticated, isMounted } = useAuth();
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refund Modal State
  const [selectedOrderForRefund, setSelectedOrderForRefund] = useState<OrderDetail | null>(null);
  const [refundReason, setRefundReason] = useState<string>(REFUND_REASONS[0]);
  const [refundDescription, setRefundDescription] = useState<string>('');
  const [isSubmittingRefund, setIsSubmittingRefund] = useState<boolean>(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccessMsg, setRefundSuccessMsg] = useState<string | null>(null);

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
      console.warn('Failed to load customer orders:', err.message);
      if (
        err.status === 401 ||
        err.message?.includes('expired') ||
        err.message?.includes('Invalid or expired') ||
        err.message?.includes('Access denied') ||
        err.message?.includes('User no longer exists')
      ) {
        // Automatically clear expired / invalid token and prompt user to login
        logout();
      } else {
        setErrorMessage(err.message || 'Failed to retrieve order history.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isMounted) {
      loadOrders();
    }
  }, [token, isMounted]);

  const openRefundModal = (order: OrderDetail) => {
    setSelectedOrderForRefund(order);
    setRefundReason(REFUND_REASONS[0]);
    setRefundDescription('');
    setRefundError(null);
    setRefundSuccessMsg(null);
  };

  const closeRefundModal = () => {
    if (isSubmittingRefund) return;
    setSelectedOrderForRefund(null);
    setRefundError(null);
    setRefundSuccessMsg(null);
  };

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForRefund || !token) return;

    try {
      setIsSubmittingRefund(true);
      setRefundError(null);
      setRefundSuccessMsg(null);

      const response = await createRefundRequest(
        selectedOrderForRefund._id,
        {
          reason: refundReason,
          description: refundDescription.trim(),
        },
        token
      );

      if (response.success) {
        setRefundSuccessMsg('Refund request submitted successfully. Our team will review your request.');
        // Refresh orders after brief delay
        setTimeout(async () => {
          await loadOrders();
          closeRefundModal();
        }, 1800);
      } else {
        setRefundError(response.message || 'Failed to submit refund request.');
      }
    } catch (err: any) {
      console.error('Refund request error:', err);
      setRefundError(err.message || 'Failed to submit refund request.');
    } finally {
      setIsSubmittingRefund(false);
    }
  };

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
      <div className="pb-6 border-b border-gray-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Order History</h1>
          <p className="text-sm text-gray-400 mt-1">
            Track and review all purchases placed under <span className="text-white font-semibold">{user?.email}</span>.
          </p>
        </div>
        <button
          onClick={loadOrders}
          className="px-3.5 py-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-700 text-xs font-semibold text-gray-300 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 bg-gray-900/60 rounded-2xl border border-gray-800" />
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
            className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const isPaid = order.paymentStatus === 'paid';
            const refundStatus = order.refundStatus || 'none';
            const canRequestRefund = isPaid && (refundStatus === 'none' || !refundStatus);

            return (
              <div
                key={order._id}
                className="bg-gray-900/70 border border-gray-800 hover:border-gray-700 rounded-2xl p-6 shadow-xl space-y-5 transition-all"
              >
                {/* Top Row: Meta */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-800/80 text-xs">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono font-bold text-white tracking-wide">
                      #{order._id.slice(-8).toUpperCase()}
                    </span>
                    <span className="text-gray-600">•</span>
                    <span className="text-gray-400">{new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Payment Status Badge */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        order.paymentStatus === 'paid'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : order.paymentStatus === 'failed'
                          ? 'bg-red-500/15 text-red-400 border-red-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      PAYMENT: {order.paymentStatus.toUpperCase()}
                    </span>

                    {/* Order Status Badge */}
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-800 text-gray-300 border border-gray-700">
                      STATUS: {order.orderStatus.toUpperCase()}
                    </span>

                    {/* Refund Status Badge (if applicable) */}
                    {refundStatus !== 'none' && (
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          refundStatus === 'refunded'
                            ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                            : refundStatus === 'requested' || refundStatus === 'processing'
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse'
                            : refundStatus === 'rejected'
                            ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            : 'bg-red-500/15 text-red-400 border-red-500/30'
                        }`}
                      >
                        REFUND: {refundStatus.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Items in this Order */}
                <div className="divide-y divide-gray-800/50">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
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
                          <p className="font-semibold text-white">{item.title}</p>
                          <p className="text-gray-500 text-[11px]">
                            Qty: {item.quantity} × ₹{Number(item.priceAtPurchase).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-white">
                        ₹{(Number(item.priceAtPurchase) * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Delivery Zone Details Snapshot */}
                {(order.deliveryZoneName || order.deliveryLocation || (order.deliveryFee !== undefined && order.deliveryFee > 0)) && (
                  <div className="p-3 rounded-xl bg-gray-950/60 border border-gray-800/80 text-xs flex flex-wrap items-center justify-between gap-2 text-gray-300">
                    <div className="flex items-center space-x-2">
                      <span className="text-emerald-400">⚡</span>
                      <span className="font-semibold text-white">
                        {order.deliveryZoneName || 'Delivery Zone'}
                      </span>
                      {order.estimatedDeliveryTime && (
                        <span className="text-gray-400">• ~{order.estimatedDeliveryTime}</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-3 text-[11px]">
                      {order.deliveryLocation?.formattedAddress && (
                        <span className="text-gray-400 truncate max-w-xs" title={order.deliveryLocation.formattedAddress}>
                          📍 {order.deliveryLocation.formattedAddress}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded bg-gray-800 text-indigo-300 border border-gray-700 font-bold">
                        Delivery Charge: ₹{order.deliveryFee ?? 0}
                      </span>
                    </div>
                  </div>
                )}

                {/* Bottom Row: Total & Refund Action */}
                <div className="pt-3 border-t border-gray-800/80 flex flex-wrap justify-between items-center gap-4">
                  <div className="flex items-baseline space-x-2">
                    <span className="text-xs text-gray-400">Total Paid:</span>
                    <span className="text-lg font-black text-indigo-300">
                      ₹{order.totalAmount.toFixed(2)}
                    </span>
                    {order.subtotalAmount !== undefined && order.deliveryFee !== undefined && (
                      <span className="text-[11px] text-gray-500 ml-1">
                        (Subtotal: ₹{order.subtotalAmount.toFixed(2)} + Fee: ₹{order.deliveryFee})
                      </span>
                    )}
                    {order.refundedAmount && order.refundedAmount > 0 && (
                      <span className="text-xs text-emerald-400 font-semibold ml-2">
                        (Refunded: ₹{order.refundedAmount.toFixed(2)})
                      </span>
                    )}
                  </div>

                  <div>
                    {canRequestRefund ? (
                      <button
                        onClick={() => openRefundModal(order)}
                        className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:border-rose-500/50 text-xs font-bold transition-all flex items-center space-x-1.5 shadow-sm"
                      >
                        <span>↩ Request Refund</span>
                      </button>
                    ) : refundStatus === 'requested' || refundStatus === 'processing' ? (
                      <div className="text-right">
                        <span className="inline-flex items-center text-xs font-semibold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
                          ⏳ Refund Request Under Review
                        </span>
                      </div>
                    ) : refundStatus === 'refunded' ? (
                      <div className="text-right">
                        <span className="inline-flex items-center text-xs font-semibold text-cyan-300 bg-cyan-500/10 px-3 py-1.5 rounded-xl border border-cyan-500/20">
                          ✓ Payment Refunded via Stripe
                        </span>
                      </div>
                    ) : refundStatus === 'rejected' ? (
                      <div className="text-right">
                        <span className="inline-flex items-center text-xs font-semibold text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/20">
                          ✕ Refund Request Declined
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Request Refund Modal */}
      {selectedOrderForRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-gray-700/80 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold text-lg">
                  ↩
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Request Refund</h3>
                  <p className="text-xs text-gray-400">
                    Order #{selectedOrderForRefund._id.slice(-8).toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                onClick={closeRefundModal}
                disabled={isSubmittingRefund}
                className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Order Summary in Modal */}
            <div className="bg-gray-950/60 rounded-2xl p-4 border border-gray-800/80 space-y-2 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Products:</span>
                <span className="text-white font-medium truncate max-w-[240px]">
                  {selectedOrderForRefund.items.map((i) => i.title).join(', ')}
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Amount Paid:</span>
                <span className="text-white font-black">
                  ₹{selectedOrderForRefund.totalAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Payment Method:</span>
                <span className="text-gray-300">Stripe Card / Embedded Checkout</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitRefund} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">
                  Select Refund Reason <span className="text-rose-400">*</span>
                </label>
                <select
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  disabled={isSubmittingRefund}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500 transition-colors"
                >
                  {REFUND_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">
                  Additional Details / Problem Description
                </label>
                <textarea
                  rows={3}
                  value={refundDescription}
                  onChange={(e) => setRefundDescription(e.target.value)}
                  disabled={isSubmittingRefund}
                  placeholder="Explain why you are requesting a refund for this order..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-rose-500 transition-colors resize-none"
                  maxLength={1000}
                />
                <p className="text-[11px] text-gray-500 text-right mt-1">
                  {refundDescription.length}/1000 characters
                </p>
              </div>

              {/* Error Message */}
              {refundError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs">
                  {refundError}
                </div>
              )}

              {/* Success Message */}
              {refundSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs">
                  ✓ {refundSuccessMsg}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={closeRefundModal}
                  disabled={isSubmittingRefund}
                  className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRefund || !!refundSuccessMsg}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/20 flex items-center space-x-2"
                >
                  {isSubmittingRefund ? (
                    <>
                      <span className="animate-spin inline-block">⏳</span>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Refund Request</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

