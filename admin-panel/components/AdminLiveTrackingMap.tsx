'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  loadMapsLibrary,
  loadMarkerLibrary,
  loadRoutesLibrary,
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
export function isValidLatLng(lat?: number | null, lng?: number | null): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
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

  // Road route state
  const [roadDistance, setRoadDistance] = useState<string | null>(null);
  const [roadDuration, setRoadDuration] = useState<string | null>(null);
  const [routingStatus, setRoutingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [routingError, setRoutingError] = useState<string | null>(null);

  // Fallback direct distance
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  const hasValidDest = isValidLatLng(destination?.lat, destination?.lng);
  const hasValidRider = isValidLatLng(riderLocation?.lat, riderLocation?.lng);

  /**
   * Request actual driving route with modern Google Maps Routes API (Route.computeRoutes)
   * eliminating legacy DirectionsService warnings and requests.
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
        // Prevent overlapping requests
        if (isRoutingInProgressRef.current) {
          pendingRoutePosRef.current = { rider: riderPos, dest: destPos };
          return;
        }

        const currentReqId = ++requestIdRef.current;
        isRoutingInProgressRef.current = true;
        setRoutingStatus((prev) => (prev === 'success' ? 'success' : 'loading'));

        let routeObtained = false;

        try {
          // 1. Modern Google Maps Routes API (Route.computeRoutes)
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
          } catch (routesErr) {
            // Silently fall through to road router if Google Routes API key restrictions block computeRoutes
          }

          if (currentReqId !== requestIdRef.current) return;

          // 2. High-precision driving road routing fallback
          if (!routeObtained) {
            const url = `https://router.project-osrm.org/route/v1/driving/${riderPos.lng},${riderPos.lat};${destPos.lng},${destPos.lat}?overview=full&geometries=geojson`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Road routing service returned status ${res.status}`);
            const data = await res.json();

            if (currentReqId !== requestIdRef.current) return;

            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
              const primaryRoute = data.routes[0];
              const coords = primaryRoute.geometry?.coordinates || [];

              // Convert GeoJSON [lng, lat] to Google Maps { lat, lng } road vertices
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
              throw new Error('No driving route found');
            }
          }
        } catch (err: any) {
          if (currentReqId !== requestIdRef.current) return;
          console.error('[AdminLiveTrackingMap] Route calculation error:', err);
          setRoutingStatus('error');
          setRoutingError(err.message || 'Failed to calculate road route');
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

  // Compute live direct fallback distance
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
          loadRoutesLibrary(),
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
        }

        // 3. Road Route Polyline (Populated with road geometry)
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

        // Initial Route calculation
        if (hasValidRider && hasValidDest && riderLocation && destination && !isCompleted && deliveryStatus !== 'delivered') {
          calculateRoute(
            { lat: riderLocation.lat, lng: riderLocation.lng },
            { lat: destination.lat, lng: destination.lng },
            true
          );

          // Fit Bounds
          const bounds = new google.maps.LatLngBounds();
          bounds.extend({ lat: destination.lat, lng: destination.lng });
          bounds.extend({ lat: riderLocation.lat, lng: riderLocation.lng });
          map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
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
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (routeLineRef.current) routeLineRef.current.setMap(null);
    };
  }, [hasValidDest, destination?.lat, destination?.lng, calculateRoute]);

  // Smoothly update Rider Marker position without recreating the map
  useEffect(() => {
    if (!hasValidRider || !riderLocation || !mapInstanceRef.current) return;

    const newPos = { lat: riderLocation.lat, lng: riderLocation.lng };

    // 1. Immediately update rider marker position
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

    // 2. Pan map smoothly
    if (mapInstanceRef.current && hasValidDest && destination) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: destination.lat, lng: destination.lng });
      bounds.extend(newPos);
      mapInstanceRef.current.panToBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
    } else if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo(newPos);
    }

    // 3. Determine if route recalculation is needed
    if (isCompleted || deliveryStatus === 'delivered' || !hasValidDest || !destination) {
      if (routeLineRef.current) routeLineRef.current.setMap(null);
      return;
    }

    const destPos = { lat: destination.lat, lng: destination.lng };
    const lastRider = lastRoutedRiderPosRef.current;
    const lastDest = lastRoutedDestPosRef.current;

    let shouldRecalc = false;
    let isImmediate = false;

    if (!lastRider || !lastDest) {
      shouldRecalc = true;
      isImmediate = true;
    } else {
      const destMovedMeters = calculateHaversineDistance(lastDest.lat, lastDest.lng, destPos.lat, destPos.lng) * 1000;
      if (destMovedMeters > 10) {
        shouldRecalc = true;
        isImmediate = true;
      }

      // Meaningful movement threshold: 35 meters
      const riderMovedMeters = calculateHaversineDistance(lastRider.lat, lastRider.lng, newPos.lat, newPos.lng) * 1000;
      if (riderMovedMeters >= 35) {
        shouldRecalc = true;
      }

      // Route staleness threshold: > 45s since last calculation with movement
      const timeSinceLastRoute = Date.now() - lastRouteTimestampRef.current;
      if (timeSinceLastRoute > 45000 && riderMovedMeters >= 10) {
        shouldRecalc = true;
      }
    }

    if (shouldRecalc) {
      calculateRoute(newPos, destPos, isImmediate);
    }
  }, [
    hasValidRider,
    riderLocation?.lat,
    riderLocation?.lng,
    hasValidDest,
    destination?.lat,
    destination?.lng,
    riderName,
    isCompleted,
    deliveryStatus,
    calculateRoute,
  ]);

  // Clean up completed delivery state
  useEffect(() => {
    if (isCompleted || deliveryStatus === 'delivered') {
      if (routeLineRef.current) routeLineRef.current.setMap(null);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    }
  }, [isCompleted, deliveryStatus]);

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
            ) : roadDistance ? (
              <>
                <span className="text-slate-400 font-normal">Road Distance:</span>
                <span>{roadDistance}</span>
                {roadDuration && (
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                    ~{roadDuration} ETA
                  </span>
                )}
              </>
            ) : routingStatus === 'loading' ? (
              <span className="text-slate-400 text-[11px] animate-pulse">Calculating road route...</span>
            ) : routingError ? (
              <>
                <span className="text-slate-400 font-normal">Direct Approx:</span>
                <span>{distanceKm ? `${distanceKm.toFixed(2)} km` : '—'}</span>
                <span className="text-[10px] text-amber-400 bg-amber-950/50 border border-amber-500/30 px-1.5 py-0.5 rounded" title={routingError}>
                  Route unavailable
                </span>
              </>
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
