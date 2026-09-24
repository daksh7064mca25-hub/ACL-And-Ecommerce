'use client';

import React from 'react';
import Link from 'next/link';
import { CartItemType, useCart } from '@/context/CartContext';
import { getProductImageUrl } from '@/lib/api';

interface CartItemProps {
  item: CartItemType;
}

export default function CartItem({ item }: CartItemProps) {
  const { updateQuantity, removeFromCart } = useCart();
  const { product, quantity } = item;

  const maxStock = product.quantity || 1;
  const isMaxStockReached = quantity >= maxStock;
  const primaryImage = product.images && product.images.length > 0 ? product.images[0] : '';
  const itemTotal = (Number(product.price) || 0) * quantity;

  return (
    <div className="py-5 border-b border-gray-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group">
      {/* Product Info & Thumbnail */}
      <div className="flex items-center space-x-4 flex-1">
        <Link
          href={`/products/${product._id}`}
          className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gray-900 border border-gray-800 overflow-hidden flex-shrink-0"
        >
          {primaryImage ? (
            <img
              src={getProductImageUrl(primaryImage)}
              alt={product.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600">
              <svg className="w-6 h-6 stroke-current" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </Link>

        <div className="flex-1 min-w-0">
          <Link href={`/products/${product._id}`}>
            <h4 className="text-sm sm:text-base font-semibold text-white hover:text-indigo-400 transition-colors truncate">
              {product.title}
            </h4>
          </Link>
          <p className="text-xs text-gray-400 mt-1">
            Unit Price: <span className="text-gray-200 font-medium">${Number(product.price).toFixed(2)}</span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Stock: <span className={maxStock <= 5 ? 'text-amber-400' : 'text-emerald-400'}>{maxStock} available</span>
          </p>
          {isMaxStockReached && (
            <span className="inline-block mt-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              Max stock reached
            </span>
          )}
        </div>
      </div>

      {/* Quantity Controls & Actions */}
      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto space-x-6">
        {/* Counter */}
        <div className="flex items-center space-x-1.5 bg-gray-900 border border-gray-800 rounded-xl p-1">
          <button
            type="button"
            onClick={() => updateQuantity(product._id, quantity - 1)}
            className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 flex items-center justify-center text-sm font-bold transition-colors disabled:opacity-40"
            disabled={quantity <= 1}
            title="Decrease quantity"
          >
            -
          </button>
          <span className="w-10 text-center text-sm font-semibold text-white">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => updateQuantity(product._id, quantity + 1)}
            className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 flex items-center justify-center text-sm font-bold transition-colors disabled:opacity-40"
            disabled={isMaxStockReached}
            title="Increase quantity"
          >
            +
          </button>
        </div>

        {/* Item Total */}
        <div className="text-right min-w-[80px]">
          <span className="text-base font-bold text-white tracking-tight">
            ${itemTotal.toFixed(2)}
          </span>
        </div>

        {/* Remove Button */}
        <button
          type="button"
          onClick={() => removeFromCart(product._id)}
          className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
          title="Remove from cart"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
