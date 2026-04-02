import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useGroupIds } from '@/api/groups/use-groups';
import { type CategorizedEvents, categorizeEvents } from '@/lib/event-utils';
import type { EventWithId, UserIdT } from '@/types';

import { eventKeys, fetchEventsByGroupId } from './use-events';

export function useUpcomingEvents(
  userId: UserIdT | null,
  options?: { currentLimit?: number; upcomingLimit?: number }
) {
  const currentLimit = options?.currentLimit ?? 3;
  const upcomingLimit = options?.upcomingLimit ?? 3;

  const { data: groupIds = [], isPending: groupsIdsPending } = useGroupIds({
    variables: userId,
  });

  const eventQueries = useQueries({
    queries: groupIds.map((groupId) => ({
      queryKey: [...eventKeys.all, 'groupId', groupId] as const,
      queryFn: () => fetchEventsByGroupId(groupId),
    })),
  });

  const categorized = useMemo((): CategorizedEvents => {
    const events = eventQueries
      .flatMap((q) => q.data ?? [])
      .filter((e): e is EventWithId => e != null);
    const deduped = [...new Map(events.map((e) => [e.id, e])).values()];
    const { upcoming, current, past } = categorizeEvents(deduped);
    return {
      upcoming: upcoming.slice(0, upcomingLimit),
      current: current.slice(0, currentLimit),
      past,
    };
  }, [eventQueries, currentLimit, upcomingLimit]);

  const isPending = groupsIdsPending || eventQueries.some((q) => q.isPending);
  const isError = eventQueries.some((q) => q.isError);

  return {
    data: categorized,
    isPending,
    isError,
  };
}
