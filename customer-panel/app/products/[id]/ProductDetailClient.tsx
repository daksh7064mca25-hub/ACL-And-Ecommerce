'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ProductGallery from '@/components/ProductGallery';
import { getPublicProductById, ProductItem } from '@/lib/api';
import { useCart } from '@/context/CartContext';
import { useSocket } from '@/context/SocketContext';

interface ProductDetailClientProps {
  productId: string;
  initialProduct: ProductItem | null;
}

export default function ProductDetailClient({
  productId,
  initialProduct,
}: ProductDetailClientProps) {
  const { addToCart } = useCart();
  const { onStockUpdated, onProductUpdated } = useSocket();

  const [product, setProduct] = useState<ProductItem | null>(initialProduct);
  const [isLoading, setIsLoading] = useState<boolean>(!initialProduct);
  const [quantity, setQuantity] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    !initialProduct ? 'Product not found or currently unavailable.' : null
  );
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // If initialProduct wasn't available at SSR, fetch on client as fallback
  useEffect(() => {
    if (initialProduct) {
      setProduct(initialProduct);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    async function loadProduct() {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const data = await getPublicProductById(productId);
        if (isMounted) {
          if (data.success && data.product) {
            setProduct(data.product);
          } else {
            setErrorMessage('Product not found.');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || 'Product not found.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    if (productId) {
      loadProduct();
    }

    return () => {
      isMounted = false;
    };
  }, [productId, initialProduct]);

  // Real-time Socket.IO listeners for live product updates
  useEffect(() => {
    if (!productId) return;

    const unsubStock = onStockUpdated((data) => {
      if (data.productId === productId) {
        setProduct((prev) => (prev ? { ...prev, quantity: data.stock } : prev));
      }
    });

    const unsubUpdated = onProductUpdated((updatedProd) => {
      if (updatedProd._id === productId) {
        setProduct((prev) => (prev ? { ...prev, ...updatedProd } : updatedProd));
      }
    });

    return () => {
      unsubStock();
      unsubUpdated();
    };
  }, [productId, onStockUpdated, onProductUpdated]);

  if (isLoading) {
    return (
      <div className="py-12 animate-pulse space-y-8 max-w-6xl mx-auto">
        <div className="h-5 w-48 bg-gray-800 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="aspect-square bg-gray-900 rounded-3xl" />
          <div className="space-y-6">
            <div className="h-8 bg-gray-800 rounded-xl w-3/4" />
            <div className="h-6 bg-gray-800 rounded-lg w-1/4" />
            <div className="h-28 bg-gray-900 rounded-2xl" />
            <div className="h-12 bg-gray-800 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage || !product) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto text-2xl">
          ⚠️
        </div>
        <h2 className="text-xl font-bold text-white">Product Not Found</h2>
        <p className="text-xs text-gray-400">{errorMessage || 'The requested product does not exist.'}</p>
        <Link
          href="/products"
          className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-all shadow-md shadow-indigo-600/20"
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
    }, 250);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs font-medium text-gray-400">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/products" className="hover:text-white transition-colors">Products</Link>
        <span aria-hidden="true">/</span>
        <span className="text-gray-200 truncate max-w-[200px] sm:max-w-md font-semibold" aria-current="page">{product.title}</span>
      </nav>

      {/* Main Details Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Gallery */}
        <ProductGallery images={product.images || []} title={product.title} />

        {/* Product Details & Purchase Controls */}
        <div className="space-y-6">
          {/* Header & Stock Status */}
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              {isOutOfStock ? (
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-rose-950/80 text-rose-400 border border-rose-500/30">
                  Out of Stock
                </span>
              ) : isLowStock ? (
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40 animate-pulse">
                  Only {product.quantity} items left in stock!
                </span>
              ) : (
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                  In Stock ({product.quantity} units available)
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              {product.title}
            </h1>

            <div className="flex items-baseline space-x-3 pt-2">
              <span className="text-3xl sm:text-4xl font-black text-white">
                ₹{Number(product.price).toFixed(2)}
              </span>
              <span className="text-xs text-gray-400">Taxes calculated at checkout</span>
            </div>
          </div>

          {/* Product Highlights / Specifications */}
          <div className="p-5 rounded-3xl bg-gray-900/50 border border-gray-800 space-y-3 shadow-lg">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Product Highlights</h3>
            <ul className="text-xs sm:text-sm text-gray-300 space-y-2.5">
              <li className="flex items-center space-x-2.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Authentic premium manufacturer warranty included</span>
              </li>
              <li className="flex items-center space-x-2.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Fast express delivery with real-time GPS rider tracking</span>
              </li>
              <li className="flex items-center space-x-2.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Direct Stripe checkout with 256-bit SSL encryption</span>
              </li>
            </ul>
          </div>

          {/* Quantity Selector & Add to Cart */}
          <div className="space-y-4 pt-4 border-t border-gray-800">
            <div className="flex items-center space-x-4">
              <span className="text-xs font-bold text-gray-300">Quantity:</span>
              <div className="flex items-center bg-gray-900 border border-gray-800 rounded-2xl p-1">
                <button
                  type="button"
                  onClick={() => handleQuantityChange(quantity - 1)}
                  disabled={quantity <= 1 || isOutOfStock}
                  aria-label="Decrease quantity"
                  className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-base flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer"
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
                  aria-label="Increase quantity"
                  className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-base flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer"
                >
                  +
                </button>
              </div>
              <span className="text-xs text-gray-400">
                (Available: {maxStock})
              </span>
            </div>

            {/* Notification / Feedback */}
            {feedback && (
              <div
                className={`p-3.5 rounded-2xl text-xs font-semibold border animate-in fade-in flex items-center justify-between shadow-lg ${
                  feedback.type === 'success'
                    ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-950/70 border-amber-500/40 text-amber-300'
                }`}
              >
                <span>✓ {feedback.message}</span>
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
                className={`flex-1 py-4 px-6 rounded-2xl font-bold text-xs sm:text-sm shadow-xl flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                  isOutOfStock
                    ? 'bg-gray-800 text-gray-500 border border-gray-800 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-98 text-white shadow-indigo-600/25'
                }`}
              >
                {isAdding ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                )}
                <span>{isOutOfStock ? 'Sold Out' : `Add ${quantity} to Cart`}</span>
              </button>

              <Link
                href="/cart"
                className="py-4 px-6 rounded-2xl font-bold text-xs sm:text-sm text-gray-200 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-center transition-colors shadow-md"
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
