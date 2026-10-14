'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { emitLocationUpdate } from '@/lib/socket';

interface UseRiderLocationOptions {
  activeOrderId: string | null;
  isTrackingActive: boolean;
  socket: Socket | null;
  onLocationEmit?: (coords: { lat: number; lng: number; timestamp: number }) => void;
}

export interface GPSState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number | null;
  isWatching: boolean;
  isSimulating: boolean;
  error: string | null;
  lastEmittedTime: number | null;
  emitCount: number;
}

// Default realistic simulation waypoints in Chandigarh Tricity
const SIMULATED_WAYPOINTS = [
  { lat: 30.7333, lng: 76.7794 }, // Sector 17
  { lat: 30.7301, lng: 76.7745 },
  { lat: 30.7265, lng: 76.7698 },
  { lat: 30.7230, lng: 76.7650 },
  { lat: 30.7195, lng: 76.7602 },
  { lat: 30.7150, lng: 76.7550 },
  { lat: 30.7100, lng: 76.7500 }, // Sector 35
];

export function useRiderLocation({
  activeOrderId,
  isTrackingActive,
  socket,
  onLocationEmit,
}: UseRiderLocationOptions) {
  const [gpsState, setGpsState] = useState<GPSState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    heading: null,
    speed: null,
    timestamp: null,
    isWatching: false,
    isSimulating: false,
    error: null,
    lastEmittedTime: null,
    emitCount: 0,
  });

  const watchIdRef = useRef<number | null>(null);
  const lastEmitTimeRef = useRef<number>(0);
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const simStepRef = useRef<number>(0);

  // GPS Throttling: Minimum 3000ms between socket emissions
  const THROTTLE_INTERVAL_MS = 3500;

  const emitGPSUpdate = useCallback(
    (lat: number, lng: number, accuracy?: number | null, heading?: number | null, speed?: number | null) => {
      if (!activeOrderId || !socket || !socket.connected) {
        return;
      }

      const now = Date.now();
      if (now - lastEmitTimeRef.current < THROTTLE_INTERVAL_MS) {
        return; // Throttled
      }

      lastEmitTimeRef.current = now;

      const payload = {
        orderId: activeOrderId,
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        accuracy: accuracy ? Number(accuracy.toFixed(1)) : undefined,
        heading: heading !== null && heading !== undefined ? Number(heading) : undefined,
        speed: speed !== null && speed !== undefined ? Number(speed) : undefined,
        timestamp: now,
      };

      emitLocationUpdate(socket, payload, (res) => {
        if (res && !res.success) {
          console.warn('[Rider GPS] Server rejected location update:', res.message);
        }
      });

      setGpsState((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        accuracy: accuracy || null,
        heading: heading || null,
        speed: speed || null,
        timestamp: now,
        lastEmittedTime: now,
        emitCount: prev.emitCount + 1,
      }));

      if (onLocationEmit) {
        onLocationEmit({ lat, lng, timestamp: now });
      }
    },
    [activeOrderId, socket, onLocationEmit]
  );

  // Cleanup everything immediately when tracking becomes inactive or order ends
  useEffect(() => {
    if (!isTrackingActive || !activeOrderId) {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
      setGpsState((prev) => {
        if (prev.isWatching || prev.isSimulating) {
          return { ...prev, isWatching: false, isSimulating: false };
        }
        return prev;
      });
    }
  }, [isTrackingActive, activeOrderId]);

  // 1. Browser Geolocation API (navigator.geolocation.watchPosition)
  useEffect(() => {
    if (!isTrackingActive || !activeOrderId || gpsState.isSimulating) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
        setGpsState((prev) => (prev.isWatching ? { ...prev, isWatching: false } : prev));
      }
      return;
    }

    if (!('geolocation' in navigator)) {
      setGpsState((prev) => ({
        ...prev,
        error: 'Geolocation API is not supported in this browser.',
      }));
      return;
    }

    setGpsState((prev) => ({ ...prev, isWatching: true, error: null }));

    const successCallback: PositionCallback = (position) => {
      const { latitude, longitude, accuracy, heading, speed } = position.coords;
      emitGPSUpdate(latitude, longitude, accuracy, heading, speed);
    };

    const errorCallback: PositionErrorCallback = (err) => {
      let msg = 'Failed to retrieve GPS location.';
      if (err.code === err.PERMISSION_DENIED) {
        msg = 'Location permission was denied. Please allow location access to share live GPS.';
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        msg = 'Location information is currently unavailable.';
      } else if (err.code === err.TIMEOUT) {
        msg = 'GPS location request timed out.';
      }

      console.warn('[Rider GPS Error]:', msg);
      setGpsState((prev) => ({ ...prev, error: msg }));
    };

    const watchId = navigator.geolocation.watchPosition(successCallback, errorCallback, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 2000,
    });

    watchIdRef.current = watchId;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isTrackingActive, activeOrderId, gpsState.isSimulating, emitGPSUpdate]);

  // 2. Simulated GPS Route Generator (for desktop demo testing)
  const toggleSimulation = useCallback(() => {
    setGpsState((prev) => {
      const nextSim = !prev.isSimulating;
      return { ...prev, isSimulating: nextSim, error: null };
    });
  }, []);

  useEffect(() => {
    if (!gpsState.isSimulating || !isTrackingActive || !activeOrderId) {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
      return;
    }

    // Stop real watcher if simulation is on
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    simStepRef.current = 0;

    simIntervalRef.current = setInterval(() => {
      const step = simStepRef.current % SIMULATED_WAYPOINTS.length;
      const point = SIMULATED_WAYPOINTS[step];

      // Add a slight micro-jitter to make it natural
      const jitterLat = point.lat + (Math.random() - 0.5) * 0.0003;
      const jitterLng = point.lng + (Math.random() - 0.5) * 0.0003;

      emitGPSUpdate(jitterLat, jitterLng, 6.5, (step * 45) % 360, 28);
      simStepRef.current += 1;
    }, 3500);

    return () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
    };
  }, [gpsState.isSimulating, isTrackingActive, activeOrderId, emitGPSUpdate]);

  return {
    gpsState,
    toggleSimulation,
    emitManualLocation: emitGPSUpdate,
  };
}
