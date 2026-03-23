import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchUser } from '@/api/people/use-users';
import type { IncomingFriendRequest } from '@/api/social/friend-requests';
import type { UserIdT } from '@/types';

export type IncomingFriendRequestRow = IncomingFriendRequest & {
  displayName: string;
  handle: string;
};

/**
 * Resolves sender profiles for pending incoming friend requests (display name + @username handle).
 */
export function useIncomingFriendRequestRows(
  incomingFriendRequests: IncomingFriendRequest[]
): IncomingFriendRequestRow[] {
  const incomingFromIds = useMemo(
    () => [...new Set(incomingFriendRequests.map((r) => r.fromUserId))],
    [incomingFriendRequests]
  );

  const incomingSenderQueries = useQueries({
    queries: incomingFromIds.map((id) => ({
      queryKey: ['users', 'userId', id] as const,
      queryFn: () => fetchUser(id as UserIdT),
      enabled: incomingFromIds.length > 0,
    })),
  });

  return useMemo((): IncomingFriendRequestRow[] => {
    return incomingFriendRequests.map((req) => {
      const idx = incomingFromIds.indexOf(req.fromUserId);
      const user = idx >= 0 ? incomingSenderQueries[idx]?.data : undefined;
      const displayName = user?.displayName || 'Unknown';
      const username = user?.username?.trim();
      const handle = `@${username || req.fromUserId}`;
      return {
        ...req,
        displayName,
        handle,
      };
    });
  }, [incomingFriendRequests, incomingFromIds, incomingSenderQueries]);
}
