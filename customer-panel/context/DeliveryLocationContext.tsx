'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  checkDeliveryServiceability,
  DeliveryServiceabilityResponse,
  DeliveryZoneSummary,
  CartCheckoutItem,
} from '@/lib/api';

export interface CustomerDeliveryLocation {
  lat: number;
  lng: number;
  address: string;
  city?: string;
  state?: string;
}

export interface PresetLocation {
  name: string;
  tag: string;
  location: CustomerDeliveryLocation;
  zoneHint: string;
  isServiceable: boolean;
}

export const PRESET_LOCATIONS: PresetLocation[] = [
  {
    name: 'Sector 17, Chandigarh',
    tag: 'Core Hub',
    location: {
      lat: 30.7333,
      lng: 76.7794,
      address: 'Sector 17, City Centre, Chandigarh, 160017',
      city: 'Chandigarh',
      state: 'Chandigarh',
    },
    zoneHint: 'CHD-EXP (₹30 Fee • 20-35 mins)',
    isServiceable: true,
  },
  {
    name: 'Phase 7 / Sector 62, Mohali',
    tag: 'Mohali Urban',
    location: {
      lat: 30.7046,
      lng: 76.7179,
      address: 'Phase 7 / Sector 62, Mohali, Punjab 160062',
      city: 'Mohali',
      state: 'Punjab',
    },
    zoneHint: 'MOH-URB (₹45 Fee • 30-45 mins)',
    isServiceable: true,
  },
  {
    name: 'Sector 5, Panchkula',
    tag: 'Panchkula Express',
    location: {
      lat: 30.6942,
      lng: 76.8606,
      address: 'Sector 5, Panchkula, Haryana 134109',
      city: 'Panchkula',
      state: 'Haryana',
    },
    zoneHint: 'PKL-EXP (₹40 Fee • 25-40 mins)',
    isServiceable: true,
  },
  {
    name: 'VIP Road, Zirakpur / Aerocity',
    tag: 'Greater Tricity',
    location: {
      lat: 30.6425,
      lng: 76.8173,
      address: 'VIP Road, Zirakpur, Greater Tricity, Punjab 140603',
      city: 'Zirakpur',
      state: 'Punjab',
    },
    zoneHint: 'GTR-TRI (₹60 Fee • 40-60 mins)',
    isServiceable: true,
  },
  {
    name: 'Connaught Place, New Delhi',
    tag: 'Outside Zone',
    location: {
      lat: 28.6139,
      lng: 77.209,
      address: 'Connaught Place, New Delhi, Delhi 110001',
      city: 'New Delhi',
      state: 'Delhi',
    },
    zoneHint: 'Out of Delivery Range ❌',
    isServiceable: false,
  },
];

interface DeliveryLocationContextType {
  location: CustomerDeliveryLocation | null;
  serviceability: DeliveryServiceabilityResponse | null;
  isLoadingLocation: boolean;
  isCheckingServiceability: boolean;
  isLocationModalOpen: boolean;
  isDeliverable: boolean;
  deliveryFee: number;
  estimatedDeliveryTime: string;
  deliveryZone: DeliveryZoneSummary | null;
  minOrderAmount: number;
  openLocationModal: () => void;
  closeLocationModal: () => void;
  setLocation: (loc: CustomerDeliveryLocation) => Promise<void>;
  detectCurrentLocation: () => Promise<void>;
  checkServiceabilityForCart: (
    items?: CartCheckoutItem[],
    cartTotal?: number
  ) => Promise<DeliveryServiceabilityResponse | null>;
  isMounted: boolean;
}

const DeliveryLocationContext = createContext<DeliveryLocationContextType | undefined>(undefined);

const LOCATION_STORAGE_KEY = 'customer_delivery_location_v2';

