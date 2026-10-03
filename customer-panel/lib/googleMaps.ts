import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
export const GOOGLE_MAPS_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

let optionsConfigured = false;

export function hasGoogleMapsApiKey(): boolean {
  return Boolean(GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY.trim().length > 0);
}

function ensureGoogleMapsConfigured() {
  if (!hasGoogleMapsApiKey()) {
    throw new Error(
      'Google Maps API Key is missing. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your .env.local file.'
    );
  }

  if (!optionsConfigured) {
    const options: any = {
      key: GOOGLE_MAPS_API_KEY.trim(),
      v: 'weekly',
    };
    if (GOOGLE_MAPS_MAP_ID) {
      options.mapIds = [GOOGLE_MAPS_MAP_ID];
    }
    setOptions(options);
    optionsConfigured = true;
  }
}

/**
 * Load Google Maps Maps Library
 */
export async function loadMapsLibrary(): Promise<google.maps.MapsLibrary> {
  if (typeof window === 'undefined') {
    throw new Error('Google Maps can only be loaded in browser environments.');
  }
  ensureGoogleMapsConfigured();
  return importLibrary('maps');
}

/**
 * Load Google Maps Places Library
 */
export async function loadPlacesLibrary(): Promise<google.maps.PlacesLibrary> {
  if (typeof window === 'undefined') {
    throw new Error('Google Maps can only be loaded in browser environments.');
  }
  ensureGoogleMapsConfigured();
  return importLibrary('places');
}

/**
 * Load Google Maps Marker Library (AdvancedMarkerElement)
 */
export async function loadMarkerLibrary(): Promise<google.maps.MarkerLibrary> {
  if (typeof window === 'undefined') {
    throw new Error('Google Maps can only be loaded in browser environments.');
  }
  ensureGoogleMapsConfigured();
  return importLibrary('marker');
}

/**
 * Load Google Maps Geocoding Library
 */
export async function loadGeocodingLibrary(): Promise<google.maps.GeocodingLibrary> {
  if (typeof window === 'undefined') {
    throw new Error('Google Maps can only be loaded in browser environments.');
  }
  ensureGoogleMapsConfigured();
  return importLibrary('geocoding');
}

export interface ParsedAddress {
  formattedAddress: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

/**
 * Extracts structured address components from Google Places or Geocoding results
 */
export function extractAddressComponents(
  result: google.maps.places.PlaceResult | google.maps.GeocoderResult
): ParsedAddress {
  const components = result.address_components || [];
  let city = '';
  let state = '';
  let country = '';
  let postalCode = '';

  for (const comp of components) {
    const types = comp.types;
    if (types.includes('locality') || types.includes('administrative_area_level_2') || types.includes('postal_town')) {
      if (!city) city = comp.long_name;
    }
    if (types.includes('administrative_area_level_1')) {
      state = comp.long_name;
    }
    if (types.includes('country')) {
      country = comp.long_name;
    }
    if (types.includes('postal_code')) {
      postalCode = comp.long_name;
    }
  }

  return {
    formattedAddress: result.formatted_address || '',
    city,
    state,
    country,
    postalCode,
  };
}

/**
 * Reverse geocode latitude and longitude to address details
 */
export async function reverseGeocodeLatLng(lat: number, lng: number): Promise<ParsedAddress | null> {
  if (!hasGoogleMapsApiKey()) {
    return null;
  }
  try {
    const { Geocoder } = await loadGeocodingLibrary();
    const geocoder = new Geocoder();

    return new Promise((resolve) => {
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
          resolve(extractAddressComponents(results[0]));
        } else {
          resolve(null);
        }
      });
    });
  } catch {
    return null;
  }
}
