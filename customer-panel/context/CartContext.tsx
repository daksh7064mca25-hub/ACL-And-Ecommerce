'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ProductItem } from '@/lib/api';

export interface CartItemType {
  product: ProductItem;
  quantity: number;
}

interface CartContextType {
  items: CartItemType[];
  addToCart: (product: ProductItem, quantity?: number) => { success: boolean; message: string };
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  shipping: number;
  tax: number;
  totalPrice: number;
  isMounted: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'customer_shopping_cart_v1';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItemType[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setIsMounted(true);
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch (err) {
      console.error('Failed to load cart from localStorage:', err);
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (!isMounted) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error('Failed to persist cart to localStorage:', err);
    }
  }, [items, isMounted]);

  const addToCart = (
    product: ProductItem,
    qtyToAdd: number = 1
  ): { success: boolean; message: string } => {
    if (product.quantity <= 0) {
      return { success: false, message: 'This item is currently out of stock.' };
    }

    const requestedQty = Math.max(1, Math.floor(qtyToAdd));
    let message = '';
    let success = true;

    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex((i) => i.product._id === product._id);

      if (existingIndex > -1) {
        const currentQty = prevItems[existingIndex].quantity;
        const newQty = currentQty + requestedQty;

        if (newQty > product.quantity) {
          message = `Only ${product.quantity} items available in stock. Cart adjusted to max stock.`;
          const updated = [...prevItems];
          updated[existingIndex] = {
            ...updated[existingIndex],
            product, // update fresh product info
            quantity: product.quantity,
          };
          return updated;
        } else {
          message = `Added ${requestedQty} more to cart (${newQty} total).`;
          const updated = [...prevItems];
          updated[existingIndex] = {
            ...updated[existingIndex],
            product,
            quantity: newQty,
          };
          return updated;
        }
      } else {
        if (requestedQty > product.quantity) {
          message = `Added maximum available stock (${product.quantity}) to cart.`;
          return [...prevItems, { product, quantity: product.quantity }];
        } else {
          message = `Added "${product.title}" to cart.`;
          return [...prevItems, { product, quantity: requestedQty }];
        }
      }
    });

    return { success, message: message || `Added to cart.` };
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    setItems((prevItems) => {
      if (newQuantity <= 0) {
        return prevItems.filter((i) => i.product._id !== productId);
      }

      return prevItems.map((item) => {
        if (item.product._id === productId) {
          const maxStock = item.product.quantity || 1;
          const safeQty = Math.min(newQuantity, maxStock);
          return { ...item, quantity: safeQty };
        }
        return item;
      });
    });
  };

  const removeFromCart = (productId: string) => {
    setItems((prevItems) => prevItems.filter((i) => i.product._id !== productId));
  };

  const clearCart = () => {
    setItems([]);
  };

  // Computations
  const totalItems = items.reduce((acc, curr) => acc + curr.quantity, 0);
  const subtotal = items.reduce(
    (acc, curr) => acc + (Number(curr.product.price) || 0) * curr.quantity,
    0
  );
  const shipping = subtotal > 0 && subtotal < 100 ? 10 : 0; // Free shipping over $100
  const tax = subtotal > 0 ? Math.round(subtotal * 0.08 * 100) / 100 : 0; // 8% estimated tax
  const totalPrice = Math.round((subtotal + shipping + tax) * 100) / 100;

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        totalItems,
        subtotal,
        shipping,
        tax,
        totalPrice,
        isMounted,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