export const DeliveryLocationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [location, setLocationState] = useState<CustomerDeliveryLocation | null>(null);
  const [serviceability, setServiceability] = useState<DeliveryServiceabilityResponse | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isCheckingServiceability, setIsCheckingServiceability] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Helper to query backend serviceability
  const queryServiceability = useCallback(
    async (
      loc: CustomerDeliveryLocation,
      items: CartCheckoutItem[] = [],
      cartTotal: number = 0
    ) => {
      try {
        setIsCheckingServiceability(true);
        const result = await checkDeliveryServiceability({
          lat: loc.lat,
          lng: loc.lng,
          items,
          cartTotal,
        });
        setServiceability(result);
        return result;
      } catch (err) {
        console.error('Failed to check serviceability:', err);
        setServiceability({
          success: false,
          isServiceable: false,
          coordinates: { latitude: loc.lat, longitude: loc.lng },
          deliveryZone: null,
          deliveryFee: 0,
          minOrderAmount: 0,
          estimatedDeliveryTime: '',
          message: 'Unable to check delivery serviceability.',
        });
        return null;
      } finally {
        setIsCheckingServiceability(false);
      }
    },
    []
  );

  // Initialize from storage or default to Chandigarh Core
  useEffect(() => {
    setIsMounted(true);
    try {
      const stored = localStorage.getItem(LOCATION_STORAGE_KEY);
      let initialLoc: CustomerDeliveryLocation = PRESET_LOCATIONS[0].location;

      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          parsed &&
          typeof parsed.lat === 'number' &&
          typeof parsed.lng === 'number' &&
          parsed.address
        ) {
          initialLoc = parsed;
        }
      }

      setLocationState(initialLoc);
      queryServiceability(initialLoc);
    } catch (err) {
      console.warn('Could not read saved location:', err);
      const fallback = PRESET_LOCATIONS[0].location;
      setLocationState(fallback);
      queryServiceability(fallback);
    }
  }, [queryServiceability]);

  // Set explicit location
  const setLocation = useCallback(
    async (newLoc: CustomerDeliveryLocation) => {
      setLocationState(newLoc);
      try {
        localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(newLoc));
      } catch (e) {
        console.warn('Failed to persist location:', e);
      }
      await queryServiceability(newLoc);
    },
    [queryServiceability]
  );

  // Detect current GPS coordinate using browser Geolocation
  const detectCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let formattedAddress = `GPS Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        let city = 'Current Area';

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            { headers: { 'User-Agent': 'EcommerceDeliveryZone/1.0' } }
          );
          if (res.ok) {
            const data = await res.json();
            if (data.display_name) {
              formattedAddress = data.display_name;
              city =
                data.address?.city ||
                data.address?.town ||
                data.address?.suburb ||
                data.address?.state ||
                'Nearby';
            }
          }
        } catch (e) {
          console.warn('Reverse geocode fallback failed:', e);
        }

        const newLoc: CustomerDeliveryLocation = {
          lat,
          lng,
          address: formattedAddress,
          city,
        };

        await setLocation(newLoc);
        setIsLoadingLocation(false);
      },
      (err) => {
        console.warn('GPS detection error:', err.message);
        setIsLoadingLocation(false);
        alert(
          'Could not retrieve your live GPS location. Please select one of our preset delivery zones or use address search.'
        );
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [setLocation]);

  // Check serviceability dynamically for cart items and amount
  const checkServiceabilityForCart = useCallback(
    async (items: CartCheckoutItem[] = [], cartTotal: number = 0) => {
      if (!location) return null;
      return await queryServiceability(location, items, cartTotal);
    },
    [location, queryServiceability]
  );

  const openLocationModal = useCallback(() => setIsLocationModalOpen(true), []);
  const closeLocationModal = useCallback(() => setIsLocationModalOpen(false), []);

  const isDeliverable = Boolean(serviceability?.isServiceable);
  const deliveryFee = serviceability?.deliveryFee ?? 0;
  const estimatedDeliveryTime = serviceability?.estimatedDeliveryTime ?? '';
  const deliveryZone = serviceability?.deliveryZone ?? null;
  const minOrderAmount = serviceability?.minOrderAmount ?? 0;

  return (
    <DeliveryLocationContext.Provider
      value={{
        location,
        serviceability,
        isLoadingLocation,
        isCheckingServiceability,
        isLocationModalOpen,
        isDeliverable,
        deliveryFee,
        estimatedDeliveryTime,
        deliveryZone,
        minOrderAmount,
        openLocationModal,
        closeLocationModal,
        setLocation,
        detectCurrentLocation,
        checkServiceabilityForCart,
        isMounted,
      }}
    >
      {children}
    </DeliveryLocationContext.Provider>
  );
};

export const useDeliveryLocation = () => {
  const context = useContext(DeliveryLocationContext);
  if (!context) {
    throw new Error('useDeliveryLocation must be used within a DeliveryLocationProvider');
  }
  return context;
};
