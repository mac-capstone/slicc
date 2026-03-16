/**
 * Event-related utilities: date normalization, filtering, and selection.
 */

import type { EventIdT, EventWithId } from '@/types';

function toEventDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function filterAndSortUpcomingEvents(
  events: EventWithId[],
  limit?: number
): EventWithId[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = events
    .filter((e) => toEventDate(e.startDate).getTime() >= today.getTime())
    .sort(
      (a, b) =>
        toEventDate(a.startDate).getTime() - toEventDate(b.startDate).getTime()
    );

  return limit != null ? result.slice(0, limit) : result;
}

/**
 * Returns the most relevant event ID from a list: upcoming first (nearest),
 * or the most recent past event if none are upcoming.
 */
export function getMostRelevantEventId(
  eventIds: string[],
  eventMap: Map<string, EventWithId>
): EventIdT | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const events = eventIds
    .map((id) => eventMap.get(id))
    .filter((e): e is EventWithId => e != null);

  const upcoming = events
    .filter((e) => toEventDate(e.startDate).getTime() >= today.getTime())
    .sort(
      (a, b) =>
        toEventDate(a.startDate).getTime() - toEventDate(b.startDate).getTime()
    );

  if (upcoming.length > 0) return upcoming[0].id;

  const past = events.sort(
    (a, b) =>
      toEventDate(b.startDate).getTime() - toEventDate(a.startDate).getTime()
  );
  return past[0]?.id ?? null;
}
