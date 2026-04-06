import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

export type UserLocation = {
  latitude: number;
  longitude: number;
};

const LOG = '[Location]';
const LOCATION_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

type FetchLocationOptions = {
  /** Caller already obtained `granted` from `requestForegroundPermissionsAsync` (or equivalent). */
  foregroundGranted?: boolean;
};

async function fetchLocation(options?: FetchLocationOptions): Promise<{
  latitude: number;
  longitude: number;
} | null> {
  if (!options?.foregroundGranted) {
    const { status: perm } = await Location.requestForegroundPermissionsAsync();
    console.log(`${LOG} Permission status: ${perm}`);
    if (perm !== 'granted') {
      console.log(`${LOG} Permission denied, skipping location fetch`);
      return null;
    }
  }

  let pos: Location.LocationObject | null = null;
  try {
    console.log(
      `${LOG} Calling getCurrentPositionAsync (timeout ${LOCATION_TIMEOUT_MS}ms)...`
    );
    pos = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
        mayShowUserSettingsDialog: false,
      }),
      LOCATION_TIMEOUT_MS
    );
    console.log(
      `${LOG} getCurrentPositionAsync success: ${pos.coords.latitude}, ${pos.coords.longitude}`
    );
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    };
  } catch (err) {
    console.warn(
      `${LOG} getCurrentPositionAsync failed (timeout or error):`,
      err
    );
  }

  console.log(`${LOG} Falling back to getLastKnownPositionAsync...`);
  try {
    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: 5 * 60 * 1000,
    });
    if (lastKnown) {
      console.log(
        `${LOG} getLastKnownPositionAsync success: ${lastKnown.coords.latitude}, ${lastKnown.coords.longitude}`
      );
      return {
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
      };
    }
    console.log(
      `${LOG} getLastKnownPositionAsync returned null (no cached location)`
    );
  } catch (err) {
    console.warn(`${LOG} getLastKnownPositionAsync failed:`, err);
  }

  console.log(`${LOG} Location unavailable - all methods failed`);
  return null;
}

export function useUserLocation(enabled = true): {
  location: UserLocation | null;
  status: Location.PermissionStatus | null;
  refresh: () => Promise<void>;
} {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [status, setStatus] = useState<Location.PermissionStatus | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    console.log(`${LOG} refresh() called`);
    const { status: perm } = await Location.requestForegroundPermissionsAsync();
    setStatus(perm);
    if (perm !== 'granted') return;
    const coords = await fetchLocation({ foregroundGranted: true });
    setLocation(coords);
    console.log(`${LOG} Final location:`, coords ?? 'null');
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { location, status, refresh };
}
