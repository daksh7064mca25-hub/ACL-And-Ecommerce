'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ProductItem, getProductImageUrl } from '@/lib/api';
import {
  loadMapsLibrary,
  loadMarkerLibrary,
  hasGoogleMapsApiKey,
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_MAP_ID,
} from '@/lib/googleMaps';

interface NearbyMapProps {
  userLocation: { lat: number; lng: number };
  radiusKm: number;
  products: ProductItem[];
  selectedProductId?: string | null;
  onSelectProduct?: (product: ProductItem) => void;
  onLocationChange?: (lat: number, lng: number) => void;
  onAddToCart?: (product: ProductItem) => void;
}

export default function NearbyMap({
  userLocation,
  radiusKm,
  products,
  selectedProductId,
  onSelectProduct,
  onLocationChange,
  onAddToCart,
}: NearbyMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const userMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const productMarkersRef = useRef<Map<string, { marker: google.maps.marker.AdvancedMarkerElement; product: ProductItem }>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Initialize Google Maps instance
  useEffect(() => {
    let isSubscribed = true;

    if (!hasGoogleMapsApiKey()) {
      setLoadError('Google Maps API key is not configured. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file to enable the interactive map.');
      return;
    }

    // Catch Google Maps authentication errors
    if (typeof window !== 'undefined') {
      (window as any).gm_authFailure = () => {
        if (isSubscribed) {
          setLoadError('Google Maps API authentication failed. Please verify your API key and enabled APIs in Google Cloud Console.');
        }
      };
    }

    async function initMap() {
      try {
        const [{ Map, Circle, InfoWindow }, { AdvancedMarkerElement }] = await Promise.all([
          loadMapsLibrary(),
          loadMarkerLibrary(),
        ]);

        if (!isSubscribed || !mapContainerRef.current) return;

        const centerPos = { lat: userLocation.lat, lng: userLocation.lng };

        const mapOptions: google.maps.MapOptions = {
          center: centerPos,
          zoom: radiusKm <= 5 ? 13 : radiusKm <= 15 ? 12 : radiusKm <= 35 ? 11 : 10,
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          zoomControl: true,
        };

        if (GOOGLE_MAPS_MAP_ID) {
          mapOptions.mapId = GOOGLE_MAPS_MAP_ID;
        }

        const map = new Map(mapContainerRef.current, mapOptions);

        // Create Custom User Location Pin Element
        const userPinEl = document.createElement('div');
        userPinEl.innerHTML = `
          <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: grab;">
            <div style="position: absolute; width: 32px; height: 32px; background: rgba(59, 130, 246, 0.35); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 20px; height: 20px; background: #3b82f6; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.5); position: relative; z-index: 10;">
            </div>
          </div>
        `;

        const userMarker = new AdvancedMarkerElement({
          map,
          position: centerPos,
          content: userPinEl,
          gmpDraggable: true,
          title: 'You are here (Drag to relocate)',
        });

        // User Marker Drag Event
        userMarker.addListener('dragend', () => {
          const position = userMarker.position;
          if (!position) return;
          const newLat = typeof position.lat === 'function' ? (position.lat as any)() : (position.lat as number);
          const newLng = typeof position.lng === 'function' ? (position.lng as any)() : (position.lng as number);

          if (newLat !== undefined && newLng !== undefined && onLocationChange) {
            onLocationChange(newLat, newLng);
          }
        });

        // Map Click to Relocate User Marker
        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const clickLat = e.latLng.lat();
          const clickLng = e.latLng.lng();
          if (onLocationChange) {
            onLocationChange(clickLat, clickLng);
          }
        });

        // Search Radius Circle (meters = km * 1000)
        const radiusCircle = new Circle({
          map,
          center: centerPos,
          radius: radiusKm * 1000,
          strokeColor: '#6366f1',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#6366f1',
          fillOpacity: 0.08,
          clickable: false,
        });

        const infoWindow = new InfoWindow({
          maxWidth: 280,
        });

        mapInstanceRef.current = map;
        userMarkerRef.current = userMarker;
        circleRef.current = radiusCircle;
        infoWindowRef.current = infoWindow;
        setIsMapLoaded(true);
      } catch (err: any) {
        if (!isSubscribed) return;
        setLoadError(
          err.message || 'Failed to initialize Google Maps.'
        );
      }
    }

    initMap();

    return () => {
      isSubscribed = false;
      if (userMarkerRef.current) {
        userMarkerRef.current.map = null;
        userMarkerRef.current = null;
      }
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update User Marker & Radius Circle when location or radius changes
  useEffect(() => {
    if (!mapInstanceRef.current || !userMarkerRef.current || !circleRef.current) return;

    const newPos = { lat: userLocation.lat, lng: userLocation.lng };
    userMarkerRef.current.position = newPos;
    circleRef.current.setCenter(newPos);
    circleRef.current.setRadius(radiusKm * 1000);

    mapInstanceRef.current.panTo(newPos);
  }, [userLocation.lat, userLocation.lng, radiusKm]);

  // Update Product Markers on Google Map
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapLoaded) return;

    loadMarkerLibrary().then(({ AdvancedMarkerElement }) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      // Clean up previous product markers
      productMarkersRef.current.forEach(({ marker }) => {
        marker.map = null;
      });
      productMarkersRef.current.clear();

      products.forEach((product) => {
        if (!product.location?.coordinates || product.location.coordinates.length !== 2) return;
        // GeoJSON format: [longitude, latitude]
        const [lng, lat] = product.location.coordinates;
        const isSelected = selectedProductId === product._id;
        const formattedPrice = `₹${Number(product.price).toFixed(0)}`;
        const distanceText =
          product.distanceInKm !== undefined
            ? `${product.distanceInKm < 1 ? (product.distanceInKm * 1000).toFixed(0) + ' m' : product.distanceInKm.toFixed(1) + ' km'}`
            : '';

        // Create Custom Product Pin Element
        const pinContainer = document.createElement('div');
        pinContainer.style.cursor = 'pointer';
        pinContainer.style.transition = 'transform 0.2s ease';
        pinContainer.style.transform = isSelected ? 'scale(1.15)' : 'scale(1)';
        pinContainer.innerHTML = `
          <div style="
            display: flex;
            align-items: center;
            gap: 4px;
            background: ${isSelected ? '#4f46e5' : '#0f172a'};
            color: #ffffff;
            padding: 4px 8px;
            border-radius: 9999px;
            border: 2px solid ${isSelected ? '#a5b4fc' : '#6366f1'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
          ">
            <span>🛍️</span>
            <span>${formattedPrice}</span>
            ${distanceText ? `<span style="font-size: 9px; opacity: 0.85; font-weight: normal;">• ${distanceText}</span>` : ''}
          </div>
        `;

        const marker = new AdvancedMarkerElement({
          map,
          position: { lat, lng },
          content: pinContainer,
          title: product.title,
        });

        // Click Marker to Open Custom InfoWindow
        marker.addListener('click', () => {
          if (onSelectProduct) {
            onSelectProduct(product);
          }
          openProductInfoWindow(product, marker);
        });

        productMarkersRef.current.set(product._id, { marker, product });
      });

      // If a product is selected externally, trigger its InfoWindow
      if (selectedProductId && productMarkersRef.current.has(selectedProductId)) {
        const item = productMarkersRef.current.get(selectedProductId)!;
        openProductInfoWindow(item.product, item.marker);
        map.panTo(item.marker.position as google.maps.LatLngLiteral);
      }
    });
  }, [products, selectedProductId, isMapLoaded, onSelectProduct]);

  // Helper function to render and open InfoWindow
  const openProductInfoWindow = (product: ProductItem, marker: google.maps.marker.AdvancedMarkerElement) => {
    if (!mapInstanceRef.current || !infoWindowRef.current) return;

    const imgUrl = product.images && product.images.length > 0 ? getProductImageUrl(product.images[0]) : '';
    const distanceText =
      product.distanceInKm !== undefined
        ? `${product.distanceInKm < 1 ? (product.distanceInKm * 1000).toFixed(0) + ' m' : product.distanceInKm.toFixed(1) + ' km'}`
        : '';

    const contentDiv = document.createElement('div');
    contentDiv.style.fontFamily = 'inherit';
    contentDiv.style.padding = '4px';
    contentDiv.style.color = '#0f172a';
    contentDiv.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px; width: 220px;">
        ${
          imgUrl
            ? `<div style="width: 100%; height: 110px; border-radius: 8px; overflow: hidden; background: #0f172a;">
                <img src="${imgUrl}" alt="${product.title}" style="width: 100%; height: 100%; object-fit: cover;" />
               </div>`
            : ''
        }
        <div style="font-size: 13px; font-weight: 700; line-height: 1.3;">${product.title}</div>
        <div style="display: flex; align-items: baseline; justify-content: space-between;">
          <span style="font-size: 15px; font-weight: 800; color: #4f46e5;">₹${Number(product.price).toFixed(2)}</span>
          <span style="font-size: 11px; font-weight: 600; color: ${product.quantity > 0 ? '#16a34a' : '#dc2626'};">
            ${product.quantity > 0 ? `In Stock (${product.quantity})` : 'Out of Stock'}
          </span>
        </div>
        ${
          distanceText
            ? `<div style="font-size: 11px; color: #64748b; display: flex; align-items: center; gap: 4px;">
                <span>📍</span> <span><strong>${distanceText}</strong> from you</span>
               </div>`
            : ''
        }
        ${
          product.location?.city || product.location?.formattedAddress
            ? `<div style="font-size: 10px; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                🏙️ ${product.location.city || product.location.formattedAddress}
               </div>`
            : ''
        }
        <div style="display: flex; gap: 6px; margin-top: 4px;">
          <a href="/products/${product._id}" style="
            flex: 1;
            text-align: center;
            padding: 6px 8px;
            background: #f1f5f9;
            color: #334155;
            font-size: 11px;
            font-weight: 600;
            border-radius: 6px;
            text-decoration: none;
            border: 1px solid #cbd5e1;
          ">View Details</a>
          <button id="gmap-add-btn-${product._id}" ${product.quantity <= 0 ? 'disabled' : ''} style="
            flex: 1;
            padding: 6px 8px;
            background: ${product.quantity <= 0 ? '#94a3b8' : '#4f46e5'};
            color: #ffffff;
            font-size: 11px;
            font-weight: 600;
            border-radius: 6px;
            border: none;
            cursor: ${product.quantity <= 0 ? 'not-allowed' : 'pointer'};
          ">Add to Cart</button>
        </div>
      </div>
    `;

    // Hook Add to Cart button to existing CartContext
    const addBtn = contentDiv.querySelector(`#gmap-add-btn-${product._id}`);
    if (addBtn && product.quantity > 0) {
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onAddToCart) {
          onAddToCart(product);
          addBtn.textContent = '✓ Added!';
          (addBtn as HTMLElement).style.background = '#16a34a';
          setTimeout(() => {
            addBtn.textContent = 'Add to Cart';
            (addBtn as HTMLElement).style.background = '#4f46e5';
          }, 2000);
        }
      });
    }

    infoWindowRef.current.setContent(contentDiv);
    infoWindowRef.current.open({
      anchor: marker,
      map: mapInstanceRef.current,
    });
  };

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden border border-gray-800 shadow-xl bg-gray-950">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Loading Overlay */}
      {!isMapLoaded && !loadError && (
        <div className="absolute inset-0 bg-gray-950/90 flex flex-col items-center justify-center gap-3 z-10">
          <div className="w-8 h-8 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin" />
          <p className="text-xs text-gray-400 font-medium">Loading Google Maps...</p>
        </div>
      )}

      {/* Notice / Setup Guidance Overlay */}
      {loadError && (
        <div className="absolute inset-0 bg-gray-950/95 p-6 flex flex-col items-center justify-center text-center z-10">
          <div className="text-3xl mb-2">🗺️</div>
          <h4 className="text-sm font-bold text-gray-100">Google Maps Platform Setup</h4>
          <p className="text-xs text-gray-400 max-w-md mt-1.5 leading-relaxed">{loadError}</p>
          <div className="mt-4 p-3 bg-gray-900 border border-gray-800 rounded-xl text-[11px] text-indigo-400 max-w-md text-left font-mono">
            NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            ✓ Product search, list discovery, and distance filters remain functional.
          </p>
        </div>
      )}

      {/* Map Legend Overlay */}
      {isMapLoaded && (
        <div className="absolute top-4 left-4 z-10 bg-gray-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-gray-800 text-[11px] text-gray-300 shadow-lg flex flex-col gap-1 pointer-events-none">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white inline-block"></span>
            <span className="font-semibold text-white">Your Location (Drag to move)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block"></span>
            <span>{radiusKm} km search radius ({products.length} products found)</span>
          </div>
        </div>
      )}
    </div>
  );
}
