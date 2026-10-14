'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ProductItem, getProductImageUrl } from '@/lib/api';
import { useCart } from '@/context/CartContext';

interface ProductCardProps {
  product: ProductItem;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isOutOfStock = product.quantity <= 0;
  const isLowStock = product.quantity > 0 && product.quantity <= 5;
  const primaryImage = product.images && product.images.length > 0 ? product.images[0] : '';
  const imageUrl = getProductImageUrl(primaryImage);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isOutOfStock) return;

    setIsAdding(true);
    const result = addToCart(product, 1);
    setFeedback(result.message);

    setTimeout(() => {
      setIsAdding(false);
      setTimeout(() => setFeedback(null), 2500);
    }, 250);
  };

  return (
    <div className="group relative bg-gray-900/60 hover:bg-gray-900/90 border border-gray-800/80 hover:border-indigo-500/40 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 flex flex-col justify-between">
      {/* Product Image Viewport */}
      <Link
        href={`/products/${product._id}`}
        className="block relative aspect-square bg-gray-950/80 overflow-hidden"
      >
        {primaryImage ? (
          <img
            src={imageUrl}
            alt={product.title}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-gray-950">
            <svg className="w-12 h-12 mb-2 stroke-current" fill="none" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-[11px] font-medium text-gray-500">No Image Available</span>
          </div>
        )}

        {/* Stock & Deliverability Badges Overlay */}
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1 items-start">
          {isOutOfStock ? (
            <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded-full bg-rose-950/85 text-rose-400 border border-rose-500/30 backdrop-blur-md">
              Out of Stock
            </span>
          ) : isLowStock ? (
            <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-950/85 text-amber-300 border border-amber-500/40 backdrop-blur-md animate-pulse">
              Only {product.quantity} left
            </span>
          ) : (
            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-950/85 text-emerald-400 border border-emerald-500/30 backdrop-blur-md">
              In Stock
            </span>
          )}

          {product.isDeliverable === false && (
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-950/85 text-rose-300 border border-rose-500/40 backdrop-blur-md">
              ⚠️ Undeliverable
            </span>
          )}
          {product.isDeliverable === true && (
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-950/85 text-indigo-300 border border-indigo-500/40 backdrop-blur-md">
              ⚡ Deliverable
            </span>
          )}
        </div>

        {/* Multi-image indicator badge */}
        {product.images && product.images.length > 1 && (
          <div className="absolute bottom-2.5 right-2.5 bg-black/70 backdrop-blur-md text-gray-300 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center space-x-1 border border-white/10">
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{product.images.length}</span>
          </div>
        )}
      </Link>

      {/* Product Details Section */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          <Link href={`/products/${product._id}`}>
            <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-2 leading-snug">
              {product.title}
            </h3>
          </Link>

          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-black text-white tracking-tight">
              ₹{Number(product.price).toFixed(2)}
            </span>
            <span className="text-[11px] text-gray-400 font-medium">
              {product.quantity > 0 ? `${product.quantity} units` : 'Sold out'}
            </span>
          </div>
        </div>

        {/* Instant Cart Feedback Toast */}
        {feedback && (
          <div className="mt-2 text-[11px] font-semibold px-2.5 py-1 rounded-xl bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 animate-in fade-in flex items-center gap-1">
            <span>✓</span>
            <span>{feedback}</span>
          </div>
        )}

        {/* Actions Button Row */}
        <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center space-x-2">
          <Link
            href={`/products/${product._id}`}
            className="flex-1 py-2 text-center text-xs font-bold text-gray-300 hover:text-white bg-gray-800/60 hover:bg-gray-800 rounded-xl border border-gray-700/60 transition-all"
          >
            Details
          </Link>

          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={isOutOfStock || isAdding || product.isDeliverable === false}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              isOutOfStock || product.isDeliverable === false
                ? 'bg-gray-800/40 text-gray-500 border border-gray-800 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-md shadow-indigo-600/25'
            }`}
          >
            {isAdding ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            )}
            <span>
              {isOutOfStock
                ? 'Out of Stock'
                : product.isDeliverable === false
                ? 'No Delivery'
                : 'Add'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
