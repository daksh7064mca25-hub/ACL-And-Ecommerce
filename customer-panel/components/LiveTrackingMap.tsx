'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  loadMapsLibrary,
  loadMarkerLibrary,
  loadRoutesLibrary,
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
 * Validate geographic coordinates
 */
export function isValidLatLng(lat?: number | null, lng?: number | null): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
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

  // Routing engine refs & throttling
  const requestIdRef = useRef<number>(0);
  const isRoutingInProgressRef = useRef<boolean>(false);
  const lastRoutedRiderPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastRoutedDestPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastRouteTimestampRef = useRef<number>(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRoutePosRef = useRef<{ rider: { lat: number; lng: number }; dest: { lat: number; lng: number } } | null>(null);

  // Map state
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Calculated Road Route Telemetry State
  const [roadDistance, setRoadDistance] = useState<string | null>(null);
  const [roadDuration, setRoadDuration] = useState<string | null>(null);
  const [routingStatus, setRoutingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [routingError, setRoutingError] = useState<string | null>(null);

  // Fallback direct distance (only if road route fails or is unavailable)
  const [directDistanceKm, setDirectDistanceKm] = useState<number | null>(null);

  /**
   * Request actual road-following driving route using modern Google Maps Routes API (Route.computeRoutes)
   * with seamless fallback to driving road router if GCP routing API is propagating or blocked by key restriction.
   */
  const calculateRoute = useCallback(
    (
      riderPos: { lat: number; lng: number },
      destPos: { lat: number; lng: number },
      forceImmediate = false
    ) => {
      if (isCompleted || deliveryStatus === 'delivered') return;
      if (!isValidLatLng(riderPos.lat, riderPos.lng) || !isValidLatLng(destPos.lat, destPos.lng)) return;

      const execute = async () => {
        // Prevent overlapping requests: queue latest position if one is currently in-flight
        if (isRoutingInProgressRef.current) {
          pendingRoutePosRef.current = { rider: riderPos, dest: destPos };
          return;
        }

        const currentReqId = ++requestIdRef.current;
        isRoutingInProgressRef.current = true;
        setRoutingStatus((prev) => (prev === 'success' ? 'success' : 'loading'));

        let routeObtained = false;

        try {
          // 1. Modern Google Maps Routes API (Route.computeRoutes) - eliminates legacy DirectionsService warnings
          try {
            const routesLib = await loadRoutesLibrary();
            const Route = routesLib?.Route;
            if (Route && typeof Route.computeRoutes === 'function') {
              const res = await Route.computeRoutes({
                origin: { lat: riderPos.lat, lng: riderPos.lng },
                destination: { lat: destPos.lat, lng: destPos.lng },
                travelMode: 'DRIVING' as any,
                fields: ['durationMillis', 'distanceMeters', 'path'],
              });

              if (currentReqId !== requestIdRef.current) return;

              if (res?.routes && res.routes.length > 0) {
                const primaryRoute = res.routes[0];
                if (primaryRoute.path && primaryRoute.path.length > 0) {
                  const roadPath = primaryRoute.path.map((pt: any) => ({
                    lat: typeof pt.lat === 'function' ? pt.lat() : pt.lat,
                    lng: typeof pt.lng === 'function' ? pt.lng() : pt.lng,
                  }));

                  lastRoutedRiderPosRef.current = riderPos;
                  lastRoutedDestPosRef.current = destPos;

                  if (routeLineRef.current) {
                    routeLineRef.current.setPath(roadPath);
                    if (mapInstanceRef.current && !routeLineRef.current.getMap()) {
                      routeLineRef.current.setMap(mapInstanceRef.current);
                    }
                  }

                  const distMeters = primaryRoute.distanceMeters || 0;
                  const durMillis = primaryRoute.durationMillis || 0;
                  const distStr = distMeters < 1000 ? `${Math.round(distMeters)} m` : `${(distMeters / 1000).toFixed(1)} km`;
                  const durMins = Math.max(1, Math.round(durMillis / 60000));
                  const durStr = `${durMins} mins`;

                  setRoadDistance(distStr);
                  setRoadDuration(durStr);
                  setRoutingStatus('success');
                  setRoutingError(null);
                  routeObtained = true;
                }
              }
            }
          } catch (routesApiErr) {
            // Silently fall through to road router if Google Routes API key restrictions block computeRoutes
          }

          if (currentReqId !== requestIdRef.current) return;

          // 2. High-precision driving road routing engine fallback
          if (!routeObtained) {
            const url = `https://router.project-osrm.org/route/v1/driving/${riderPos.lng},${riderPos.lat};${destPos.lng},${destPos.lat}?overview=full&geometries=geojson`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Road routing service returned status ${res.status}`);
            const data = await res.json();

            if (currentReqId !== requestIdRef.current) return;

            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
              const primaryRoute = data.routes[0];
              const coords = primaryRoute.geometry?.coordinates || [];

              // Convert GeoJSON [lng, lat] coordinates to Google Maps { lat, lng } road vertices
              const roadPath = coords.map(([lng, lat]: [number, number]) => ({ lat, lng }));

              lastRoutedRiderPosRef.current = riderPos;
              lastRoutedDestPosRef.current = destPos;

              if (routeLineRef.current) {
                routeLineRef.current.setPath(roadPath);
                if (mapInstanceRef.current && !routeLineRef.current.getMap()) {
                  routeLineRef.current.setMap(mapInstanceRef.current);
                }
              }

              const distMeters = primaryRoute.distance;
              const durSec = primaryRoute.duration;
              const distStr = distMeters < 1000 ? `${Math.round(distMeters)} m` : `${(distMeters / 1000).toFixed(1)} km`;
              const durMins = Math.max(1, Math.round(durSec / 60));
              const durStr = `${durMins} mins`;

              setRoadDistance(distStr);
              setRoadDuration(durStr);
              setRoutingStatus('success');
              setRoutingError(null);
              routeObtained = true;
            } else {
              throw new Error('No driving route found between rider and destination');
            }
          }
        } catch (err: any) {
          if (currentReqId !== requestIdRef.current) return;
          console.error('[LiveTrackingMap] Route calculation error:', err);
          setRoutingStatus('error');
          setRoutingError(err.message || 'Road route temporarily unavailable');
          if (!lastRoutedRiderPosRef.current && routeLineRef.current) {
            routeLineRef.current.setMap(null);
          }
        } finally {
          if (currentReqId === requestIdRef.current) {
            isRoutingInProgressRef.current = false;
            lastRouteTimestampRef.current = Date.now();

            if (pendingRoutePosRef.current) {
              const next = pendingRoutePosRef.current;
              pendingRoutePosRef.current = null;
              calculateRoute(next.rider, next.dest, true);
            }
          }
        }
      };

      if (forceImmediate) {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        execute();
      } else {
        const now = Date.now();
        const elapsed = now - lastRouteTimestampRef.current;
        const THROTTLE_INTERVAL_MS = 4000;

        if (elapsed >= THROTTLE_INTERVAL_MS) {
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          execute();
        } else {
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(execute, THROTTLE_INTERVAL_MS - elapsed);
        }
      }
    },
    [isCompleted, deliveryStatus]
  );

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
          loadRoutesLibrary(),
        ]);

        if (!isSubscribed || !mapContainerRef.current) return;

        const hasRider = isValidLatLng(riderLocation?.lat, riderLocation?.lng);
        const hasDest = isValidLatLng(destination?.lat, destination?.lng);

        const defaultCenter = hasRider && hasDest && riderLocation
          ? { lat: (riderLocation.lat + destination.lat) / 2, lng: (riderLocation.lng + destination.lng) / 2 }
          : hasDest
          ? { lat: destination.lat, lng: destination.lng }
          : { lat: 30.741482, lng: 76.768066 };

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
        if (hasDest) {
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
        }

        // 2. Rider Marker (Moving Delivery Scooter)
        if (hasRider && riderLocation) {
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
        }

        // 3. Road-Following Polyline (Path populated dynamically with road geometry)
        const line = new Polyline({
          path: [],
          geodesic: true,
          strokeColor: '#f97316',
          strokeOpacity: 0.85,
          strokeWeight: 4,
          icons: [
            {
              icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2.2, strokeColor: '#ea580c', fillColor: '#ea580c', fillOpacity: 1 },
              offset: '50%',
            },
          ],
        });
        routeLineRef.current = line;

        // Initial Route calculation if coordinates are present
        if (hasRider && hasDest && riderLocation && !isCompleted && deliveryStatus !== 'delivered') {
          calculateRoute(
            { lat: riderLocation.lat, lng: riderLocation.lng },
            { lat: destination.lat, lng: destination.lng },
            true
          );

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
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (routeLineRef.current) routeLineRef.current.setMap(null);
    };
  }, [destination.lat, destination.lng, calculateRoute]);

  // Real-time update of Rider Marker position when GPS coordinates arrive via Socket.IO
  useEffect(() => {
    if (!isValidLatLng(riderLocation?.lat, riderLocation?.lng) || !mapInstanceRef.current) return;

    const newPos = { lat: riderLocation!.lat, lng: riderLocation!.lng };
    const destPos = { lat: destination.lat, lng: destination.lng };

    // 1. Immediately update rider marker position smoothly without any network delay
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

    // 2. Direct distance calculation for fallback telemetry HUD
    const directDist = calculateHaversineDistance(newPos.lat, newPos.lng, destPos.lat, destPos.lng);
    setDirectDistanceKm(directDist);

    // 3. Pan map view smoothly to follow rider
    if (mapInstanceRef.current && isValidLatLng(destPos.lat, destPos.lng)) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(destPos);
      bounds.extend(newPos);
      mapInstanceRef.current.panToBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
    }

    // 4. Safe route refresh behavior: only recalculate route when rider moved meaningfully
    if (isCompleted || deliveryStatus === 'delivered') {
      if (routeLineRef.current) routeLineRef.current.setMap(null);
      return;
    }

    const lastRider = lastRoutedRiderPosRef.current;
    const lastDest = lastRoutedDestPosRef.current;

    let shouldRecalculate = false;
    let isImmediate = false;

    if (!lastRider || !lastDest) {
      // First route calculation
      shouldRecalculate = true;
      isImmediate = true;
    } else {
      // Recalculate if destination changed (> 10m)
      const destMovedMeters = calculateHaversineDistance(lastDest.lat, lastDest.lng, destPos.lat, destPos.lng) * 1000;
      if (destMovedMeters > 10) {
        shouldRecalculate = true;
        isImmediate = true;
      }

      // Meaningful distance threshold for live rider movement: 35 meters
      const riderMovedMeters = calculateHaversineDistance(lastRider.lat, lastRider.lng, newPos.lat, newPos.lng) * 1000;
      if (riderMovedMeters >= 35) {
        shouldRecalculate = true;
      }

      // Route staleness threshold: > 45 seconds since last route with active movement
      const timeSinceLastRoute = Date.now() - lastRouteTimestampRef.current;
      if (timeSinceLastRoute > 45000 && riderMovedMeters >= 10) {
        shouldRecalculate = true;
      }
    }

    if (shouldRecalculate) {
      calculateRoute(newPos, destPos, isImmediate);
    }
  }, [
    riderLocation?.lat,
    riderLocation?.lng,
    destination.lat,
    destination.lng,
    riderName,
    deliveryStatus,
    isCompleted,
    calculateRoute,
  ]);

  // Handle completion state cleanup
  useEffect(() => {
    if (isCompleted || deliveryStatus === 'delivered') {
      if (routeLineRef.current) {
        routeLineRef.current.setMap(null);
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    }
  }, [isCompleted, deliveryStatus]);

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
                {riderLocation && isValidLatLng(riderLocation.lat, riderLocation.lng)
                  ? `${riderLocation.lat.toFixed(5)}, ${riderLocation.lng.toFixed(5)}`
                  : 'Awaiting GPS lock...'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Your Destination</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {isValidLatLng(destination.lat, destination.lng)
                  ? `${destination.lat.toFixed(5)}, ${destination.lng.toFixed(5)}`
                  : 'Destination not set'}
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
            <div className="text-sm font-extrabold text-white flex items-center gap-2">
              {isCompleted || deliveryStatus === 'delivered' ? (
                <span>Arrived at Destination ✓</span>
              ) : roadDistance ? (
                <>
                  <span>{roadDistance} away (via road)</span>
                  {roadDuration && (
                    <span className="text-xs font-normal text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      ~{roadDuration} ETA
                    </span>
                  )}
                </>
              ) : routingStatus === 'loading' ? (
                <span className="text-xs font-medium text-slate-300 animate-pulse">Calculating road route...</span>
              ) : routingError ? (
                <>
                  <span>
                    {directDistanceKm !== null
                      ? `${directDistanceKm < 1 ? `${Math.round(directDistanceKm * 1000)} m` : `${directDistanceKm.toFixed(1)} km`} (direct)`
                      : 'Awaiting GPS...'}
                  </span>
                  <span
                    className="text-[10px] font-normal text-amber-400 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-full"
                    title={routingError}
                  >
                    Road route unavailable
                  </span>
                </>
              ) : directDistanceKm !== null ? (
                <span className="text-xs font-medium text-slate-300">Calculating driving route...</span>
              ) : (
                <span>Awaiting GPS lock...</span>
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
