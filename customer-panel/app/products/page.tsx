'use client';

import React, { useEffect, useState, useMemo } from 'react';
import ProductCard from '@/components/ProductCard';
import { getPublicProducts, ProductItem } from '@/lib/api';

export default function ProductsCatalogPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('newest');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function fetchProducts() {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await getPublicProducts({
        search: searchTerm.trim() || undefined,
        sort: sortOption,
        inStock: inStockOnly || undefined,
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

  // Fetch when filters change
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchProducts();
    }, 250);

    return () => clearTimeout(handler);
  }, [searchTerm, sortOption, inStockOnly]);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Product Catalog</h1>
          <p className="text-sm text-gray-400 mt-1">
            Browse our full range of high-performance gear and electronics.
          </p>
        </div>
        <div className="text-xs text-gray-400 font-medium">
          Showing <span className="text-indigo-400 font-bold">{products.length}</span> product(s)
        </div>
      </div>

      {/* Filter & Controls Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-2xl bg-gray-900/60 border border-gray-800/80 backdrop-blur-md">
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
            placeholder="Search by product title or keyword..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-950/80 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs text-gray-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Sort Select */}
        <div>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-gray-950/80 border border-gray-800 rounded-xl text-sm text-gray-200 focus:outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="newest">Sort: Newest First</option>
            <option value="price-asc">Sort: Price (Low to High)</option>
            <option value="price-desc">Sort: Price (High to Low)</option>
            <option value="title-asc">Sort: Name (A to Z)</option>
          </select>
        </div>

        {/* Stock Filter Checkbox */}
        <div className="flex items-center space-x-3 px-3.5 py-2.5 bg-gray-950/80 border border-gray-800 rounded-xl">
          <input
            type="checkbox"
            id="inStockOnly"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="w-4 h-4 text-indigo-600 bg-gray-900 border-gray-700 rounded focus:ring-indigo-500"
          />
          <label htmlFor="inStockOnly" className="text-xs font-semibold text-gray-300 cursor-pointer select-none">
            In Stock Only
          </label>
        </div>
      </div>

      {/* Error Notice */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Catalog Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-gray-900/60 border border-gray-800 p-4 space-y-4 animate-pulse">
              <div className="aspect-square bg-gray-800 rounded-xl" />
              <div className="h-4 bg-gray-800 rounded w-3/4" />
              <div className="h-4 bg-gray-800 rounded w-1/2" />
              <div className="h-8 bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="py-20 text-center rounded-2xl bg-gray-900/40 border border-gray-800 space-y-4">
          <div className="w-12 h-12 rounded-full bg-gray-800 text-gray-500 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white">No Matching Products Found</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Try adjusting your search terms or clearing the in-stock filter.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSortOption('newest');
              setInStockOnly(false);
            }}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
