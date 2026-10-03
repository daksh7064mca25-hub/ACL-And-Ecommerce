'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { getNearbyProducts, ProductItem, getProductImageUrl } from '@/lib/api';
import { useCart } from '@/context/CartContext';
import {
  loadPlacesLibrary,
  reverseGeocodeLatLng,
  extractAddressComponents,
  hasGoogleMapsApiKey,
} from '@/lib/googleMaps';

// Dynamically import Google Maps component to prevent SSR hydration mismatches
const NearbyMap = dynamic(() => import('@/components/NearbyMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[420px] rounded-2xl bg-gray-900 border border-gray-800 flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin" />
      <p className="text-xs text-gray-400 font-medium">Loading Google Maps...</p>
    </div>
  ),
});

const RADIUS_OPTIONS = [5, 10, 25, 50, 100];

const PRESET_CITIES = [
  { name: 'Chandigarh', lat: 30.7333, lng: 76.7794, address: 'Sector 17, Chandigarh, India' },
  { name: 'Mohali', lat: 30.7046, lng: 76.7179, address: 'Sector 62, Mohali, Punjab, India' },
  { name: 'Panchkula', lat: 30.6942, lng: 76.8606, address: 'Sector 5, Panchkula, Haryana, India' },
  { name: 'Delhi NCR', lat: 28.6139, lng: 77.209, address: 'Connaught Place, New Delhi, India' },
  { name: 'Mumbai', lat: 19.076, lng: 72.8777, address: 'Bandra West, Mumbai, Maharashtra, India' },
  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946, address: 'MG Road, Bengaluru, Karnataka, India' },
];

