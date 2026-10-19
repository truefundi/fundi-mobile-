import { Linking, Platform } from 'react-native';

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type NormalizedLocation = {
  latitude?: number;
  longitude?: number;
  address?: string;
  landmark?: string;
};

function validCoordinates(latitude: unknown, longitude: unknown): Coordinates | null {
  if (
    (typeof latitude === 'string' && latitude.trim() === '') ||
    (typeof longitude === 'string' && longitude.trim() === '')
  ) {
    return null;
  }
  const lat = typeof latitude === 'number' || typeof latitude === 'string' ? Number(latitude) : NaN;
  const lon = typeof longitude === 'number' || typeof longitude === 'string' ? Number(longitude) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return null;
  }
  return { latitude: lat, longitude: lon };
}

function coordinatesFrom(value: unknown, depth = 0): Coordinates | null {
  if (typeof value === 'string') {
    const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    return match ? validCoordinates(match[1], match[2]) : null;
  }
  if (depth > 4 || value === null || typeof value !== 'object') return null;
  if (Array.isArray(value) && value.length >= 2) return validCoordinates(value[1], value[0]);
  const record = value as Record<string, unknown>;
  const direct = validCoordinates(
    record.latitude ?? record.lat,
    record.longitude ?? record.lng ?? record.lon,
  );
  if (direct) return direct;

  const nestedKeys = ['coords', 'coordinate', 'location', 'geometry', 'position', 'coordinates'];
  for (const key of nestedKeys) {
    const nested = record[key];
    if (Array.isArray(nested) && nested.length >= 2) {
      const pair = validCoordinates(nested[1], nested[0]);
      if (pair) return pair;
    }
    const found = coordinatesFrom(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

/** Normalizes picker objects, nested coordinate objects, and the app's existing "lat, lng" string. */
export function normalizeLocationSelection(selection: unknown): NormalizedLocation {
  let coordinates: Coordinates | null = null;
  if (typeof selection === 'string') {
    const match = selection.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (match) coordinates = validCoordinates(match[1], match[2]);
  } else {
    coordinates = coordinatesFrom(selection);
  }

  const record = selection && typeof selection === 'object' ? (selection as Record<string, unknown>) : {};
  const addressValue = record.address ?? record.formattedAddress ?? record.formatted_address;
  const landmarkValue = record.landmark ?? record.nearbyLandmark;

  return {
    ...(coordinates ?? {}),
    ...(typeof addressValue === 'string' && addressValue.trim() ? { address: addressValue.trim() } : {}),
    ...(typeof landmarkValue === 'string' && landmarkValue.trim() ? { landmark: landmarkValue.trim() } : {}),
  };
}

export function hasValidCoordinates(value: unknown): boolean {
  return coordinatesFrom(value) !== null;
}

export function distanceMeters(from: unknown, to: unknown): number | null {
  const origin = coordinatesFrom(from);
  const destination = coordinatesFrom(to);
  if (!origin || !destination) return null;

  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(destination.latitude - origin.latitude);
  const longitudeDelta = radians(destination.longitude - origin.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(origin.latitude)) *
      Math.cos(radians(destination.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(meters: number | null): string | null {
  if (meters === null || !Number.isFinite(meters) || meters < 0) return null;
  if (meters < 1_000) return `${Math.round(meters)} m away`;
  const kilometers = meters / 1_000;
  return `${Number(kilometers.toFixed(1))} km away`;
}

export function googleMapsUrl(value: unknown): string | null {
  const coordinates = coordinatesFrom(value);
  return coordinates
    ? `https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`
    : null;
}

export type MapLocationInput =
  | {
      latitude?: number | string | null;
      longitude?: number | string | null;
      lat?: number | string | null;
      lng?: number | string | null;
      lon?: number | string | null;
      locationLatitude?: number | string | null;
      locationLongitude?: number | string | null;
      address?: string | null;
      locationLabel?: string | null;
      label?: string | null;
      landmark?: string | null;
    }
  | string
  | null
  | undefined;

/**
 * Normalizes coordinate / address inputs from either:
 * - (latitude, longitude, fallbackAddress)
 * - an object containing coordinates, address, or location fields
 * - a raw coordinate string or address string
 */
export function extractMapTarget(
  targetOrLat?: MapLocationInput | number | null,
  longitude?: number | string | null,
  fallbackAddress?: string | null,
): { coordinates: Coordinates | null; address: string | null } {
  let coordinates: Coordinates | null = null;
  let address: string | null = null;

  if (typeof targetOrLat === 'number' || (typeof targetOrLat === 'string' && longitude !== undefined && longitude !== null)) {
    coordinates = validCoordinates(targetOrLat, longitude);
    if (typeof fallbackAddress === 'string' && fallbackAddress.trim()) {
      address = fallbackAddress.trim();
    }
  } else if (typeof targetOrLat === 'string') {
    coordinates = coordinatesFrom(targetOrLat);
    if (!coordinates && targetOrLat.trim()) {
      address = targetOrLat.trim();
    } else if (typeof fallbackAddress === 'string' && fallbackAddress.trim()) {
      address = fallbackAddress.trim();
    }
  } else if (targetOrLat && typeof targetOrLat === 'object') {
    coordinates = coordinatesFrom(targetOrLat);
    const rec = targetOrLat as Record<string, unknown>;
    const addr =
      rec.address ??
      rec.locationLabel ??
      rec.formattedAddress ??
      rec.formatted_address ??
      rec.landmark ??
      fallbackAddress;
    if (typeof addr === 'string' && addr.trim()) {
      address = addr.trim();
    }
  }

  return { coordinates, address };
}

/**
 * Checks if sufficient information (valid coordinates or non-empty address string)
 * is available to launch a map navigation action.
 */
export function canOpenMapNavigation(
  targetOrLat?: MapLocationInput | number | null,
  longitude?: number | string | null,
  fallbackAddress?: string | null,
): boolean {
  const { coordinates, address } = extractMapTarget(targetOrLat, longitude, fallbackAddress);
  return coordinates !== null || (typeof address === 'string' && address.trim().length > 0);
}

/**
 * Native navigation launcher with full cross-platform map app fallback support:
 * - iOS: Attempts Apple Maps turn-by-turn (`http://maps.apple.com/?daddr=lat,lng` or `maps:0,0?q=...`)
 *        -> Google Maps iOS app (`comgooglemaps://?daddr=lat,lng&directionsmode=driving`)
 *        -> Universal Web fallback
 * - Android: Attempts Google Navigation intent (`google.navigation:q=lat,lng`)
 *            -> Native geo intent (`geo:0,0?q=lat,lng`)
 *            -> Universal Web fallback
 * - Universal Web Fallback: Launches Google Maps in browser (`https://www.google.com/maps/dir/?api=1&destination=lat,lng`)
 *
 * Can be called with (latitude, longitude, fallbackAddress) OR an object.
 */
export async function openMapNavigation(
  targetOrLat?: MapLocationInput | number | null,
  longitude?: number | string | null,
  fallbackAddress?: string | null,
): Promise<boolean> {
  const { coordinates, address } = extractMapTarget(targetOrLat, longitude, fallbackAddress);

  if (!coordinates && (!address || !address.trim())) {
    return false;
  }

  const hasCoords = coordinates !== null;
  const lat = coordinates?.latitude;
  const lng = coordinates?.longitude;
  const encodedAddress = address ? encodeURIComponent(address.trim()) : '';
  const encodedLabel = encodedAddress || (hasCoords ? `${lat},${lng}` : '');

  // Universal Web Fallback URL
  const webFallbackUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;

  // On Web browser platform, directly open the web fallback
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.open) {
        window.open(webFallbackUrl, '_blank');
      } else {
        await Linking.openURL(webFallbackUrl);
      }
      return true;
    } catch {
      return false;
    }
  }

  const candidateUrls: string[] = [];

  if (Platform.OS === 'ios') {
    if (hasCoords) {
      // 1. Apple Maps turn-by-turn directions & native maps scheme
      candidateUrls.push(`http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`);
      candidateUrls.push(`maps:0,0?q=${encodedLabel}&daddr=${lat},${lng}`);
      // 2. Google Maps iOS app
      candidateUrls.push(`comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`);
    } else {
      candidateUrls.push(`http://maps.apple.com/?daddr=${encodedAddress}&dirflg=d`);
      candidateUrls.push(`maps:0,0?q=${encodedAddress}`);
      candidateUrls.push(`comgooglemaps://?daddr=${encodedAddress}&directionsmode=driving`);
    }
  } else if (Platform.OS === 'android') {
    if (hasCoords) {
      // 1. Google Navigation intent
      candidateUrls.push(`google.navigation:q=${lat},${lng}&mode=d`);
      // 2. Native geo intent with coordinates and optional label
      candidateUrls.push(`geo:0,0?q=${lat},${lng}${encodedLabel ? `(${encodedLabel})` : ''}`);
    } else {
      candidateUrls.push(`google.navigation:q=${encodedAddress}&mode=d`);
      candidateUrls.push(`geo:0,0?q=${encodedAddress}`);
    }
  } else {
    candidateUrls.push(webFallbackUrl);
  }

  // Attempt each candidate in order via canOpenURL and openURL
  for (const url of candidateUrls) {
    try {
      const canOpen = await Linking.canOpenURL(url).catch(() => false);
      if (canOpen) {
        await Linking.openURL(url);
        return true;
      }
    } catch {
      // Continue to next candidate
    }
  }

  // Universal Web Fallback if no native app could open
  try {
    await Linking.openURL(webFallbackUrl);
    return true;
  } catch (error) {
    console.warn('Could not launch map navigation URL:', error);
    return false;
  }
}
