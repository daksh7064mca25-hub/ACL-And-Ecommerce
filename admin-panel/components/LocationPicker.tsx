'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ProductLocation } from '@/lib/api';
import {
  loadMapsLibrary,
  loadPlacesLibrary,
  loadMarkerLibrary,
  reverseGeocodeLatLng,
  extractAddressComponents,
  hasGoogleMapsApiKey,
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_MAP_ID,
} from '@/lib/googleMaps';

interface LocationPickerProps {
  value?: ProductLocation | null;
  onChange: (location: ProductLocation) => void;
}

const PRESET_CITIES = [
  { name: 'Chandigarh', lat: 30.7333, lng: 76.7794, address: 'Sector 17, Chandigarh, India' },
  { name: 'Mohali', lat: 30.7046, lng: 76.7179, address: 'Sector 62, Mohali, Punjab, India' },
  { name: 'Panchkula', lat: 30.6942, lng: 76.8606, address: 'Sector 5, Panchkula, Haryana, India' },
  { name: 'Delhi NCR', lat: 28.6139, lng: 77.209, address: 'Connaught Place, New Delhi, India' },
  { name: 'Mumbai', lat: 19.076, lng: 72.8777, address: 'Bandra West, Mumbai, Maharashtra, India' },
  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946, address: 'MG Road, Bengaluru, Karnataka, India' },
];

