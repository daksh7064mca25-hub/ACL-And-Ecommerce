'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  loadMapsLibrary,
  loadMarkerLibrary,
  hasGoogleMapsApiKey,
  GOOGLE_MAPS_MAP_ID,
} from '@/lib/googleMaps';

interface AdminLiveTrackingMapProps {
  destination?: {
    lat: number;
    lng: number;
    formattedAddress?: string;
  } | null;
  riderLocation?: {
    lat: number;
    lng: number;
    accuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
    timestamp?: number;
  } | null;
  riderName?: string;
  deliveryStatus?: string;
  lastUpdated?: string | number | null;
  isCompleted?: boolean;
}

/**
 * Validate geographic coordinates
 */
function isValidCoord(lat?: number | null, lng?: number | null): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Haversine distance in kilometers
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function AdminLiveTrackingMap({
  destination,
  riderLocation,
  riderName = 'Rider',
  deliveryStatus = 'assigned',
  lastUpdated,
  isCompleted = false,
}: AdminLiveTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const destMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const riderMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const routeLineRef = useRef<google.maps.Polyline | null>(null);

  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  const hasValidDest = isValidCoord(destination?.lat, destination?.lng);
  const hasValidRider = isValidCoord(riderLocation?.lat, riderLocation?.lng);

  // Compute live distance
  useEffect(() => {
    if (hasValidRider && hasValidDest && riderLocation && destination) {
      const dist = calculateHaversineDistance(
        riderLocation.lat,
        riderLocation.lng,
        destination.lat,
        destination.lng
      );
      setDistanceKm(dist);
    } else {
      setDistanceKm(null);
    }
  }, [hasValidRider, hasValidDest, riderLocation?.lat, riderLocation?.lng, destination?.lat, destination?.lng]);

  // Initialize Google Map once
  useEffect(() => {
    let isSubscribed = true;

    if (!hasGoogleMapsApiKey()) {
      setLoadError('Google Maps API Key is missing. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in admin-panel/.env.local.');
      return;
    }

    if (typeof window !== 'undefined') {
      (window as any).gm_authFailure = () => {
        if (isSubscribed) {
          setLoadError('Google Maps API authentication failed. Verify API key and billing.');
        }
      };
    }

    async function initMap() {
      try {
        const [{ Map, Polyline }, { AdvancedMarkerElement }] = await Promise.all([
          loadMapsLibrary(),
          loadMarkerLibrary(),
        ]);

        if (!isSubscribed || !mapContainerRef.current) return;

        // Determine initial center
        let defaultCenter = { lat: 30.7333, lng: 76.7794 };
        let defaultZoom = 13;

        if (hasValidRider && hasValidDest && riderLocation && destination) {
          defaultCenter = {
            lat: (riderLocation.lat + destination.lat) / 2,
            lng: (riderLocation.lng + destination.lng) / 2,
          };
        } else if (hasValidRider && riderLocation) {
          defaultCenter = { lat: riderLocation.lat, lng: riderLocation.lng };
          defaultZoom = 15;
        } else if (hasValidDest && destination) {
          defaultCenter = { lat: destination.lat, lng: destination.lng };
          defaultZoom = 14;
        }

        const mapOptions: google.maps.MapOptions = {
          center: defaultCenter,
          zoom: defaultZoom,
          fullscreenControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          zoomControl: true,
        };

        if (GOOGLE_MAPS_MAP_ID) {
          mapOptions.mapId = GOOGLE_MAPS_MAP_ID;
        }

        const map = new Map(mapContainerRef.current, mapOptions);
        mapInstanceRef.current = map;

        // 1. Destination Marker (Customer Destination)
        if (hasValidDest && destination) {
          const destPinEl = document.createElement('div');
          destPinEl.className = 'admin-dest-marker';
          destPinEl.innerHTML = `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
              <div style="background: #10b981; color: white; padding: 3px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; box-shadow: 0 4px 12px rgba(16,185,129,0.5); display: flex; align-items: center; gap: 4px; white-space: nowrap; margin-bottom: 2px;">
                <span>🏠</span> Destination
              </div>
              <div style="width: 14px; height: 14px; background: #10b981; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.5);"></div>
            </div>
          `;

          const destMarker = new AdvancedMarkerElement({
            map,
            position: { lat: destination.lat, lng: destination.lng },
            content: destPinEl,
            title: destination.formattedAddress || 'Delivery Destination',
          });
          destMarkerRef.current = destMarker;
        }

        // 2. Rider Marker
        if (hasValidRider && riderLocation) {
          const riderPinEl = document.createElement('div');
          riderPinEl.className = 'admin-rider-marker';
          const isDeliveredState = isCompleted || deliveryStatus === 'delivered';
          riderPinEl.innerHTML = `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
              ${!isDeliveredState ? '<div style="position: absolute; width: 40px; height: 40px; background: rgba(249, 115, 22, 0.35); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; top: 6px;"></div>' : ''}
              <div style="background: linear-gradient(135deg, #ea580c, #f97316); color: white; padding: 3px 9px; border-radius: 9999px; font-size: 10px; font-weight: 800; box-shadow: 0 4px 12px rgba(249,115,22,0.6); display: flex; align-items: center; gap: 4px; white-space: nowrap; margin-bottom: 2px; z-index: 10;">
                <span>🛵</span> ${riderName}
              </div>
              <div style="width: 20px; height: 20px; background: #ea580c; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.5); position: relative; z-index: 10; display: flex; align-items: center; justify-content: center;">
                <div style="width: 5px; height: 5px; background: #ffffff; border-radius: 50%;"></div>
              </div>
            </div>
          `;

          const riderMarker = new AdvancedMarkerElement({
            map,
            position: { lat: riderLocation.lat, lng: riderLocation.lng },
            content: riderPinEl,
            title: `Rider: ${riderName}`,
          });
          riderMarkerRef.current = riderMarker;

          // 3. Polyline Route
          if (hasValidDest && destination) {
            const line = new Polyline({
              path: [
                { lat: riderLocation.lat, lng: riderLocation.lng },
                { lat: destination.lat, lng: destination.lng },
              ],
              geodesic: true,
              strokeColor: '#f97316',
              strokeOpacity: 0.85,
              strokeWeight: 3,
              icons: [
                {
                  icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2.5, strokeColor: '#ea580c' },
                  offset: '50%',
                },
              ],
            });
            line.setMap(map);
            routeLineRef.current = line;

            // Fit Bounds
            const bounds = new google.maps.LatLngBounds();
            bounds.extend({ lat: destination.lat, lng: destination.lng });
            bounds.extend({ lat: riderLocation.lat, lng: riderLocation.lng });
            map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
          }
        }

        if (isSubscribed) {
          setIsMapLoaded(true);
        }
      } catch (err: any) {
        console.error('[AdminLiveTrackingMap] Map init error:', err);
        if (isSubscribed) {
          setLoadError(err.message || 'Failed to initialize Google Maps');
        }
      }
    }

    initMap();

    return () => {
      isSubscribed = false;
      if (routeLineRef.current) routeLineRef.current.setMap(null);
    };
  }, [hasValidDest, destination?.lat, destination?.lng]);

  // Smoothly update Rider Marker position without recreating the map
  useEffect(() => {
    if (!hasValidRider || !riderLocation || !mapInstanceRef.current) return;

    const newPos = { lat: riderLocation.lat, lng: riderLocation.lng };

    if (riderMarkerRef.current) {
      riderMarkerRef.current.position = newPos;
    } else {
      loadMarkerLibrary().then(({ AdvancedMarkerElement }) => {
        if (!mapInstanceRef.current) return;

        const riderPinEl = document.createElement('div');
        riderPinEl.className = 'admin-rider-marker';
        const isDeliveredState = isCompleted || deliveryStatus === 'delivered';
        riderPinEl.innerHTML = `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
            ${!isDeliveredState ? '<div style="position: absolute; width: 40px; height: 40px; background: rgba(249, 115, 22, 0.35); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; top: 6px;"></div>' : ''}
            <div style="background: linear-gradient(135deg, #ea580c, #f97316); color: white; padding: 3px 9px; border-radius: 9999px; font-size: 10px; font-weight: 800; box-shadow: 0 4px 12px rgba(249,115,22,0.6); display: flex; align-items: center; gap: 4px; white-space: nowrap; margin-bottom: 2px; z-index: 10;">
              <span>🛵</span> ${riderName}
            </div>
            <div style="width: 20px; height: 20px; background: #ea580c; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.5); position: relative; z-index: 10; display: flex; align-items: center; justify-content: center;">
              <div style="width: 5px; height: 5px; background: #ffffff; border-radius: 50%;"></div>
            </div>
          </div>
        `;

        const riderMarker = new AdvancedMarkerElement({
          map: mapInstanceRef.current,
          position: newPos,
          content: riderPinEl,
          title: `Rider: ${riderName}`,
        });
        riderMarkerRef.current = riderMarker;
      });
    }

    // Update polyline path if destination exists
    if (routeLineRef.current && hasValidDest && destination) {
      routeLineRef.current.setPath([
        newPos,
        { lat: destination.lat, lng: destination.lng },
      ]);
    }

    // Pan bounds smoothly
    if (mapInstanceRef.current && hasValidDest && destination) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: destination.lat, lng: destination.lng });
      bounds.extend(newPos);
      mapInstanceRef.current.panToBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
    } else if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo(newPos);
    }
  }, [hasValidRider, riderLocation?.lat, riderLocation?.lng, hasValidDest, destination?.lat, destination?.lng, riderName, isCompleted, deliveryStatus]);

  const isDeliveredState = isCompleted || deliveryStatus === 'delivered';

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
      {/* Map Canvas */}
      <div
        ref={mapContainerRef}
        className="w-full h-[320px] bg-slate-950"
        style={{ minHeight: '300px' }}
      />

      {/* Loading Overlay */}
      {!isMapLoaded && !loadError && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs text-slate-300 font-semibold">Initializing Google Satellite & Street Maps...</p>
        </div>
      )}

      {/* Map Error / Fallback State */}
      {loadError && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-xl text-amber-400 mb-2">
            🗺️
          </div>
          <h4 className="text-sm font-bold text-white mb-1">Live Telemetry Map Unavailable</h4>
          <p className="text-xs text-slate-400 max-w-md mb-4">{loadError}</p>

          <div className="grid grid-cols-2 gap-3 w-full max-w-sm bg-slate-900 p-3 rounded-xl border border-slate-800 text-left">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Rider Coords</span>
              <span className="text-xs font-mono font-bold text-orange-400">
                {hasValidRider && riderLocation ? `${riderLocation.lat.toFixed(5)}, ${riderLocation.lng.toFixed(5)}` : 'Awaiting GPS...'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Destination</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {hasValidDest && destination ? `${destination.lat.toFixed(5)}, ${destination.lng.toFixed(5)}` : 'Not specified'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Top Floating Telemetry Overlay Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Distance / Arrival Pill */}
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-xl px-3 py-1.5 shadow-lg flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isDeliveredState ? 'bg-emerald-400' : 'bg-emerald-400 animate-pulse'}`}></div>
          <div className="text-xs text-white font-bold flex items-center gap-1.5">
            {isDeliveredState ? (
              <span className="text-emerald-400">Arrived at Destination ✓</span>
            ) : distanceKm !== null ? (
              <>
                <span className="text-slate-400 font-normal">Distance:</span>
                <span>{distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(2)} km`}</span>
              </>
            ) : !hasValidDest ? (
              <span className="text-slate-400 text-[11px]">Destination coords not specified</span>
            ) : (
              <span className="text-slate-400 text-[11px]">Calculating distance...</span>
            )}
          </div>
        </div>

        {/* Status Pill */}
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-xl px-3 py-1.5 shadow-lg flex items-center gap-2">
          <span className="text-xs">{isDeliveredState ? '🎉' : '🛵'}</span>
          <span className={`text-[11px] font-bold uppercase ${isDeliveredState ? 'text-emerald-400' : 'text-orange-400'}`}>
            {isDeliveredState ? 'DELIVERED' : deliveryStatus.replace(/_/g, ' ')}
          </span>
          {lastUpdated && (
            <span className="text-[10px] text-slate-400 font-mono">
              {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
