'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  loadMapsLibrary,
  loadMarkerLibrary,
  hasGoogleMapsApiKey,
  GOOGLE_MAPS_MAP_ID,
} from '@/lib/googleMaps';

interface LiveTrackingMapProps {
  destination: {
    lat: number;
    lng: number;
    formattedAddress?: string;
  };
  riderLocation: {
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
 * Haversine formula to compute great-circle distance between two GPS coordinates in kilometers
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
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

export default function LiveTrackingMap({
  destination,
  riderLocation,
  riderName = 'Rider',
  deliveryStatus = 'assigned',
  lastUpdated,
  isCompleted = false,
}: LiveTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const destMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const riderMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const routeLineRef = useRef<google.maps.Polyline | null>(null);

  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [approxEtaMinutes, setApproxEtaMinutes] = useState<number | null>(null);

  // Compute live distance and approximate ETA
  useEffect(() => {
    if (riderLocation?.lat && riderLocation?.lng && destination?.lat && destination?.lng) {
      const dist = calculateHaversineDistance(
        riderLocation.lat,
        riderLocation.lng,
        destination.lat,
        destination.lng
      );
      setDistanceKm(dist);

      // Approximate speed: 25 km/h in urban delivery traffic + 2 min buffer
      const eta = Math.max(1, Math.round((dist / 25) * 60) + 2);
      setApproxEtaMinutes(eta);
    } else {
      setDistanceKm(null);
      setApproxEtaMinutes(null);
    }
  }, [riderLocation, destination]);

  // Initialize Map
  useEffect(() => {
    let isSubscribed = true;

    if (!hasGoogleMapsApiKey()) {
      setLoadError('Google Maps API Key is missing. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your environment to view the live satellite map.');
      return;
    }

    if (typeof window !== 'undefined') {
      (window as any).gm_authFailure = () => {
        if (isSubscribed) {
          setLoadError('Google Maps API authentication failed. Please check your API key.');
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

        const defaultCenter = riderLocation
          ? { lat: (riderLocation.lat + destination.lat) / 2, lng: (riderLocation.lng + destination.lng) / 2 }
          : { lat: destination.lat, lng: destination.lng };

        const mapOptions: google.maps.MapOptions = {
          center: defaultCenter,
          zoom: 14,
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          zoomControl: true,
        };

        if (GOOGLE_MAPS_MAP_ID) {
          mapOptions.mapId = GOOGLE_MAPS_MAP_ID;
        }

        const map = new Map(mapContainerRef.current, mapOptions);
        mapInstanceRef.current = map;

        // 1. Destination Marker (Customer Home)
        const destPinEl = document.createElement('div');
        destPinEl.className = 'destination-marker-pin';
        destPinEl.innerHTML = `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
            <div style="background: #10b981; color: white; padding: 4px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; box-shadow: 0 4px 12px rgba(16,185,129,0.5); display: flex; align-items: center; gap: 4px; white-space: nowrap; margin-bottom: 2px;">
              <span>🏠</span> You
            </div>
            <div style="width: 14px; height: 14px; background: #10b981; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.4);"></div>
          </div>
        `;

        const destMarker = new AdvancedMarkerElement({
          map,
          position: { lat: destination.lat, lng: destination.lng },
          content: destPinEl,
          title: destination.formattedAddress || 'Your Delivery Address',
        });
        destMarkerRef.current = destMarker;

        // 2. Rider Marker (Moving Delivery Scooter)
        if (riderLocation) {
          const riderPinEl = document.createElement('div');
          riderPinEl.className = 'rider-marker-pin';
          riderPinEl.innerHTML = `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
              <div style="position: absolute; width: 44px; height: 44px; background: rgba(249, 115, 22, 0.35); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; top: 8px;"></div>
              <div style="background: linear-gradient(135deg, #ea580c, #f97316); color: white; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 800; box-shadow: 0 4px 14px rgba(249,115,22,0.6); display: flex; align-items: center; gap: 5px; white-space: nowrap; margin-bottom: 2px; z-index: 10;">
                <span>🛵</span> ${riderName}
              </div>
              <div style="width: 22px; height: 22px; background: #ea580c; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.5); position: relative; z-index: 10; display: flex; align-items: center; justify-content: center;">
                <div style="width: 6px; height: 6px; background: #ffffff; border-radius: 50%;"></div>
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

          // 3. Connect Polyline between Rider and Customer
          const line = new Polyline({
            path: [
              { lat: riderLocation.lat, lng: riderLocation.lng },
              { lat: destination.lat, lng: destination.lng },
            ],
            geodesic: true,
            strokeColor: '#f97316',
            strokeOpacity: 0.8,
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

          // Fit Bounds so both markers are nicely visible
          const bounds = new google.maps.LatLngBounds();
          bounds.extend({ lat: destination.lat, lng: destination.lng });
          bounds.extend({ lat: riderLocation.lat, lng: riderLocation.lng });
          map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
        }

        if (isSubscribed) {
          setIsMapLoaded(true);
        }
      } catch (err: any) {
        console.error('[LiveTrackingMap] Map init error:', err);
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
  }, [destination.lat, destination.lng]);

  // Real-time update of Rider Marker position when GPS coordinates arrive via Socket.IO
  useEffect(() => {
    if (!riderLocation || !mapInstanceRef.current) return;

    const newPos = { lat: riderLocation.lat, lng: riderLocation.lng };

    // Update existing marker position smoothly
    if (riderMarkerRef.current) {
      riderMarkerRef.current.position = newPos;
    } else {
      // Create rider marker if it didn't exist yet
      loadMarkerLibrary().then(({ AdvancedMarkerElement }) => {
        if (!mapInstanceRef.current) return;

        const riderPinEl = document.createElement('div');
        riderPinEl.className = 'rider-marker-pin';
        riderPinEl.innerHTML = `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <div style="position: absolute; width: 44px; height: 44px; background: rgba(249, 115, 22, 0.35); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; top: 8px;"></div>
            <div style="background: linear-gradient(135deg, #ea580c, #f97316); color: white; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 800; box-shadow: 0 4px 14px rgba(249,115,22,0.6); display: flex; align-items: center; gap: 5px; white-space: nowrap; margin-bottom: 2px; z-index: 10;">
              <span>🛵</span> ${riderName}
            </div>
            <div style="width: 22px; height: 22px; background: #ea580c; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.5); position: relative; z-index: 10; display: flex; align-items: center; justify-content: center;">
              <div style="width: 6px; height: 6px; background: #ffffff; border-radius: 50%;"></div>
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

    // Update Polyline trajectory
    if (routeLineRef.current) {
      routeLineRef.current.setPath([
        newPos,
        { lat: destination.lat, lng: destination.lng },
      ]);
    }

    // Adjust map view bounds smoothly if rider moves significantly
    if (mapInstanceRef.current) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: destination.lat, lng: destination.lng });
      bounds.extend(newPos);
      mapInstanceRef.current.panToBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
    }
  }, [riderLocation?.lat, riderLocation?.lng, destination.lat, destination.lng, riderName]);

  return (
    <div className="relative w-full rounded-3xl overflow-hidden border border-gray-800 bg-gray-950 shadow-2xl">
      {/* Real-time Map Canvas */}
      <div
        ref={mapContainerRef}
        className="w-full h-[420px] md:h-[480px] bg-gray-900"
        style={{ minHeight: '380px' }}
      />

      {/* Map Fallback / Error State */}
      {loadError && (
        <div className="absolute inset-0 bg-gray-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl text-amber-400 mb-3">
            🗺️
          </div>
          <h4 className="text-base font-bold text-white mb-1">Live GPS Radar Active</h4>
          <p className="text-xs text-gray-400 max-w-md mb-4">{loadError}</p>

          {/* Real-time Coordinates Card Fallback */}
          <div className="grid grid-cols-2 gap-3 w-full max-w-md bg-gray-900/80 p-4 rounded-2xl border border-gray-800 text-left">
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Rider Position</span>
              <span className="text-xs font-mono font-bold text-orange-400">
                {riderLocation ? `${riderLocation.lat.toFixed(5)}, ${riderLocation.lng.toFixed(5)}` : 'Awaiting GPS lock...'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Your Destination</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {`${destination.lat.toFixed(5)}, ${destination.lng.toFixed(5)}`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Live / Completed Telemetry HUD Bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Distance & ETA / Completed Pill */}
        <div className="pointer-events-auto bg-gray-900/90 backdrop-blur-md border border-gray-700/60 rounded-2xl px-4 py-2.5 shadow-xl flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${isCompleted || deliveryStatus === 'delivered' ? 'bg-emerald-400' : 'bg-emerald-400 animate-pulse'}`}></div>
          <div>
            <div className={`text-[10px] font-bold uppercase tracking-wider ${isCompleted || deliveryStatus === 'delivered' ? 'text-emerald-400' : 'text-gray-400'}`}>
              {isCompleted || deliveryStatus === 'delivered' ? 'Delivery Completed' : 'Distance to you'}
            </div>
            <div className="text-sm font-extrabold text-white flex items-center gap-1.5">
              {isCompleted || deliveryStatus === 'delivered' ? (
                <span>Arrived at Destination ✓</span>
              ) : (
                <>
                  <span>{distanceKm !== null ? `${distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`} away` : 'Calculating...'}</span>
                  {approxEtaMinutes !== null && (
                    <span className="text-xs font-normal text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      ~{approxEtaMinutes} mins ETA
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* GPS / Completed Status Indicator */}
        <div className="pointer-events-auto bg-gray-900/90 backdrop-blur-md border border-gray-700/60 rounded-2xl px-3.5 py-2 shadow-xl flex items-center gap-2">
          <span className="text-base">{isCompleted || deliveryStatus === 'delivered' ? '🎉' : '🛵'}</span>
          <div className="text-right">
            <span className={`text-[10px] font-bold uppercase tracking-wider block ${isCompleted || deliveryStatus === 'delivered' ? 'text-emerald-400' : 'text-orange-400'}`}>
              {isCompleted || deliveryStatus === 'delivered' ? 'DELIVERED' : deliveryStatus.replace(/_/g, ' ').toUpperCase()}
            </span>
            <span className="text-[10px] text-gray-400 font-mono">
              {isCompleted || deliveryStatus === 'delivered'
                ? lastUpdated
                  ? `Delivered ${new Date(lastUpdated).toLocaleTimeString()}`
                  : 'Delivered'
                : lastUpdated
                ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}`
                : 'Live tracking'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
