'use client';

import React, { useState } from 'react';
import { getProductImageUrl } from '@/lib/api';

interface ProductGalleryProps {
  images: string[];
  title: string;
}

export default function ProductGallery({ images, title }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const validImages = Array.isArray(images) && images.length > 0 ? images : [];
  const currentImage = validImages[selectedIndex] || '';

  return (
    <div className="flex flex-col space-y-4">
      {/* Main Image Viewport */}
      <div className="relative aspect-square w-full rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden shadow-2xl flex items-center justify-center">
        {currentImage ? (
          <img
            src={getProductImageUrl(currentImage)}
            alt={`${title} - View ${selectedIndex + 1}`}
            className="w-full h-full object-cover object-center transition-all duration-300"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-600">
            <svg className="w-16 h-16 stroke-current mb-3" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium">No Image Uploaded</span>
          </div>
        )}
      </div>

      {/* Thumbnails Row */}
      {validImages.length > 1 && (
        <div className="flex items-center space-x-3 overflow-x-auto pb-2">
          {validImages.map((img, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                className={`relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                  isSelected
                    ? 'border-indigo-500 scale-105 shadow-md shadow-indigo-500/20'
                    : 'border-gray-800 opacity-60 hover:opacity-100 hover:border-gray-700'
                }`}
              >
                <img
                  src={getProductImageUrl(img)}
                  alt={`Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
