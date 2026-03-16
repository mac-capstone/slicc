import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchGroup, useGroupIds } from '@/api/groups/use-groups';
import { filterAndSortUpcomingEvents } from '@/lib/event-utils';
import type { EventIdT, EventWithId, UserIdT } from '@/types';

import { fetchEvent } from './use-events';

export function useUpcomingEvents(userId: UserIdT | null, limit = 3) {
  const { data: groupIds = [], isPending: groupsIdsPending } = useGroupIds({
    variables: userId,
  });

  const groupQueries = useQueries({
    queries: groupIds.map((id) => ({
      queryKey: ['groups', 'groupId', id] as const,
      queryFn: () => fetchGroup(id),
    })),
  });

  const groups = groupQueries
    .map((q) => q.data)
    .filter((g): g is NonNullable<typeof g> => g != null);

  const allEventIds = useMemo(
    () => [...new Set(groups.flatMap((g) => g.events))],
    [groups]
  );

  const eventQueries = useQueries({
    queries: allEventIds.map((id) => ({
      queryKey: ['events', 'eventId', id] as const,
      queryFn: () => fetchEvent(id as EventIdT),
    })),
  });

  const upcomingEvents = useMemo((): EventWithId[] => {
    const events = eventQueries
      .map((q) => q.data)
      .filter((e): e is EventWithId => e != null);
    return filterAndSortUpcomingEvents(events, limit);
  }, [eventQueries, limit]);

  const isPending =
    groupsIdsPending ||
    groupQueries.some((q) => q.isPending) ||
    eventQueries.some((q) => q.isPending);
  const isError =
    groupQueries.some((q) => q.isError) || eventQueries.some((q) => q.isError);

  return {
    data: upcomingEvents,
    isPending,
    isError,
  };
}
