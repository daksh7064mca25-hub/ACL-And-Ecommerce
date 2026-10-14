'use client';

import React from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useDeliveryLocation } from '@/context/DeliveryLocationContext';

interface CartSummaryProps {
  showCheckoutButton?: boolean;
  onCheckoutClick?: () => void;
  isLoading?: boolean;
  buttonText?: string;
}

export default function CartSummary({
  showCheckoutButton = true,
  onCheckoutClick,
  isLoading = false,
  buttonText = 'Proceed to Checkout',
}: CartSummaryProps) {
  const { subtotal, tax, totalItems, items } = useCart();
  const {
    location,
    isDeliverable,
    deliveryZone,
    deliveryFee,
    minOrderAmount,
    estimatedDeliveryTime,
    openLocationModal,
  } = useDeliveryLocation();

  const isCartEmpty = items.length === 0;
  const currentDeliveryFee = isCartEmpty ? 0 : isDeliverable ? deliveryFee : 0;
  const grandTotal = Math.round((subtotal + currentDeliveryFee + tax) * 100) / 100;

  // Min order check
  const isBelowMinOrder = !isCartEmpty && isDeliverable && minOrderAmount > 0 && subtotal < minOrderAmount;
  const minOrderShortfall = isBelowMinOrder ? minOrderAmount - subtotal : 0;

  // Can checkout condition
  const canProceed = !isCartEmpty && isDeliverable && !isBelowMinOrder;

  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-3xl p-6 shadow-2xl sticky top-24 space-y-5">
      {/* Delivery Zone Destination Card */}
      <div className="p-4 rounded-2xl bg-gray-950/70 border border-gray-800 space-y-2 shadow-inner">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400 font-bold flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isDeliverable ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            <span>Deliver to:</span>
          </span>
          <button
            type="button"
            onClick={openLocationModal}
            className="text-indigo-400 hover:text-indigo-300 font-bold text-xs cursor-pointer"
          >
            Change 📍
          </button>
        </div>

        <p className="text-xs font-bold text-white truncate">
          {location?.address || 'No location selected'}
        </p>

        {isDeliverable && deliveryZone ? (
          <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-[11px] text-gray-300">
            <span className="font-bold text-emerald-400">{deliveryZone.name}</span>
            <span className="text-indigo-300 font-extrabold">~{estimatedDeliveryTime}</span>
          </div>
        ) : (
          <div className="pt-2 border-t border-gray-800/80 text-[11px] text-rose-400 font-bold">
            ⚠️ Address is outside delivery zone
          </div>
        )}
      </div>

      <h3 className="text-base font-black text-white pb-3 border-b border-gray-800 uppercase tracking-wider">
        Order Summary
      </h3>

      <div className="space-y-3.5 text-xs sm:text-sm">
        <div className="flex justify-between text-gray-400">
          <span>Items ({totalItems})</span>
          <span className="text-white font-semibold">₹{subtotal.toFixed(2)}</span>
        </div>

        <div className="flex justify-between text-gray-400">
          <span>Delivery Fee</span>
          <span className="text-white font-semibold">
            {isCartEmpty ? (
              '₹0.00'
            ) : !isDeliverable ? (
              <span className="text-rose-400 font-bold">Zone Unavailable</span>
            ) : currentDeliveryFee === 0 ? (
              <span className="text-emerald-400 font-bold">FREE</span>
            ) : (
              `₹${currentDeliveryFee.toFixed(2)}`
            )}
          </span>
        </div>

        {/* Min order alert */}
        {isBelowMinOrder && (
          <div className="p-3 rounded-2xl bg-amber-950/50 border border-amber-500/40 text-amber-300 text-xs space-y-1">
            <p className="font-bold flex items-center gap-1">
              <span>⚠️ Minimum Order Notice</span>
            </p>
            <p className="text-[11px] text-amber-200">
              {deliveryZone?.name} requires a min. order of <strong>₹{minOrderAmount}</strong>.
              Add <strong>₹{minOrderShortfall.toFixed(2)}</strong> more to proceed.
            </p>
          </div>
        )}

        {/* Not serviceable warning */}
        {!isCartEmpty && !isDeliverable && (
          <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs space-y-1">
            <p className="font-bold">❌ Address Undeliverable</p>
            <p className="text-[11px] text-rose-200">
              Please choose a delivery location inside Chandigarh, Mohali, or Panchkula to proceed.
            </p>
          </div>
        )}

        <div className="flex justify-between text-gray-400">
          <span>Estimated Tax (8%)</span>
          <span className="text-white font-semibold">₹{tax.toFixed(2)}</span>
        </div>

        <div className="pt-4 border-t border-gray-800 flex justify-between items-baseline">
          <span className="text-sm font-bold text-white uppercase tracking-wider">Total Amount</span>
          <span className="text-2xl font-black bg-gradient-to-r from-white via-gray-100 to-indigo-200 bg-clip-text text-transparent">
            ₹{grandTotal.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Checkout CTA */}
      {showCheckoutButton && (
        <div className="mt-6 space-y-3">
          {onCheckoutClick ? (
            <button
              type="button"
              onClick={onCheckoutClick}
              disabled={!canProceed || isLoading}
              className={`w-full py-4 px-4 rounded-2xl font-bold text-xs sm:text-sm text-white shadow-xl transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                !canProceed || isLoading
                  ? 'bg-gray-800 text-gray-500 border border-gray-800 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-98 shadow-indigo-500/25'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Zone & Payment...</span>
                </>
              ) : (
                <>
                  <span>
                    {!isDeliverable
                      ? 'Location Undeliverable'
                      : isBelowMinOrder
                      ? `Min. Order ₹${minOrderAmount}`
                      : buttonText}
                  </span>
                  {canProceed && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  )}
                </>
              )}
            </button>
          ) : (
            <Link
              href="/checkout"
              className={`w-full py-4 px-4 rounded-2xl font-bold text-xs sm:text-sm text-white shadow-xl transition-all flex items-center justify-center space-x-2 ${
                !canProceed
                  ? 'bg-gray-800 text-gray-500 border border-gray-800 pointer-events-none'
                  : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-98 shadow-indigo-500/25'
              }`}
            >
              <span>
                {!isDeliverable
                  ? 'Location Undeliverable'
                  : isBelowMinOrder
                  ? `Min. Order ₹${minOrderAmount}`
                  : 'Proceed to Checkout'}
              </span>
              {canProceed && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              )}
            </Link>
          )}

          <div className="pt-2 flex items-center justify-center space-x-2 text-xs text-gray-400 font-medium">
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Guaranteed Safe 256-Bit Stripe Checkout</span>
          </div>
        </div>
      )}
    </div>
  );
}
