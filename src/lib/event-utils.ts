/**
 * Event-related utilities: date normalization, filtering, and selection.
 */

import type { EventIdT, EventWithId } from '@/types';

function toEventDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export type CategorizedEvents = {
  upcoming: EventWithId[];
  current: EventWithId[];
  past: EventWithId[];
};

export function categorizeEvents(events: EventWithId[]): CategorizedEvents {
  const now = new Date().getTime();
  const upcoming: EventWithId[] = [];
  const current: EventWithId[] = [];
  const past: EventWithId[] = [];

  for (const e of events) {
    const start = toEventDate(e.startDate).getTime();
    const end = toEventDate(e.endDate).getTime();
    if (start > now) {
      upcoming.push(e);
    } else if (end >= now) {
      current.push(e);
    } else {
      past.push(e);
    }
  }

  upcoming.sort(
    (a, b) =>
      toEventDate(a.startDate).getTime() - toEventDate(b.startDate).getTime()
  );
  current.sort(
    (a, b) =>
      toEventDate(a.startDate).getTime() - toEventDate(b.startDate).getTime()
  );
  past.sort(
    (a, b) =>
      toEventDate(b.startDate).getTime() - toEventDate(a.startDate).getTime()
  );

  return { upcoming, current, past };
}

export function filterAndSortUpcomingEvents(
  events: EventWithId[],
  limit?: number
): EventWithId[] {
  const now = new Date();

  const result = events
    .filter((e) => toEventDate(e.startDate).getTime() >= now.getTime())
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
  const now = new Date();

  const events = eventIds
    .map((id) => eventMap.get(id))
    .filter((e): e is EventWithId => e != null);

  const upcoming = events
    .filter((e) => toEventDate(e.startDate).getTime() >= now.getTime())
    .sort(
      (a, b) =>
        toEventDate(a.startDate).getTime() - toEventDate(b.startDate).getTime()
    );

  if (upcoming.length > 0) return upcoming[0].id;

  const past = [...events].sort(
    (a, b) =>
      toEventDate(b.startDate).getTime() - toEventDate(a.startDate).getTime()
  );
  return past[0]?.id ?? null;
}
