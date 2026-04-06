import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { ensureIdentityKeyPair } from '@/api/chat/key-api';
import type { UserIdT } from '@/types';

const RETRY_INTERVAL_MS = 60 * 1000;
const MIN_ATTEMPT_GAP_MS = 10 * 1000;

/**
 * Proactively ensures the signed-in user's E2E identity keys exist locally
 * and their public key is synced to Firestore (best effort, with retries).
 */
export function useEnsureE2EIdentityKey(userId: UserIdT | null): void {
  const lastAttemptAtRef = useRef(0);

  const ensureReady = useCallback(async () => {
    if (!userId || userId === 'guest_user') return;

    const now = Date.now();
    if (now - lastAttemptAtRef.current < MIN_ATTEMPT_GAP_MS) return;
    lastAttemptAtRef.current = now;

    try {
      await ensureIdentityKeyPair(userId);
    } catch (e) {
      console.warn('useEnsureE2EIdentityKey failed:', e);
    }
  }, [userId]);

  useEffect(() => {
    void ensureReady();
  }, [ensureReady]);

  useEffect(() => {
    if (!userId || userId === 'guest_user') return;

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void ensureReady();
      }
    });

    const interval = setInterval(() => {
      void ensureReady();
    }, RETRY_INTERVAL_MS);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [ensureReady, userId]);
}
