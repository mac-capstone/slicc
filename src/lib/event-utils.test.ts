import {
  categorizeEvents,
  filterAndSortUpcomingEvents,
  getMostRelevantEventId,
} from '@/lib/event-utils';
import { type EventWithId } from '@/types';

function ts(date: string): Date {
  return new Date(date);
}

describe('event-utils (business)', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-04T12:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  function mk(args: {
    id: string;
    start: string;
    end: string;
    overrides?: Partial<EventWithId>;
  }): EventWithId {
    const extra = args.overrides ?? {};
    return {
      id: args.id as EventWithId['id'],
      name: args.id,
      createdBy: 'u1',
      startDate: ts(args.start),
      endDate: ts(args.end),
      participants: [],
      ...extra,
    } as EventWithId;
  }

  it('categorizeEvents splits upcoming / current / past and sorts', () => {
    const events = [
      mk({ id: 'past', start: '2026-04-01', end: '2026-04-02' }),
      mk({ id: 'current', start: '2026-04-03', end: '2026-04-10' }),
      mk({ id: 'up1', start: '2026-04-10', end: '2026-04-11' }),
      mk({ id: 'up2', start: '2026-04-05', end: '2026-04-06' }),
    ];
    const { upcoming, current, past } = categorizeEvents(events);
    expect(past.map((e) => e.id)).toEqual(['past']);
    expect(current.map((e) => e.id)).toEqual(['current']);
    expect(upcoming.map((e) => e.id)).toEqual(['up2', 'up1']);
  });

  it('filterAndSortUpcomingEvents respects limit', () => {
    const events = [
      mk({ id: 'a', start: '2026-04-06', end: '2026-04-07' }),
      mk({ id: 'b', start: '2026-04-05', end: '2026-04-06' }),
    ];
    expect(filterAndSortUpcomingEvents(events, 1).map((e) => e.id)).toEqual([
      'b',
    ]);
  });

  it('getMostRelevantEventId prefers nearest upcoming, else latest past', () => {
    const e1 = mk({ id: 'e1', start: '2026-04-02', end: '2026-04-03' });
    const e2 = mk({ id: 'e2', start: '2026-04-20', end: '2026-04-21' });
    const map = new Map<string, EventWithId>([
      [e1.id, e1],
      [e2.id, e2],
    ]);
    expect(getMostRelevantEventId(['e1', 'e2'], map)).toBe(e2.id);
    expect(getMostRelevantEventId(['e1'], map)).toBe(e1.id);
  });
});