export default function NearbyProductsPage() {
  const { addToCart } = useCart();

  // Location State (Default: Chandigarh Sector 17)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number }>({
    lat: 30.7333,
    lng: 76.7794,
  });
  const [locationName, setLocationName] = useState('Sector 17, Chandigarh, India');
  const [radiusKm, setRadiusKm] = useState<number>(25);

  // Search & Filter State
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);

  // Address Input & Places Autocomplete Ref
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [geocodeNotice, setGeocodeNotice] = useState<string | null>(null);

  // UI & Products Data State
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'both' | 'list' | 'map'>('both');
  const [cartFeedback, setCartFeedback] = useState<{ [id: string]: string }>({});

  // Fetch Nearby Products from Backend API ($geoNear)
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await getNearbyProducts({
        lat: userLocation.lat,
        lng: userLocation.lng,
        radius: radiusKm,
        search: searchQuery || undefined,
        inStock: inStockOnly || undefined,
      });

      if (res.success && res.products) {
        setProducts(res.products);
      } else {
        setProducts([]);
        setErrorMessage(res.message || 'No products returned from server.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to search nearby products.');
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [userLocation, radiusKm, searchQuery, inStockOnly]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Reverse Geocode using Google Geocoding
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const addressInfo = await reverseGeocodeLatLng(lat, lng);
      if (addressInfo && addressInfo.formattedAddress) {
        setLocationName(addressInfo.formattedAddress);
        return;
      }
    } catch {
      // Ignore geocode errors gracefully
    }
    setLocationName(`${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`);
  };

  // Initialize Google Places Autocomplete on the address search box
  useEffect(() => {
    let isSubscribed = true;

    if (!hasGoogleMapsApiKey()) {
      return;
    }

    loadPlacesLibrary()
      .then(({ Autocomplete }) => {
        if (!isSubscribed || !addressInputRef.current) return;

        const autocomplete = new Autocomplete(addressInputRef.current, {
          fields: ['geometry', 'formatted_address', 'name'],
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (!place.geometry || !place.geometry.location) {
            return;
          }

          const newLat = place.geometry.location.lat();
          const newLng = place.geometry.location.lng();

          setUserLocation({ lat: newLat, lng: newLng });
          setLocationName(place.formatted_address || place.name || `${newLat.toFixed(3)}°N, ${newLng.toFixed(3)}°E`);
          setGeocodeNotice(null);
        });

        autocompleteRef.current = autocomplete;
      })
      .catch(() => {
        // Fallback gracefully if Places library is not yet loaded
      });

    return () => {
      isSubscribed = false;
    };
  }, []);

  // Handle Location Change from Map Click or Marker Drag
  const handleLocationChange = (lat: number, lng: number) => {
    setUserLocation({ lat, lng });
    reverseGeocode(lat, lng);
  };

  // Handle HTML5 Geolocation API "Detect My Location"
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setGeocodeNotice(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        reverseGeocode(latitude, longitude);
      },
      (err) => {
        setIsLocating(false);
        setGeocodeNotice(
          err.code === 1
            ? 'Location permission denied. Please allow location access or pick a city below.'
            : 'Unable to retrieve location. Please search for an address.'
        );
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Preset City Selection
  const handleSelectCity = (city: { name: string; lat: number; lng: number; address: string }) => {
    setUserLocation({ lat: city.lat, lng: city.lng });
    setLocationName(city.address);
    setGeocodeNotice(null);
  };

  // Add Product to Cart
  const handleAddToCart = (product: ProductItem) => {
    const result = addToCart(product, 1);
    setCartFeedback((prev) => ({ ...prev, [product._id]: result.message }));
    setTimeout(() => {
      setCartFeedback((prev) => {
        const next = { ...prev };
        delete next[product._id];
        return next;
      });
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Hero */}
        <div className="bg-gradient-to-r from-gray-900 via-indigo-950/40 to-gray-900 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <span>🗺️ Google Maps Geospatial Discovery</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Find Products <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Near You</span>
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-400">
              Discover inventory around your location using Google Maps Platform and MongoDB 2dsphere $geoNear geospatial search.
            </p>
          </div>
        </div>

        {/* Location & Filter Control Hub */}
        <div className="bg-gray-900/90 border border-gray-800/90 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            {/* Google Places Search & Detect Button */}
            <div className="lg:col-span-6 space-y-2">
              <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span>📍</span> Selected Search Origin:
                  <span className="text-indigo-400 font-bold truncate max-w-[220px]">{locationName}</span>
                </span>
                <span className="text-[11px] text-gray-500 font-mono">
                  {userLocation.lat.toFixed(3)}°N, {userLocation.lng.toFixed(3)}°E
                </span>
              </label>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    ref={addressInputRef}
                    type="text"
                    placeholder="Search address or area with Google Places..."
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-3.5 pr-10 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <span className="absolute right-3 top-2 text-xs text-gray-500 pointer-events-none">🔍</span>
                </div>

                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={isLocating}
                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                  title="Detect GPS Location"
                >
                  {isLocating ? (
                    <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>🎯</span>
                  )}
                  <span>GPS</span>
                </button>
              </div>

              {geocodeNotice && (
                <p className="text-[11px] text-rose-400 font-medium">{geocodeNotice}</p>
              )}
            </div>

            {/* Radius Filter Buttons */}
            <div className="lg:col-span-6 space-y-2">
              <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                <span>Filter by Distance:</span>
                <span className="text-indigo-400 font-bold">{radiusKm} km radius</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {RADIUS_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadiusKm(r)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      radiusKm === r
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400'
                        : 'bg-gray-950 hover:bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-800'
                    }`}
                  >
                    {r} km
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick City Presets & Keyword Filter Bar */}
          <div className="pt-3 border-t border-gray-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-gray-400 font-medium mr-1">Quick Cities:</span>
              {PRESET_CITIES.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => handleSelectCity(c)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors ${
                    locationName.includes(c.name)
                      ? 'bg-indigo-600 text-white border-indigo-500 font-semibold'
                      : 'bg-gray-950 hover:bg-gray-800 text-gray-300 border-gray-800/80'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {/* Product Keyword Filter */}
              <div className="relative">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setSearchQuery(searchInput);
                  }}
                  placeholder="Filter products..."
                  className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-40 sm:w-52"
                />
                {searchInput && (
                  <button
                    onClick={() => {
                      setSearchInput('');
                      setSearchQuery('');
                    }}
                    className="absolute right-2 top-1 text-gray-400 hover:text-gray-200 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* In Stock Filter */}
              <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="rounded border-gray-700 bg-gray-950 text-indigo-600 focus:ring-indigo-500"
                />
                <span>In Stock</span>
              </label>
            </div>
          </div>
        </div>

        {/* View Layout Toggle (Split / List / Map) */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400">
            Found <span className="font-bold text-white">{products.length}</span> products within{' '}
            <span className="font-bold text-indigo-400">{radiusKm} km</span> of your location
          </div>

          <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('both')}
              className={`hidden lg:inline-block px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'both' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Split View
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Products List ({products.length})
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'map' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Google Map
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-4 bg-rose-950/40 border border-rose-800/80 rounded-2xl text-rose-300 text-xs flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={fetchProducts}
              className="px-3 py-1 bg-rose-800 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {/* Main Content: Split Grid or Full Width */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[550px]">
          {/* Left Column: Product Cards List */}
          {(activeTab === 'both' || activeTab === 'list') && (
            <div
              className={`${
                activeTab === 'both' ? 'lg:col-span-5 xl:col-span-5' : 'lg:col-span-12'
              } flex flex-col space-y-4 max-h-[750px] overflow-y-auto pr-1`}
            >
              {isLoading ? (
                <div className="p-16 text-center bg-gray-900/60 rounded-2xl border border-gray-800 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                  <p className="text-xs text-gray-400">Searching nearby inventory...</p>
                </div>
              ) : products.length === 0 ? (
                <div className="p-12 text-center bg-gray-900/60 rounded-2xl border border-gray-800 space-y-4">
                  <div className="w-14 h-14 rounded-full bg-gray-800 text-gray-400 flex items-center justify-center mx-auto text-2xl">
                    📍
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">No products found within {radiusKm} km</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                      There are currently no products in the selected radius. Try expanding to 50 km or changing your location.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => setRadiusKm(50)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
                    >
                      Expand to 50 km
                    </button>
                    <button
                      onClick={() => {
                        setUserLocation({ lat: 30.7333, lng: 76.7794 });
                        setLocationName('Sector 17, Chandigarh, India');
                        setRadiusKm(25);
                      }}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl transition-all"
                    >
                      Reset to Chandigarh
                    </button>
                  </div>
                </div>
              ) : (
                products.map((product) => {
                  const isSelected = selectedProductId === product._id;
                  const isOutOfStock = product.quantity <= 0;
                  const primaryImage =
                    product.images && product.images.length > 0
                      ? getProductImageUrl(product.images[0])
                      : '';
                  const formattedDistance =
                    product.distanceInKm !== undefined
                      ? product.distanceInKm < 1
                        ? `${(product.distanceInKm * 1000).toFixed(0)} m`
                        : `${product.distanceInKm.toFixed(1)} km`
                      : 'Nearby';

                  return (
                    <div
                      key={product._id}
                      onClick={() => setSelectedProductId(product._id)}
                      className={`group relative p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 ${
                        isSelected
                          ? 'bg-gray-900 border-indigo-500 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500'
                          : 'bg-gray-900/60 hover:bg-gray-900 border-gray-800/80 hover:border-gray-700'
                      }`}
                    >
                      {/* Product Thumbnail */}
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-gray-950 border border-gray-800 overflow-hidden shrink-0 relative">
                        {primaryImage ? (
                          <img
                            src={primaryImage}
                            alt={product.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                            No image
                          </div>
                        )}

                        {/* Distance Badge */}
                        <div className="absolute top-1.5 left-1.5 bg-indigo-600/90 backdrop-blur-md text-white font-bold text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 shadow-md">
                          <span>📍</span>
                          <span>{formattedDistance}</span>
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                              {product.title}
                            </h3>
                            <span className="text-sm font-extrabold text-indigo-400 shrink-0">
                              ₹{Number(product.price).toFixed(2)}
                            </span>
                          </div>

                          {/* Address / City */}
                          <div className="mt-1 text-[11px] text-gray-400 flex items-center gap-1 truncate">
                            <span>🏙️</span>
                            <span className="truncate">
                              {product.location?.city || product.location?.formattedAddress || 'Location specified'}
                            </span>
                          </div>

                          {/* Stock Status */}
                          <div className="mt-1 flex items-center gap-2">
                            {isOutOfStock ? (
                              <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                Out of Stock
                              </span>
                            ) : product.quantity <= 5 ? (
                              <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                Low Stock ({product.quantity})
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                In Stock ({product.quantity})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Feedback Banner */}
                        {cartFeedback[product._id] && (
                          <div className="text-[10px] text-indigo-300 font-medium animate-fadeIn">
                            ✓ {cartFeedback[product._id]}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="mt-2.5 flex items-center gap-2">
                          <Link
                            href={`/products/${product._id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-semibold transition-colors"
                          >
                            Details
                          </Link>
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToCart(product);
                            }}
                            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                              isOutOfStock
                                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            <span>Add to Cart</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Right Column: Google Maps Discovery Map */}
          {(activeTab === 'both' || activeTab === 'map') && (
            <div
              className={`${
                activeTab === 'both' ? 'lg:col-span-7 xl:col-span-7' : 'lg:col-span-12'
              } h-[550px] lg:h-auto min-h-[480px]`}
            >
              <NearbyMap
                userLocation={userLocation}
                radiusKm={radiusKm}
                products={products}
                selectedProductId={selectedProductId}
                onSelectProduct={(p) => setSelectedProductId(p._id)}
                onLocationChange={handleLocationChange}
                onAddToCart={handleAddToCart}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
