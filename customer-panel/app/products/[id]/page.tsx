'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProductGallery from '@/components/ProductGallery';
import { getPublicProductById, ProductItem } from '@/lib/api';
import { useCart } from '@/context/CartContext';

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { addToCart } = useCart();

  const [product, setProduct] = useState<ProductItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const data = await getPublicProductById(resolvedParams.id);
        if (data.success && data.product) {
          setProduct(data.product);
        }
      } catch (err: any) {
        console.error('Failed to load product:', err);
        setErrorMessage(err.message || 'Product not found.');
      } finally {
        setIsLoading(false);
      }
    }

    if (resolvedParams.id) {
      loadProduct();
    }
  }, [resolvedParams.id]);

  if (isLoading) {
    return (
      <div className="py-12 animate-pulse space-y-8">
        <div className="h-6 w-32 bg-gray-800 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="aspect-square bg-gray-900 rounded-2xl" />
          <div className="space-y-6">
            <div className="h-8 bg-gray-800 rounded w-3/4" />
            <div className="h-6 bg-gray-800 rounded w-1/4" />
            <div className="h-24 bg-gray-900 rounded" />
            <div className="h-12 bg-gray-800 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage || !product) {
    return (
      <div className="py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Product Not Found</h2>
        <p className="text-xs text-gray-400">{errorMessage || 'The requested product does not exist.'}</p>
        <Link
          href="/products"
          className="inline-block px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-semibold text-white transition-colors"
        >
          Return to Catalog
        </Link>
      </div>
    );
  }

  const isOutOfStock = product.quantity <= 0;
  const isLowStock = product.quantity > 0 && product.quantity <= 5;
  const maxStock = product.quantity;

  const handleQuantityChange = (newQty: number) => {
    if (newQty < 1) return;
    if (newQty > maxStock) return;
    setQuantity(newQty);
  };

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    setIsAdding(true);
    const res = addToCart(product, quantity);

    setFeedback({
      type: res.success ? 'success' : 'error',
      message: res.message,
    });

    setTimeout(() => {
      setIsAdding(false);
      setTimeout(() => setFeedback(null), 3000);
    }, 300);
  };

  return (
    <div className="space-y-8">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-xs text-gray-400">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <span>/</span>
        <Link href="/products" className="hover:text-white transition-colors">Products</Link>
        <span>/</span>
        <span className="text-gray-200 truncate max-w-[200px] sm:max-w-md">{product.title}</span>
      </nav>

      {/* Main Details Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Gallery */}
        <ProductGallery images={product.images || []} title={product.title} />

        {/* Product Details & Purchase Controls */}
        <div className="space-y-6">
          {/* Header & Stock */}
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              {isOutOfStock ? (
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                  Out of Stock
                </span>
              ) : isLowStock ? (
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                  Only {product.quantity} items left in stock!
                </span>
              ) : (
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  In Stock ({product.quantity} units available)
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              {product.title}
            </h1>

            <div className="flex items-baseline space-x-3 pt-2">
              <span className="text-3xl font-black text-white">
                ${Number(product.price).toFixed(2)}
              </span>
              <span className="text-xs text-gray-400">Tax & Shipping calculated at checkout</span>
            </div>
          </div>

          {/* Description & Overview */}
          <div className="p-5 rounded-2xl bg-gray-900/50 border border-gray-800 space-y-3">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Product Highlights</h3>
            <ul className="text-xs sm:text-sm text-gray-400 space-y-2">
              <li className="flex items-center space-x-2">
                <span className="text-emerald-400">✓</span>
                <span>Authentic premium manufacturer warranty included</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-emerald-400">✓</span>
                <span>Fast 2-4 business day expedited delivery</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-emerald-400">✓</span>
                <span>Direct Stripe checkout with 256-bit encryption</span>
              </li>
            </ul>
          </div>

          {/* Quantity Selector & Add to Cart */}
          <div className="space-y-4 pt-4 border-t border-gray-800">
            <div className="flex items-center space-x-4">
              <span className="text-xs font-semibold text-gray-300">Quantity:</span>
              <div className="flex items-center bg-gray-900 border border-gray-800 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => handleQuantityChange(quantity - 1)}
                  disabled={quantity <= 1 || isOutOfStock}
                  className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-bold text-base flex items-center justify-center transition-colors disabled:opacity-40"
                >
                  -
                </button>
                <span className="w-12 text-center text-sm font-bold text-white">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => handleQuantityChange(quantity + 1)}
                  disabled={quantity >= maxStock || isOutOfStock}
                  className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-bold text-base flex items-center justify-center transition-colors disabled:opacity-40"
                >
                  +
                </button>
              </div>
              <span className="text-xs text-gray-400">
                (Max: {maxStock})
              </span>
            </div>

            {/* Notification / Feedback */}
            {feedback && (
              <div
                className={`p-3.5 rounded-xl text-xs font-medium border animate-in fade-in flex items-center justify-between ${
                  feedback.type === 'success'
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                }`}
              >
                <span>{feedback.message}</span>
                <Link href="/cart" className="underline font-bold text-white ml-2 hover:text-indigo-300">
                  View Cart →
                </Link>
              </div>
            )}

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isOutOfStock || isAdding}
                className={`flex-1 py-4 px-6 rounded-xl font-bold text-sm shadow-xl flex items-center justify-center space-x-2 transition-all ${
                  isOutOfStock
                    ? 'bg-gray-800 text-gray-500 border border-gray-800 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-98 text-white shadow-indigo-600/20'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>{isOutOfStock ? 'Sold Out' : `Add ${quantity} to Cart`}</span>
              </button>

              <Link
                href="/cart"
                className="py-4 px-6 rounded-xl font-semibold text-sm text-gray-200 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-center transition-colors"
              >
                Go to Cart
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
