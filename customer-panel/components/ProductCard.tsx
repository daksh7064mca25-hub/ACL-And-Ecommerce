'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
    }, 300);
  };

  return (
    <div className="group relative bg-gray-900/60 hover:bg-gray-900 border border-gray-800/80 hover:border-indigo-500/40 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 flex flex-col">
      {/* Product Image Container */}
      <Link href={`/products/${product._id}`} className="block relative aspect-square bg-gray-950/80 overflow-hidden">
        {primaryImage ? (
          <img
            src={imageUrl}
            alt={product.title}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-gray-950">
            <svg className="w-12 h-12 mb-2 stroke-current" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs">No Image Available</span>
          </div>
        )}

        {/* Stock Badge Overlay */}
        <div className="absolute top-3 left-3 z-10">
          {isOutOfStock ? (
            <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/30 backdrop-blur-md">
              Out of Stock
            </span>
          ) : isLowStock ? (
            <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 backdrop-blur-md animate-pulse">
              Only {product.quantity} left
            </span>
          ) : (
            <span className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 backdrop-blur-md">
              In Stock
            </span>
          )}
        </div>

        {/* Multi-image count badge */}
        {product.images && product.images.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-gray-300 text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center space-x-1 border border-white/10">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{product.images.length}</span>
          </div>
        )}
      </Link>

      {/* Product Info */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <Link href={`/products/${product._id}`}>
            <h3 className="text-base font-semibold text-white hover:text-indigo-400 transition-colors line-clamp-2 leading-snug">
              {product.title}
            </h3>
          </Link>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-xl font-bold text-white tracking-tight">
              ${Number(product.price).toFixed(2)}
            </span>
            <span className="text-xs text-gray-400">
              {product.quantity > 0 ? `${product.quantity} units available` : 'Sold out'}
            </span>
          </div>
        </div>

        {/* Feedback message if any */}
        {feedback && (
          <div className="mt-3 text-[11px] px-2.5 py-1 rounded bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 animate-in fade-in">
            {feedback}
          </div>
        )}

        {/* Actions Button Grid */}
        <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center space-x-2">
          <Link
            href={`/products/${product._id}`}
            className="flex-1 py-2 text-center text-xs font-semibold text-gray-300 hover:text-white bg-gray-800/60 hover:bg-gray-800 rounded-xl border border-gray-700/60 transition-all"
          >
            Details
          </Link>

          <button
            onClick={handleQuickAdd}
            disabled={isOutOfStock || isAdding}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl flex items-center justify-center space-x-1.5 transition-all ${
              isOutOfStock
                ? 'bg-gray-800/40 text-gray-500 border border-gray-800 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-md shadow-indigo-600/20'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>{isOutOfStock ? 'Unavailable' : 'Add'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
