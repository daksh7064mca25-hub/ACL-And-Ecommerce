'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SearchBarProps {
  className?: string;
  autoFocus?: boolean;
  onSearchSubmit?: () => void;
  placeholder?: string;
}

export default function SearchBar({
  className = '',
  autoFocus = false,
  onSearchSubmit,
  placeholder = 'Search products, categories, features...',
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/products?search=${encodeURIComponent(query.trim())}`);
      if (onSearchSubmit) {
        onSearchSubmit();
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`relative w-full ${className}`}>
      <div className="relative flex items-center">
        {/* Search Icon */}
        <span className="absolute left-3.5 text-gray-400 pointer-events-none">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </span>

        {/* Search Input */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full bg-gray-900/90 hover:bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl pl-10 pr-20 py-2 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-150"
        />

        {/* Clear Button / Submit */}
        <div className="absolute right-2 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-gray-400 hover:text-white rounded-lg text-xs"
              aria-label="Clear search query"
            >
              ✕
            </button>
          )}
          <button
            type="submit"
            className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
          >
            Search
          </button>
        </div>
      </div>
    </form>
  );
}
