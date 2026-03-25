import { useEffect, useRef } from 'react';

import {
  getPlaceLikesForUser,
  setPlaceLikes,
} from '@/api/places/place-likes-api';
import { useAuth } from '@/lib/auth';
import { usePlacePreferences } from '@/lib/place-preferences';
import { getItem, setItem } from '@/lib/storage';

const PLACE_LIKES_SYNCED_KEY = 'place_likes_synced';

function getMigrationFlagKey(userId: string): string {
  return `${PLACE_LIKES_SYNCED_KEY}_${userId}`;
}

/**
 * Syncs local place likes (MMKV) to Firestore when user is signed in.
 * One-time migration: if Firestore is empty but local has likes, uploads them.
 * Ongoing: syncs on every placeRatings change.
 */
export function usePlaceLikesFirestoreSync(): void {
  const userId = useAuth.use.userId();
  const placeRatings = usePlacePreferences.use.placeRatings();
  const migrationCheckedRef = useRef(false);

  useEffect(() => {
    if (!userId || userId === 'guest_user') return;

    const likedIds = Object.entries(placeRatings)
      .filter(([, r]) => r === 'up')
      .map(([id]) => id);

    const runSync = (): void => {
      setPlaceLikes(userId!, likedIds).catch((err) => {
        console.warn('[usePlaceLikesFirestoreSync] sync failed', err);
      });
    };

    if (!migrationCheckedRef.current) {
      migrationCheckedRef.current = true;
      const flagKey = getMigrationFlagKey(userId);
      if (!getItem<boolean>(flagKey)) {
        getPlaceLikesForUser(userId).then((firestoreIds) => {
          setItem(flagKey, true);
          if (firestoreIds.length === 0 && likedIds.length > 0) {
            setPlaceLikes(userId, likedIds).catch((err) => {
              console.warn(
                '[usePlaceLikesFirestoreSync] migration failed',
                err
              );
            });
          }
        });
        return;
      }
    }

    runSync();
  }, [userId, placeRatings]);
}
