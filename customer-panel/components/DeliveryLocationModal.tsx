'use client';

import React, { useState, useEffect } from 'react';
import {
  useDeliveryLocation,
  PRESET_LOCATIONS,
  CustomerDeliveryLocation,
} from '@/context/DeliveryLocationContext';

export default function DeliveryLocationModal() {
  const {
    location,
    serviceability,
    isCheckingServiceability,
    isLoadingLocation,
    isLocationModalOpen,
    closeLocationModal,
    setLocation,
    detectCurrentLocation,
  } = useDeliveryLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<
    { address: string; lat: number; lng: number; city: string }[]
  >([]);
  const [activeTab, setActiveTab] = useState<'presets' | 'search'>('presets');

  // Clear search on modal open
  useEffect(() => {
    if (isLocationModalOpen) {
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [isLocationModalOpen]);

  if (!isLocationModalOpen) return null;

  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    try {
      setIsSearching(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&limit=5&addressdetails=1`,
        { headers: { 'User-Agent': 'EcommerceDeliveryZone/1.0' } }
      );
      if (res.ok) {
        const data = await res.json();
        const results = data.map((item: any) => ({
          address: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          city:
            item.address?.city ||
            item.address?.town ||
            item.address?.suburb ||
            item.address?.state ||
            'Location',
        }));
        setSearchResults(results);
      }
    } catch (err) {
      console.warn('Search geocoding error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPreset = async (presetLoc: CustomerDeliveryLocation) => {
    await setLocation(presetLoc);
  };

  const handleSelectSearchResult = async (res: {
    address: string;
    lat: number;
    lng: number;
    city: string;
  }) => {
    await setLocation({
      lat: res.lat,
      lng: res.lng,
      address: res.address,
      city: res.city,
    });
    setSearchResults([]);
  };

  const isCurrentServiceable = Boolean(serviceability?.isServiceable);
  const currentZone = serviceability?.deliveryZone;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between bg-gray-950/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Choose Delivery Location</h2>
              <p className="text-xs text-gray-400">
                Check delivery serviceability, fees, and delivery times for your area.
              </p>
            </div>
          </div>
          <button
            onClick={closeLocationModal}
            className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Active Location & Serviceability Card */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isCurrentServiceable
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isCurrentServiceable ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                    }`}
                  />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {isCheckingServiceability
                      ? 'Checking Area Serviceability...'
                      : isCurrentServiceable
                      ? 'Deliverable Location'
                      : 'Outside Delivery Zone'}
                  </span>
                </div>
                <p className="text-sm font-bold text-white line-clamp-2">
                  {location?.address || 'No location selected'}
                </p>
              </div>

              {isCurrentServiceable && currentZone && (
                <div className="text-right flex-shrink-0">
                  <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-extrabold bg-indigo-600/30 border border-indigo-500/40 text-indigo-300">
                    {currentZone.code}
                  </span>
                </div>
              )}
            </div>

            {/* Zone breakdown */}
            {isCurrentServiceable && currentZone ? (
              <div className="mt-3 pt-3 border-t border-emerald-500/20 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-gray-900/60 rounded-xl p-2 border border-emerald-500/10">
                  <p className="text-[10px] text-gray-400 font-medium">Delivery Fee</p>
                  <p className="text-xs font-bold text-white">
                    {currentZone.deliveryFee === 0 ? 'FREE' : `₹${currentZone.deliveryFee}`}
                  </p>
                </div>
                <div className="bg-gray-900/60 rounded-xl p-2 border border-emerald-500/10">
                  <p className="text-[10px] text-gray-400 font-medium">Est. Time</p>
                  <p className="text-xs font-bold text-white">{currentZone.estimatedDeliveryTime}</p>
                </div>
                <div className="bg-gray-900/60 rounded-xl p-2 border border-emerald-500/10">
                  <p className="text-[10px] text-gray-400 font-medium">Min. Order</p>
                  <p className="text-xs font-bold text-white">
                    {currentZone.minOrderAmount === 0 ? 'None' : `₹${currentZone.minOrderAmount}`}
                  </p>
                </div>
              </div>
            ) : !isCheckingServiceability ? (
              <p className="mt-2 text-xs text-rose-300 font-medium leading-relaxed">
                ⚠️ We currently deliver only to Chandigarh, Mohali, Panchkula, and Zirakpur zones.
                Please select a supported address.
              </p>
            ) : null}
          </div>

          {/* GPS Quick Button */}
          <button
            type="button"
            onClick={detectCurrentLocation}
            disabled={isLoadingLocation}
            className="w-full py-3.5 px-4 rounded-2xl bg-gray-800/80 hover:bg-gray-800 border border-gray-700/80 hover:border-indigo-500/50 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all group cursor-pointer"
          >
            {isLoadingLocation ? (
              <>
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <span>Acquiring GPS Coordinates...</span>
              </>
            ) : (
              <>
                <span className="text-sm">🎯</span>
                <span>Use Current Live Location (GPS)</span>
              </>
            )}
          </button>

          {/* Selection Tabs */}
          <div className="flex border-b border-gray-800 text-xs font-bold">
            <button
              onClick={() => setActiveTab('presets')}
              className={`pb-2.5 px-4 transition-colors border-b-2 cursor-pointer ${
                activeTab === 'presets'
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              Popular Delivery Zones
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`pb-2.5 px-4 transition-colors border-b-2 cursor-pointer ${
                activeTab === 'search'
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              Search Any Address
            </button>
          </div>

          {activeTab === 'presets' && (
            <div className="space-y-2.5">
              <p className="text-xs text-gray-400 font-medium">
                Click any zone below to simulate delivery serviceability check:
              </p>
              <div className="grid grid-cols-1 gap-2.5">
                {PRESET_LOCATIONS.map((preset) => {
                  const isSelected =
                    location &&
                    Math.abs(location.lat - preset.location.lat) < 0.001 &&
                    Math.abs(location.lng - preset.location.lng) < 0.001;

                  return (
                    <button
                      key={preset.name}
                      onClick={() => handleSelectPreset(preset.location)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-950/50 border-indigo-500 text-white shadow-lg ring-1 ring-indigo-500/50'
                          : 'bg-gray-950/60 border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold mt-0.5 ${
                            preset.isServiceable
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {preset.isServiceable ? '✓' : '✗'}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs text-white">{preset.name}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-800 text-gray-300 border border-gray-700">
                              {preset.tag}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5 font-medium">{preset.zoneHint}</p>
                        </div>
                      </div>

                      {isSelected && (
                        <span className="text-xs font-extrabold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/25">
                          Selected
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'search' && (
            <div className="space-y-3">
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter street, colony, sector, or city name..."
                  className="flex-1 px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-2xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-2xl transition-colors cursor-pointer"
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="divide-y divide-gray-800 rounded-2xl border border-gray-800 bg-gray-950/60 overflow-hidden">
                  {searchResults.map((res, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectSearchResult(res)}
                      className="w-full text-left p-3 hover:bg-gray-800/60 text-xs text-gray-300 hover:text-white transition-colors flex items-start space-x-2 cursor-pointer"
                    >
                      <span className="text-indigo-400 mt-0.5">📍</span>
                      <span className="line-clamp-2">{res.address}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-800 bg-gray-950/60 flex items-center justify-between">
          <span className="text-xs text-gray-400 font-medium">
            {isCurrentServiceable
              ? `Delivery Fee: ₹${currentZone?.deliveryFee || 0} • ${
                  currentZone?.estimatedDeliveryTime || 'Fast Delivery'
                }`
              : 'Select a serviceable location to enable delivery'}
          </span>
          <button
            onClick={closeLocationModal}
            className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xl shadow-indigo-600/25 transition-all active:scale-95 cursor-pointer"
          >
            Confirm & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