export default function LocationPicker({ value, onChange }: LocationPickerProps) {
  // GeoJSON coordinates are [longitude, latitude]
  const initialLat = value?.coordinates && value.coordinates.length === 2 ? value.coordinates[1] : 30.7333;
  const initialLng = value?.coordinates && value.coordinates.length === 2 ? value.coordinates[0] : 76.7794;

  const [lat, setLat] = useState<number>(initialLat);
  const [lng, setLng] = useState<number>(initialLng);
  const [formattedAddress, setFormattedAddress] = useState<string>(value?.formattedAddress || 'Sector 17, Chandigarh, India');
  const [city, setCity] = useState<string>(value?.city || 'Chandigarh');
  const [stateName, setStateName] = useState<string>(value?.state || 'Chandigarh');
  const [country, setCountry] = useState<string>(value?.country || 'India');
  const [postalCode, setPostalCode] = useState<string>(value?.postalCode || '');

  const [isLocating, setIsLocating] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const autocompleteInputRef = useRef<HTMLInputElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Sync internal state with external value when value changes
  useEffect(() => {
    if (value?.coordinates && value.coordinates.length === 2) {
      const [newLng, newLat] = value.coordinates;
      setLat(newLat);
      setLng(newLng);
      if (value.formattedAddress) setFormattedAddress(value.formattedAddress);
      if (value.city) setCity(value.city);
      if (value.state) setStateName(value.state);
      if (value.country) setCountry(value.country);
      if (value.postalCode) setPostalCode(value.postalCode);

      if (mapInstanceRef.current && markerRef.current) {
        const pos = { lat: newLat, lng: newLng };
        mapInstanceRef.current.setCenter(pos);
        markerRef.current.position = pos;
      }
    }
  }, [value]);

  // Emit updated location in GeoJSON [longitude, latitude] format
  const emitLocation = useCallback(
    (
      newLat: number,
      newLng: number,
      details?: {
        formattedAddress?: string;
        city?: string;
        state?: string;
        country?: string;
        postalCode?: string;
      }
    ) => {
      const updated: ProductLocation = {
        type: 'Point',
        coordinates: [Number(newLng.toFixed(6)), Number(newLat.toFixed(6))], // [longitude, latitude]
        formattedAddress: details?.formattedAddress ?? formattedAddress,
        city: details?.city ?? city,
        state: details?.state ?? stateName,
        country: details?.country ?? country,
        postalCode: details?.postalCode ?? postalCode,
      };
      onChange(updated);
    },
    [city, country, formattedAddress, onChange, postalCode, stateName]
  );

  // Initialize Google Maps & Autocomplete
  useEffect(() => {
    let isSubscribed = true;

    if (!hasGoogleMapsApiKey()) {
      setLoadError('Google Maps API key is not configured. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file to enable the interactive map.');
      return;
    }

    // Catch Google Maps authentication errors gracefully
    if (typeof window !== 'undefined') {
      (window as any).gm_authFailure = () => {
        if (isSubscribed) {
          setLoadError('Google Maps API authentication failed. Please verify your API key and enabled APIs in Google Cloud Console.');
        }
      };
    }

    async function initMap() {
      try {
        const [{ Map }, { AdvancedMarkerElement }, { Autocomplete }] = await Promise.all([
          loadMapsLibrary(),
          loadMarkerLibrary(),
          loadPlacesLibrary(),
        ]);

        if (!isSubscribed || !mapContainerRef.current) return;

        const centerPos = { lat, lng };

        const mapOptions: google.maps.MapOptions = {
          center: centerPos,
          zoom: 14,
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
        };

        if (GOOGLE_MAPS_MAP_ID) {
          mapOptions.mapId = GOOGLE_MAPS_MAP_ID;
        }

        const map = new Map(mapContainerRef.current, mapOptions);

        // Create Advanced Marker (modern Google Maps marker)
        const marker = new AdvancedMarkerElement({
          map,
          position: centerPos,
          gmpDraggable: true,
          title: 'Product Location (Drag to update)',
        });

        // Marker drag event
        marker.addListener('dragend', async () => {
          const position = marker.position;
          if (!position) return;
          const markerLat = typeof position.lat === 'function' ? (position.lat as any)() : (position.lat as number);
          const markerLng = typeof position.lng === 'function' ? (position.lng as any)() : (position.lng as number);

          if (markerLat !== undefined && markerLng !== undefined) {
            setLat(markerLat);
            setLng(markerLng);
            const addressInfo = await reverseGeocodeLatLng(markerLat, markerLng);
            if (addressInfo) {
              setFormattedAddress(addressInfo.formattedAddress);
              setCity(addressInfo.city);
              setStateName(addressInfo.state);
              setCountry(addressInfo.country);
              setPostalCode(addressInfo.postalCode);
              emitLocation(markerLat, markerLng, addressInfo);
            } else {
              emitLocation(markerLat, markerLng);
            }
          }
        });

        // Map click event
        map.addListener('click', async (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const clickLat = e.latLng.lat();
          const clickLng = e.latLng.lng();

          marker.position = { lat: clickLat, lng: clickLng };
          setLat(clickLat);
          setLng(clickLng);

          const addressInfo = await reverseGeocodeLatLng(clickLat, clickLng);
          if (addressInfo) {
            setFormattedAddress(addressInfo.formattedAddress);
            setCity(addressInfo.city);
            setStateName(addressInfo.state);
            setCountry(addressInfo.country);
            setPostalCode(addressInfo.postalCode);
            emitLocation(clickLat, clickLng, addressInfo);
          } else {
            emitLocation(clickLat, clickLng);
          }
        });

        // Initialize Places Autocomplete on input
        if (autocompleteInputRef.current) {
          const autocomplete = new Autocomplete(autocompleteInputRef.current, {
            fields: ['geometry', 'formatted_address', 'address_components', 'name'],
          });

          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (!place.geometry || !place.geometry.location) {
              return;
            }

            const newLat = place.geometry.location.lat();
            const newLng = place.geometry.location.lng();

            map.setCenter({ lat: newLat, lng: newLng });
            map.setZoom(15);
            marker.position = { lat: newLat, lng: newLng };

            setLat(newLat);
            setLng(newLng);

            const parsed = extractAddressComponents(place);
            setFormattedAddress(parsed.formattedAddress || place.name || '');
            if (parsed.city) setCity(parsed.city);
            if (parsed.state) setStateName(parsed.state);
            if (parsed.country) setCountry(parsed.country);
            if (parsed.postalCode) setPostalCode(parsed.postalCode);

            emitLocation(newLat, newLng, parsed);
          });

          autocompleteRef.current = autocomplete;
        }

        mapInstanceRef.current = map;
        markerRef.current = marker;
        setIsMapLoaded(true);
      } catch (err: any) {
        if (!isSubscribed) return;
        setLoadError(
          err.message || 'Failed to initialize Google Maps component.'
        );
      }
    }

    initMap();

    return () => {
      isSubscribed = false;
      if (markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      }
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Preset City Click
  const handleSelectPresetCity = async (preset: { name: string; lat: number; lng: number; address: string }) => {
    setLat(preset.lat);
    setLng(preset.lng);
    setFormattedAddress(preset.address);
    setCity(preset.name);

    if (mapInstanceRef.current && markerRef.current) {
      const pos = { lat: preset.lat, lng: preset.lng };
      mapInstanceRef.current.setCenter(pos);
      mapInstanceRef.current.setZoom(14);
      markerRef.current.position = pos;
    }

    const addressInfo = await reverseGeocodeLatLng(preset.lat, preset.lng);
    if (addressInfo) {
      setFormattedAddress(addressInfo.formattedAddress);
      setCity(addressInfo.city || preset.name);
      setStateName(addressInfo.state);
      setCountry(addressInfo.country);
      setPostalCode(addressInfo.postalCode);
      emitLocation(preset.lat, preset.lng, addressInfo);
    } else {
      emitLocation(preset.lat, preset.lng, {
        formattedAddress: preset.address,
        city: preset.name,
      });
    }
  };

  // Handle Browser Geolocation
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);

        if (mapInstanceRef.current && markerRef.current) {
          const newPos = { lat: latitude, lng: longitude };
          mapInstanceRef.current.setCenter(newPos);
          mapInstanceRef.current.setZoom(15);
          markerRef.current.position = newPos;
        }

        const addressInfo = await reverseGeocodeLatLng(latitude, longitude);
        if (addressInfo) {
          setFormattedAddress(addressInfo.formattedAddress);
          setCity(addressInfo.city);
          setStateName(addressInfo.state);
          setCountry(addressInfo.country);
          setPostalCode(addressInfo.postalCode);
          emitLocation(latitude, longitude, addressInfo);
        } else {
          emitLocation(latitude, longitude);
        }
      },
      (err) => {
        setIsLocating(false);
        alert(
          err.code === 1
            ? 'Location access denied. Please select a city or search for an address.'
            : 'Unable to retrieve location. Please search manually.'
        );
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Handle Manual Lat/Lng coordinate blur or enter
  const handleManualCoordUpdate = async () => {
    if (isNaN(lat) || isNaN(lng)) return;
    if (mapInstanceRef.current && markerRef.current) {
      const pos = { lat, lng };
      mapInstanceRef.current.setCenter(pos);
      markerRef.current.position = pos;
    }

    const addressInfo = await reverseGeocodeLatLng(lat, lng);
    if (addressInfo) {
      setFormattedAddress(addressInfo.formattedAddress);
      setCity(addressInfo.city);
      setStateName(addressInfo.state);
      setCountry(addressInfo.country);
      setPostalCode(addressInfo.postalCode);
      emitLocation(lat, lng, addressInfo);
    } else {
      emitLocation(lat, lng);
    }
  };

  return (
    <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <label className="block text-xs font-bold text-slate-800">
            Product Geographical Location <span className="text-rose-500">*</span>
          </label>
          <p className="text-[11px] text-slate-500">
            Assign coordinates using Google Places search, dragging the marker, or GPS.
          </p>
        </div>

        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        >
          {isLocating ? (
            <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>🎯</span>
          )}
          <span>Detect GPS Location</span>
        </button>
      </div>

      {/* Google Places Autocomplete Input */}
      <div className="relative">
        <input
          ref={autocompleteInputRef}
          type="text"
          placeholder={
            hasGoogleMapsApiKey()
              ? 'Search location using Google Places (e.g. Sector 17, Chandigarh)...'
              : 'Google Places search (Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)'
          }
          disabled={!hasGoogleMapsApiKey()}
          className="w-full pl-3.5 pr-10 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs disabled:bg-slate-100 disabled:text-slate-400"
        />
        <span className="absolute right-3 top-2.5 text-xs text-slate-400">🔍</span>
      </div>

      {/* City Presets */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-slate-500 font-semibold uppercase">Presets:</span>
        {PRESET_CITIES.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => handleSelectPresetCity(c)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              city.toLowerCase().includes(c.name.toLowerCase())
                ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Google Map Container */}
      <div className="relative w-full h-56 rounded-xl overflow-hidden border border-slate-300 bg-slate-100 shadow-inner">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Loading Overlay */}
        {!isMapLoaded && !loadError && (
          <div className="absolute inset-0 bg-slate-100/90 flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-600 font-medium">Loading Google Maps...</span>
          </div>
        )}

        {/* Error Overlay / Guidance */}
        {loadError && (
          <div className="absolute inset-0 bg-slate-50/95 p-5 flex flex-col items-center justify-center text-center">
            <div className="text-indigo-600 text-2xl mb-1.5">🗺️</div>
            <p className="text-xs font-bold text-slate-800">Google Maps Platform Setup Required</p>
            <p className="text-[11px] text-slate-600 max-w-sm mt-1">{loadError}</p>
            <div className="mt-2.5 p-2 bg-slate-100 border border-slate-200 rounded-lg text-[10px] text-indigo-700 font-mono">
              NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">
              ✓ Manual coordinate inputs & city presets below remain fully active.
            </p>
          </div>
        )}
      </div>

      {/* Coordinates & Structured Address Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            Latitude (°N)
          </label>
          <input
            type="number"
            step="0.000001"
            value={lat}
            onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
            onBlur={handleManualCoordUpdate}
            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            Longitude (°E)
          </label>
          <input
            type="number"
            step="0.000001"
            value={lng}
            onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
            onBlur={handleManualCoordUpdate}
            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 font-mono"
          />
        </div>
      </div>

      {/* Resolved Address & City Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            Formatted Address
          </label>
          <input
            type="text"
            value={formattedAddress}
            onChange={(e) => {
              setFormattedAddress(e.target.value);
              emitLocation(lat, lng, { formattedAddress: e.target.value });
            }}
            placeholder="e.g. Sector 17, Chandigarh"
            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            City / Area
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              emitLocation(lat, lng, { city: e.target.value });
            }}
            placeholder="e.g. Chandigarh"
            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* GeoJSON Preview Badge */}
      <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-lg text-[11px] text-slate-600 flex items-center justify-between">
        <span className="font-semibold text-indigo-950">
          📍 GeoJSON Point: [{lng.toFixed(4)}, {lat.toFixed(4)}]
        </span>
        <span className="text-[10px] text-indigo-600 font-mono">
          {city || 'Location selected'} • 2dsphere
        </span>
      </div>
    </div>
  );
}
