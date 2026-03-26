import type { Place } from '@/api/places/places-api';

/**
 * Opens Google Maps for a place. Prefers Place ID when available, then
 * coordinates, then a text search.
 */
export function buildGoogleMapsPlaceUrl(place: Place): string {
  const id = place.id?.trim() ?? '';
  const isLikelyGooglePlaceId = id.length > 0 && !/^[0-9a-f-]{36}$/i.test(id);

  if (isLikelyGooglePlaceId) {
    return `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(id)}`;
  }

  if (place.location) {
    const q = `${place.location.latitude},${place.location.longitude}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.displayName)}`;
}
