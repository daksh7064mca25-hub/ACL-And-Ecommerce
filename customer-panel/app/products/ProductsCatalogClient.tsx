'use client';

import React, { useEffect, useState, useMemo } from 'react';
import ProductCard from '@/components/ProductCard';
import DeliveryLocationCard from '@/components/delivery/DeliveryLocationCard';
import { getPublicProducts, ProductItem } from '@/lib/api';
import { useDeliveryLocation } from '@/context/DeliveryLocationContext';
import { useSocket } from '@/context/SocketContext';

export default function ProductsCatalogClient() {
  const {
    location,
    isDeliverable,
    deliveryZone,
    deliveryFee,
    estimatedDeliveryTime,
    openLocationModal,
  } = useDeliveryLocation();

  const { onStockUpdated, onProductCreated, onProductUpdated } = useSocket();

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('newest');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [deliverableOnly, setDeliverableOnly] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function fetchProducts() {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await getPublicProducts({
        search: searchTerm.trim() || undefined,
        sort: sortOption,
        inStock: inStockOnly || undefined,
        lat: location?.lat,
        lng: location?.lng,
      });

      if (data.success && Array.isArray(data.products)) {
        setProducts(data.products);
      }
    } catch (err: any) {
      console.error('Failed to fetch products catalog:', err);
      setErrorMessage(err.message || 'Unable to retrieve products.');
    } finally {
      setIsLoading(false);
    }
  }

  // Fetch when filters or delivery location coordinates change
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchProducts();
    }, 200);

    return () => clearTimeout(handler);
  }, [searchTerm, sortOption, inStockOnly, location?.lat, location?.lng]);

  // Real-time Socket.IO event listeners for live stock & product catalog updates
  useEffect(() => {
    const unsubStock = onStockUpdated((data) => {
      setProducts((prev) =>
        prev.map((p) =>
          p._id === data.productId ? { ...p, quantity: data.stock } : p
        )
      );
    });

    const unsubCreated = onProductCreated((newProd) => {
      setProducts((prev) => {
        if (prev.some((p) => p._id === newProd._id)) return prev;
        return [newProd, ...prev];
      });
    });

    const unsubUpdated = onProductUpdated((updatedProd) => {
      setProducts((prev) =>
        prev.map((p) =>
          p._id === updatedProd._id ? { ...p, ...updatedProd } : p
        )
      );
    });

    return () => {
      unsubStock();
      unsubCreated();
      unsubUpdated();
    };
  }, [onStockUpdated, onProductCreated, onProductUpdated]);

  // Deliverable filter if user checks "Deliverable to me"
  const displayedProducts = useMemo(() => {
    if (!deliverableOnly) return products;
    return products.filter((p) => p.isDeliverable !== false);
  }, [products, deliverableOnly]);

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Product Catalog</h1>
          <p className="text-sm text-gray-400 mt-1">
            Browse our full range of high-performance gear with live location delivery tracking.
          </p>
        </div>
        <div className="text-xs text-gray-400 font-medium">
          Showing <span className="text-indigo-400 font-bold">{displayedProducts.length}</span> product(s)
        </div>
      </div>

      {/* Delivery Zone Serviceability Banner */}
      <DeliveryLocationCard />

      {/* Filter & Controls Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 sm:p-5 rounded-3xl bg-gray-900/60 border border-gray-800/80 backdrop-blur-md shadow-xl">
        {/* Search Input */}
        <div className="relative sm:col-span-2">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by product title, brand or keyword..."
            className="w-full pl-10 pr-10 py-2.5 bg-gray-950/80 border border-gray-800 rounded-2xl text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs font-bold text-gray-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Sort Select */}
        <div>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-gray-950/80 border border-gray-800 rounded-2xl text-xs sm:text-sm text-gray-200 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
          >
            <option value="newest">Sort: Newest First</option>
            <option value="price-asc">Sort: Price (Low to High)</option>
            <option value="price-desc">Sort: Price (High to Low)</option>
            <option value="title-asc">Sort: Name (A to Z)</option>
          </select>
        </div>

        {/* In Stock Filter */}
        <div className="flex items-center space-x-3 px-3.5 py-2.5 bg-gray-950/80 border border-gray-800 rounded-2xl">
          <input
            type="checkbox"
            id="inStockOnly"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="w-4 h-4 text-indigo-600 bg-gray-900 border-gray-700 rounded focus:ring-indigo-500 cursor-pointer"
          />
          <label htmlFor="inStockOnly" className="text-xs font-bold text-gray-300 cursor-pointer select-none">
            In Stock Only
          </label>
        </div>

        {/* Deliverable Only Filter */}
        <div className="flex items-center space-x-3 px-3.5 py-2.5 bg-gray-950/80 border border-gray-800 rounded-2xl sm:col-span-2 lg:col-span-4">
          <input
            type="checkbox"
            id="deliverableOnly"
            checked={deliverableOnly}
            onChange={(e) => setDeliverableOnly(e.target.checked)}
            className="w-4 h-4 text-indigo-600 bg-gray-900 border-gray-700 rounded focus:ring-indigo-500 cursor-pointer"
          />
          <label htmlFor="deliverableOnly" className="text-xs font-bold text-gray-300 cursor-pointer select-none flex items-center gap-1.5">
            <span>⚡ Deliverable to my location</span>
            <span className="text-[11px] text-gray-400 font-normal">({location?.city || 'Selected Zone'})</span>
          </label>
        </div>
      </div>

      {/* Error Notice */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={fetchProducts}
            className="px-3 py-1 bg-rose-800 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Catalog Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="rounded-3xl bg-gray-900/60 border border-gray-800 p-4 space-y-4 animate-pulse">
              <div className="aspect-square bg-gray-800 rounded-2xl" />
              <div className="h-4 bg-gray-800 rounded w-3/4" />
              <div className="h-4 bg-gray-800 rounded w-1/2" />
              <div className="h-10 bg-gray-800 rounded-xl" />
            </div>
          ))}
        </div>
      ) : displayedProducts.length === 0 ? (
        <div className="py-20 text-center rounded-3xl bg-gray-900/40 border border-gray-800 p-8 space-y-4 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-gray-800 text-gray-400 flex items-center justify-center mx-auto text-2xl">
            🔍
          </div>
          <h3 className="text-lg font-bold text-white">No Matching Products Found</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            Try adjusting your search terms or clearing the in-stock / deliverable filters.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSortOption('newest');
              setInStockOnly(false);
              setDeliverableOnly(false);
            }}
            className="px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayedProducts.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
