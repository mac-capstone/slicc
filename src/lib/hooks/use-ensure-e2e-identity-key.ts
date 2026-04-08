import { useEffect } from 'react';

import { ensureIdentityKeyPair } from '@/api/chat/key-api';
import type { UserIdT } from '@/types';

const checkedUsersThisSession = new Set<UserIdT>();

/**
 * Ensures the signed-in user's E2E identity setup is checked once per app
 * session. No retries are done until the app is restarted.
 */
export function useEnsureE2EIdentityKey(userId: UserIdT | null): void {
  useEffect(() => {
    if (!userId || userId === 'guest_user') return;
    if (checkedUsersThisSession.has(userId)) return;

    checkedUsersThisSession.add(userId);

    void ensureIdentityKeyPair(userId).catch((e) => {
      console.warn('useEnsureE2EIdentityKey failed:', e);
    });
  }, [userId]);
}
