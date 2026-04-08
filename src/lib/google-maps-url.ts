import { Platform } from 'react-native';

import type { Place } from '@/api/places/places-api';

/**
 * Build a platform-native maps URL for a place.
 * Android: `geo:` URI triggers the system maps chooser (Google Maps, Waze, etc.).
 * iOS: Apple Maps URL.
 */
export function buildGoogleMapsPlaceUrl(place: Place): string {
  const label = place.displayName;

  if (Platform.OS === 'ios') {
    if (place.location) {
      const { latitude, longitude } = place.location;
      return `maps:0,0?q=${encodeURIComponent(label)}&ll=${latitude},${longitude}`;
    }
    return `maps:0,0?q=${encodeURIComponent(label)}`;
  }

  if (place.location) {
    const { latitude, longitude } = place.location;
    return `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(label)})`;
  }
  return `geo:0,0?q=${encodeURIComponent(label)}`;
}
