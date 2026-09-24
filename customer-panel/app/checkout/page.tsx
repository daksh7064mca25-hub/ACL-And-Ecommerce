'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CartSummary from '@/components/CartSummary';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { createCheckoutSession, getProductImageUrl } from '@/lib/api';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, isMounted } = useCart();
  const { user, token } = useAuth();

  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [shippingAddress, setShippingAddress] = useState({
    street: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const handleStripeCheckout = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      // 1. Validate email
      const emailToUse = (customerEmail || user?.email || '').trim();
      if (!emailToUse || !emailToUse.includes('@')) {
        setErrorMessage('Please provide a valid email address for your order confirmation receipt.');
        setIsLoading(false);
        return;
      }

      // 2. Prepare payload
      const checkoutPayload = {
        items: items.map((item) => ({
          productId: item.product._id,
          quantity: item.quantity,
        })),
        customerEmail: emailToUse,
        customerName: (customerName || user?.name || '').trim(),
      };

      // 3. Call backend checkout session endpoint
      const response = await createCheckoutSession(checkoutPayload, token);

      if (response.success && response.url) {
        // Redirect to Stripe's hosted secure checkout page
        window.location.href = response.url;
      } else {
        throw new Error(response.message || 'Failed to generate Stripe checkout session.');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setErrorMessage(err.message || 'Checkout failed. Please review your cart and try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-gray-800">
        <h1 className="text-3xl font-black text-white tracking-tight">Checkout</h1>
        <p className="text-sm text-gray-400 mt-1">
          Review your order details and proceed to Stripe secure payment.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-sm flex items-start space-x-3">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-semibold">{errorMessage}</p>
            <p className="text-xs text-red-400 mt-1">
              If an item is out of stock, please visit your <Link href="/cart" className="underline font-bold text-white">Cart</Link> to adjust quantities.
            </p>
          </div>
        </div>
      )}

      {/* Checkout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Customer Details & Items Review */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Details Card */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center font-bold">1</span>
              <span>Contact Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
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
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Delivery Details Note */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-3 shadow-xl">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center font-bold">2</span>
              <span>Payment & Shipping Address</span>
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              You will be redirected to Stripe&apos;s hosted payment gateway to securely enter your card details and shipping address with 256-bit encryption.
            </p>
          </div>

          {/* Items Review Card */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center pb-3 border-b border-gray-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center font-bold">3</span>
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
                    <div className="w-12 h-12 rounded-lg bg-gray-950 border border-gray-800 overflow-hidden flex-shrink-0">
                      {item.product.images?.[0] ? (
                        <img
                          src={getProductImageUrl(item.product.images[0])}
                          alt={item.product.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">📦</div>
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
        </div>

        {/* Right Column: Cart Summary & Checkout Action */}
        <div className="lg:col-span-1">
          <CartSummary
            showCheckoutButton={true}
            onCheckoutClick={handleStripeCheckout}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
