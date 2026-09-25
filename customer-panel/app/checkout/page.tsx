'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from '@stripe/react-stripe-js';
import CartSummary from '@/components/CartSummary';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import {
  createCheckoutSession,
  getProductImageUrl,
  getStripeConfig,
} from '@/lib/api';

export default function CheckoutPage() {
  const { items, isMounted, totalPrice } = useCart();
  const { user, token } = useAuth();

  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  const [isInitializingPayment, setIsInitializingPayment] = useState(false);
  const [showEmbeddedCheckout, setShowEmbeddedCheckout] = useState(false);
  const [checkoutSessionKey, setCheckoutSessionKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync auth state into inputs if user logs in
  useEffect(() => {
    if (user?.email && !customerEmail) {
      setCustomerEmail(user.email);
    }
    if (user?.name && !customerName) {
      setCustomerName(user.name);
    }
  }, [user]);

  // Load Stripe Publishable Key
  useEffect(() => {
    let isCancelled = false;
    async function initStripe() {
      try {
        const config = await getStripeConfig();
        const publishableKey =
          config.publishableKey ||
          process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
          '';

        if (publishableKey && !isCancelled) {
          setStripePromise(loadStripe(publishableKey));
        } else if (!isCancelled) {
          console.warn(
            '[Stripe Warning]: No publishable key found. Please set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY or configure backend.'
          );
        }
      } catch (err) {
        console.error('Failed to initialize Stripe client:', err);
      }
    }
    initStripe();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Fetch client secret for Stripe Embedded Checkout
  const fetchClientSecret = useCallback(async () => {
    try {
      setErrorMessage(null);
      const emailToUse = (customerEmail || user?.email || '').trim();

      if (!emailToUse || !emailToUse.includes('@')) {
        throw new Error('Please enter a valid email address before proceeding.');
      }

      const checkoutPayload = {
        items: items.map((item) => ({
          productId: item.product._id,
          quantity: item.quantity,
        })),
        customerEmail: emailToUse,
        customerName: (customerName || user?.name || '').trim(),
      };

      const response = await createCheckoutSession(checkoutPayload, token);

      if (!response.success || !response.clientSecret) {
        throw new Error(
          response.message || 'Failed to initialize embedded checkout session.'
        );
      }

      return response.clientSecret;
    } catch (err: any) {
      console.error('[Embedded Checkout Error]:', err);
      const errorMsg =
        err.message || 'Failed to start payment. Please review your cart and try again.';
      setErrorMessage(errorMsg);
      setShowEmbeddedCheckout(false);
      throw err;
    }
  }, [items, customerEmail, customerName, user, token]);

  const handleStartPayment = () => {
    const emailToUse = (customerEmail || user?.email || '').trim();
    if (!emailToUse || !emailToUse.includes('@')) {
      setErrorMessage('Please provide a valid email address to receive your order receipt.');
      return;
    }
    setErrorMessage(null);
    setIsInitializingPayment(true);
    setCheckoutSessionKey((prev) => prev + 1);
    setShowEmbeddedCheckout(true);
    setIsInitializingPayment(false);
  };

  const embeddedOptions = useMemo(
    () => ({
      fetchClientSecret,
    }),
    [fetchClientSecret]
  );

  if (!isMounted) {
    return (
      <div className="py-16 space-y-6 animate-pulse max-w-4xl mx-auto">
        <div className="h-8 bg-gray-800 rounded w-48" />
        <div className="h-64 bg-gray-900 rounded-2xl" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-white">Your Cart is Empty</h2>
        <p className="text-xs text-gray-400">Add products to your cart before proceeding to checkout.</p>
        <Link
          href="/products"
          className="inline-block px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="pb-6 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Checkout</h1>
          <p className="text-sm text-gray-400 mt-1">
            Complete your order with secure embedded Stripe payment.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-3 py-1.5 rounded-xl w-fit">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="font-semibold">256-Bit SSL Encrypted Payment</span>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-sm flex items-start space-x-3 animate-in fade-in">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-semibold">{errorMessage}</p>
            <p className="text-xs text-red-400 mt-1">
              Need to modify items? Visit your <Link href="/cart" className="underline font-bold text-white">Cart</Link> to adjust quantities.
            </p>
          </div>
        </div>
      )}

      {/* Main Checkout Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left 2 Columns: Contact Info, Items Review, Embedded Payment Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Contact Information */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center font-bold">1</span>
                <span>Contact Information</span>
              </h3>
              {showEmbeddedCheckout && (
                <button
                  type="button"
                  onClick={() => setShowEmbeddedCheckout(false)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  Edit Details
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => {
                    setCustomerEmail(e.target.value);
                    if (showEmbeddedCheckout) setShowEmbeddedCheckout(false);
                  }}
                  placeholder="you@example.com"
                  disabled={showEmbeddedCheckout}
                  className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-60"
                  required
                />
                <span className="text-[11px] text-gray-500 mt-1 block">
                  Stripe receipt and order confirmation will be sent here.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    if (showEmbeddedCheckout) setShowEmbeddedCheckout(false);
                  }}
                  placeholder="e.g. Jane Doe"
                  disabled={showEmbeddedCheckout}
                  className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          {/* Step 2: Review Cart Items */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center pb-3 border-b border-gray-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center font-bold">2</span>
                <span>Review Cart Items ({items.length})</span>
              </h3>
              <Link href="/cart" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
                Edit Cart
              </Link>
            </div>

            <div className="divide-y divide-gray-800/60">
              {items.map((item) => (
                <div key={item.product._id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-lg bg-gray-950 border border-gray-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {item.product.images?.[0] ? (
                        <img
                          src={getProductImageUrl(item.product.images[0])}
                          alt={item.product.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-gray-600">📦</span>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-white truncate max-w-[200px] sm:max-w-xs">{item.product.title}</p>
                      <p className="text-gray-400 mt-0.5">Qty: {item.quantity} × ${Number(item.product.price).toFixed(2)}</p>
                    </div>
                  </div>
                  <span className="font-bold text-white">
                    ${((Number(item.product.price) || 0) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Step 3: Payment Section (Stripe Embedded Checkout) */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center font-bold">3</span>
                <span>Secure Payment</span>
              </h3>
              <div className="flex items-center space-x-1.5 text-xs text-indigo-400 font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Stripe Embedded Checkout</span>
              </div>
            </div>

            {showEmbeddedCheckout && stripePromise ? (
              <div className="rounded-xl overflow-hidden bg-gray-950 p-2 sm:p-4 border border-indigo-500/30 shadow-2xl transition-all">
                <EmbeddedCheckoutProvider
                  key={checkoutSessionKey}
                  stripe={stripePromise}
                  options={embeddedOptions}
                >
                  <EmbeddedCheckout className="w-full min-h-[420px]" />
                </EmbeddedCheckoutProvider>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-gray-950/60 border border-gray-800/80 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">
                    Ready to Pay ${totalPrice.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    Click the button below to load the secure Stripe card payment form directly inside this page.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleStartPayment}
                  disabled={isInitializingPayment}
                  className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all active:scale-98 cursor-pointer"
                >
                  {isInitializingPayment ? 'Loading Payment Form...' : 'Proceed to Payment'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div className="lg:col-span-1">
          <CartSummary
            showCheckoutButton={!showEmbeddedCheckout}
            onCheckoutClick={handleStartPayment}
            isLoading={isInitializingPayment}
            buttonText="Proceed to Payment"
          />
        </div>
      </div>
    </div>
  );
}
