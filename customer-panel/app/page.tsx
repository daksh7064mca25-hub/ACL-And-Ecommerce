'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import { getPublicProducts, ProductItem } from '@/lib/api';

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadProducts() {
      try {
        setIsLoading(true);
        const data = await getPublicProducts({ sort: 'newest' });
        if (data.success && Array.isArray(data.products)) {
          setFeaturedProducts(data.products.slice(0, 8)); // Top 8 featured items
        }
      } catch (err: any) {
        console.error('Failed to load featured products:', err);
        setErrorMessage(err.message || 'Could not load products. Please ensure the backend is running.');
      } finally {
        setIsLoading(false);
      }
    }

    loadProducts();
  }, []);

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-gray-900 via-gray-900/60 to-gray-950 border border-gray-800 p-8 sm:p-12 lg:p-16 shadow-2xl">
        <div className="absolute inset-0 bg-radial-gradient from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
            <span>Next-Gen Electronics & Peripherals</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
            Elevate Your Setup with{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Precision Gear
            </span>
          </h1>

          <p className="text-base sm:text-lg text-gray-300 leading-relaxed max-w-2xl">
            Explore curated high-grade hardware, mechanical keyboards, gaming accessories, and electronics engineered for peak performance and aesthetics.
          </p>

          <div className="flex flex-wrap gap-4 pt-2">
            <Link
              href="/products"
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center space-x-2 active:scale-95"
            >
              <span>Explore All Products</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>

            <Link
              href="/products?inStock=true"
              className="px-6 py-3.5 rounded-xl bg-gray-900/80 hover:bg-gray-800 text-gray-200 font-semibold text-sm border border-gray-700/80 hover:border-gray-600 transition-all active:scale-95"
            >
              In-Stock Only
            </Link>
          </div>
        </div>
      </section>

      {/* Value Propositions / Trust Signals */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-2xl bg-gray-900/40 border border-gray-800/80 hover:border-gray-700 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h4 className="text-base font-bold text-white mb-1">Fast Global Delivery</h4>
          <p className="text-xs text-gray-400 leading-relaxed">
            Quick fulfillment on all orders with real-time package status tracking.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-gray-900/40 border border-gray-800/80 hover:border-gray-700 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h4 className="text-base font-bold text-white mb-1">Stripe Protected</h4>
          <p className="text-xs text-gray-400 leading-relaxed">
            Bank-level 256-bit encryption for seamless and secure credit card payments.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-gray-900/40 border border-gray-800/80 hover:border-gray-700 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <h4 className="text-base font-bold text-white mb-1">30-Day Money Back</h4>
          <p className="text-xs text-gray-400 leading-relaxed">
            Hassle-free return policy if you are not 100% satisfied with your order.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-gray-900/40 border border-gray-800/80 hover:border-gray-700 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h4 className="text-base font-bold text-white mb-1">Dedicated Support</h4>
          <p className="text-xs text-gray-400 leading-relaxed">
            Round-the-clock technical guidance and assistance for all gear questions.
          </p>
        </div>
      </section>

      {/* Featured Products Showcase */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-800">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Featured Gear</h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Top selected products available for instant order.
            </p>
          </div>
          <Link
            href="/products"
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
          >
            <span>View Full Catalog</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Product Grid / Loading / Error */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-gray-900/60 border border-gray-800 p-4 space-y-4 animate-pulse">
                <div className="aspect-square bg-gray-800 rounded-xl" />
                <div className="h-4 bg-gray-800 rounded w-3/4" />
                <div className="h-4 bg-gray-800 rounded w-1/2" />
                <div className="h-8 bg-gray-800 rounded" />
              </div>
            ))}
          </div>
        ) : errorMessage ? (
          <div className="p-8 rounded-2xl bg-gray-900 border border-red-500/30 text-center space-y-3">
            <p className="text-red-400 text-sm font-medium">{errorMessage}</p>
            <p className="text-xs text-gray-500">Make sure the Express backend is running on port 5000.</p>
          </div>
        ) : featuredProducts.length === 0 ? (
          <div className="py-16 text-center rounded-2xl bg-gray-900/40 border border-gray-800 space-y-3">
            <p className="text-gray-400 text-base font-medium">No products listed in catalog yet.</p>
            <p className="text-xs text-gray-500">Products created in the Admin Panel will appear here automatically.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
