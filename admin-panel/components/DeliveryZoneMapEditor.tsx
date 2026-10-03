'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { DeliveryZoneBoundary } from '@/lib/api';
import {
  loadMapsLibrary,
  loadPlacesLibrary,
  hasGoogleMapsApiKey,
} from '@/lib/googleMaps';

interface DeliveryZoneMapEditorProps {
  initialBoundary?: DeliveryZoneBoundary | null;
  color?: string;
  onChange: (boundary: DeliveryZoneBoundary) => void;
}

interface CoordinatePoint {
  lat: number;
  lng: number;
}

const PRESET_BOUNDARIES = [
  {
    name: 'Chandigarh Core (Sectors 1-38)',
    center: { lat: 30.74, lng: 76.78 },
    points: [
      { lat: 30.71, lng: 76.74 },
      { lat: 30.71, lng: 76.815 },
      { lat: 30.775, lng: 76.815 },
      { lat: 30.775, lng: 76.74 },
    ],
  },
  {
    name: 'Mohali IT & Urban (Sec 55-82)',
    center: { lat: 30.7, lng: 76.71 },
    points: [
      { lat: 30.66, lng: 76.67 },
      { lat: 30.66, lng: 76.745 },
      { lat: 30.73, lng: 76.745 },
      { lat: 30.73, lng: 76.67 },
    ],
  },
  {
    name: 'Panchkula Urban (Sec 1-21)',
    center: { lat: 30.69, lng: 76.85 },
    points: [
      { lat: 30.65, lng: 76.815 },
      { lat: 30.65, lng: 76.89 },
      { lat: 30.73, lng: 76.89 },
      { lat: 30.73, lng: 76.815 },
    ],
  },
  {
    name: 'Greater Tricity Super-Ring',
    center: { lat: 30.72, lng: 76.78 },
    points: [
      { lat: 30.6, lng: 76.64 },
      { lat: 30.6, lng: 76.92 },
      { lat: 30.82, lng: 76.92 },
      { lat: 30.82, lng: 76.64 },
    ],
  },
];

function parseBoundaryToPoints(boundary?: DeliveryZoneBoundary | null): CoordinatePoint[] {
  if (
    boundary?.coordinates &&
    Array.isArray(boundary.coordinates) &&
    boundary.coordinates.length > 0 &&
    Array.isArray(boundary.coordinates[0])
  ) {
    const ring = boundary.coordinates[0];
    const pts = ring.map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }));
    if (
      pts.length > 3 &&
      pts[0].lat === pts[pts.length - 1].lat &&
      pts[0].lng === pts[pts.length - 1].lng
    ) {
      return pts.slice(0, -1);
    }
    return pts;
  }
  return PRESET_BOUNDARIES[0].points;
}

