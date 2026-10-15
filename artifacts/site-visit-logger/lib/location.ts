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