export default function DeliveryZoneMapEditor({
  initialBoundary,
  color = '#4f46e5',
  onChange,
}: DeliveryZoneMapEditorProps) {
  const [points, setPoints] = useState<CoordinatePoint[]>(() =>
    parseBoundaryToPoints(initialBoundary)
  );
  const pointsRef = useRef<CoordinatePoint[]>(points);
  pointsRef.current = points;

  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const polygonInstanceRef = useRef<google.maps.Polygon | null>(null);
  const vertexMarkersRef = useRef<google.maps.Marker[]>([]);
  const lastEmittedJsonRef = useRef<string>('');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Emit closed GeoJSON Polygon coordinates ring [[[lng, lat], ...]]
  const emitBoundary = useCallback((pts: CoordinatePoint[]) => {
    if (pts.length < 3) return;

    const rawRing: [number, number][] = pts.map((p) => [
      Number(p.lng.toFixed(6)),
      Number(p.lat.toFixed(6)),
    ]);

    // Ensure first point === last point
    const first = rawRing[0];
    const last = rawRing[rawRing.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      rawRing.push([first[0], first[1]]);
    }

    const boundary: DeliveryZoneBoundary = {
      type: 'Polygon',
      coordinates: [rawRing],
    };

    const jsonStr = JSON.stringify(boundary);
    lastEmittedJsonRef.current = jsonStr;
    onChangeRef.current(boundary);
  }, []);

  // Update polygon visual paths and vertex markers on the map
  const updatePolygonOnMap = useCallback(
    (pts: CoordinatePoint[]) => {
      if (!mapInstanceRef.current) return;

      const path = pts.map((p) => ({ lat: p.lat, lng: p.lng }));

      if (polygonInstanceRef.current) {
        polygonInstanceRef.current.setPath(path);
        polygonInstanceRef.current.setOptions({
          strokeColor: color,
          fillColor: color,
        });
      }

      // Refresh vertex markers
      vertexMarkersRef.current.forEach((m) => m.setMap(null));
      vertexMarkersRef.current = [];

      pts.forEach((pt, index) => {
        if (window.google?.maps) {
          const marker = new google.maps.Marker({
            position: pt,
            map: mapInstanceRef.current,
            draggable: true,
            label: {
              text: `${index + 1}`,
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: 'bold',
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
            title: `Vertex ${index + 1} (Drag to modify)`,
          });

          marker.addListener('dragend', (e: google.maps.MapMouseEvent) => {
            if (!e.latLng) return;
            const newLat = Number(e.latLng.lat().toFixed(6));
            const newLng = Number(e.latLng.lng().toFixed(6));

            const current = [...pointsRef.current];
            current[index] = { lat: newLat, lng: newLng };
            pointsRef.current = current;

            setPoints(current);
            updatePolygonOnMap(current);
            emitBoundary(current);
          });

          vertexMarkersRef.current.push(marker);
        }
      });
    },
    [color, emitBoundary]
  );

  // Sync external initialBoundary changes if they differ from what was last emitted
  useEffect(() => {
    if (!initialBoundary) return;
    const currentJson = JSON.stringify(initialBoundary);
    if (currentJson === lastEmittedJsonRef.current) return;

    const parsedPts = parseBoundaryToPoints(initialBoundary);
    pointsRef.current = parsedPts;
    setPoints(parsedPts);
    updatePolygonOnMap(parsedPts);
  }, [initialBoundary, updatePolygonOnMap]);

  // Initial mount emission to parent once
  useEffect(() => {
    emitBoundary(pointsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize Google Map
  useEffect(() => {
    let isSubscribed = true;

    if (!hasGoogleMapsApiKey()) {
      setLoadError(
        'Google Maps API key not configured. You can select preset boundaries or manage coordinate points below.'
      );
      return;
    }

    async function initMap() {
      try {
        const [{ Map, Polygon }, { Autocomplete }] = await Promise.all([
          loadMapsLibrary(),
          loadPlacesLibrary(),
        ]);

        if (!isSubscribed || !mapContainerRef.current) return;

        const currentPts = pointsRef.current;
        const centerLat = currentPts.length > 0 ? currentPts[0].lat : 30.7333;
        const centerLng = currentPts.length > 0 ? currentPts[0].lng : 76.7794;

        const map = new Map(mapContainerRef.current, {
          center: { lat: centerLat, lng: centerLng },
          zoom: 12,
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
        });

        const polygon = new Polygon({
          map,
          paths: currentPts.map((p) => ({ lat: p.lat, lng: p.lng })),
          strokeColor: color,
          strokeOpacity: 0.9,
          strokeWeight: 2.5,
          fillColor: color,
          fillOpacity: 0.22,
          editable: false,
        });

        // Click on map to add vertex
        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const newPoint = {
            lat: Number(e.latLng.lat().toFixed(6)),
            lng: Number(e.latLng.lng().toFixed(6)),
          };

          const updated = [...pointsRef.current, newPoint];
          pointsRef.current = updated;

          setPoints(updated);
          updatePolygonOnMap(updated);
          emitBoundary(updated);
        });

        // Autocomplete search
        if (searchInputRef.current) {
          const autocomplete = new Autocomplete(searchInputRef.current, {
            fields: ['geometry', 'name'],
          });

          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (place.geometry?.location) {
              map.setCenter(place.geometry.location);
              map.setZoom(13);
            }
          });
        }

        mapInstanceRef.current = map;
        polygonInstanceRef.current = polygon;
        setIsMapLoaded(true);

        // Render vertex markers
        updatePolygonOnMap(currentPts);
      } catch (err: any) {
        if (!isSubscribed) return;
        setLoadError(err.message || 'Failed to initialize Google Maps polygon editor.');
      }
    }

    initMap();

    return () => {
      isSubscribed = false;
      if (polygonInstanceRef.current) {
        polygonInstanceRef.current.setMap(null);
      }
      vertexMarkersRef.current.forEach((m) => m.setMap(null));
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);

  // Apply Preset Boundary
  const handleApplyPreset = (preset: (typeof PRESET_BOUNDARIES)[0]) => {
    pointsRef.current = preset.points;
    setPoints(preset.points);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter(preset.center);
      mapInstanceRef.current.setZoom(12);
    }
    updatePolygonOnMap(preset.points);
    emitBoundary(preset.points);
  };

  // Remove a vertex by index
  const handleRemovePoint = (index: number) => {
    if (points.length <= 3) {
      alert('A polygon boundary requires at least 3 points.');
      return;
    }
    const updated = points.filter((_, i) => i !== index);
    pointsRef.current = updated;
    setPoints(updated);
    updatePolygonOnMap(updated);
    emitBoundary(updated);
  };

  // Reset to default
  const handleResetPoints = () => {
    const defaultPts = PRESET_BOUNDARIES[0].points;
    pointsRef.current = defaultPts;
    setPoints(defaultPts);
    updatePolygonOnMap(defaultPts);
    emitBoundary(defaultPts);
  };

  return (
    <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <label className="block text-xs font-bold text-slate-800">
            Geographical Boundary Map <span className="text-rose-500">*</span>
          </label>
          <p className="text-[11px] text-slate-500">
            Click on map to add boundary points, drag vertices to reshape, or select preset shapes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-600 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md">
            📍 {points.length} Vertices {points.length >= 3 ? '✓ Closed' : '⚠️ Min 3'}
          </span>
          <button
            type="button"
            onClick={handleResetPoints}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Preset Shapes */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Quick Preset Zones:
        </span>
        {PRESET_BOUNDARIES.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => handleApplyPreset(p)}
            className="px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 text-slate-700 text-[11px] font-medium rounded-lg border border-slate-200 transition-all cursor-pointer shadow-2xs"
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Places Search */}
      {hasGoogleMapsApiKey() && (
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search address or area to center map..."
            className="w-full pl-3.5 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          />
          <span className="absolute right-2.5 top-2 text-xs text-slate-400">🔍</span>
        </div>
      )}

      {/* Map Container */}
      <div className="relative w-full h-64 sm:h-72 rounded-xl overflow-hidden border border-slate-300 bg-slate-100 shadow-inner">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Loading Overlay */}
        {!isMapLoaded && !loadError && (
          <div className="absolute inset-0 bg-slate-100/90 flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-600 font-medium">Loading Map Editor...</span>
          </div>
        )}

        {/* Notice for API key configuration */}
        {loadError && (
          <div className="absolute inset-0 bg-slate-50/95 p-4 flex flex-col items-center justify-center text-center">
            <div className="text-indigo-600 text-2xl mb-1">🗺️</div>
            <p className="text-xs font-bold text-slate-800">Zone Polygon Coordinate Editor</p>
            <p className="text-[11px] text-slate-600 max-w-sm mt-0.5">{loadError}</p>
            <p className="text-[10px] text-emerald-700 font-semibold mt-2">
              ✓ Boundary points are active ({points.length} coordinates defined).
            </p>
          </div>
        )}

        {/* Instructions Overlay */}
        {isMapLoaded && (
          <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] px-2.5 py-1 rounded-md shadow-md pointer-events-none">
            💡 Click on map to add vertex • Drag numbered pins to reshape boundary
          </div>
        )}
      </div>

      {/* Coordinates List Summary */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[11px] text-slate-700 font-semibold">
          <span>Boundary Polygon Coordinates (GeoJSON [Lng, Lat])</span>
          <span className="text-indigo-600 font-mono text-[10px]">
            {points.length} points • 2dsphere ready
          </span>
        </div>

        <div className="max-h-28 overflow-y-auto bg-white border border-slate-200 rounded-lg p-2 space-y-1 text-xs">
          {points.map((pt, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-[11px] py-0.5 px-1.5 hover:bg-slate-50 rounded"
            >
              <span className="font-mono text-slate-600">
                <strong className="text-indigo-600">#{idx + 1}</strong>: [{pt.lng.toFixed(4)},{' '}
                {pt.lat.toFixed(4)}]
              </span>
              <button
                type="button"
                onClick={() => handleRemovePoint(idx)}
                className="text-rose-500 hover:text-rose-700 text-xs px-1 hover:bg-rose-50 rounded transition-colors"
                title="Remove vertex"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
