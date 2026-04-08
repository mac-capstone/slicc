import type { PriceLevel } from '@/api/places/places-api';

const PRICE_LABELS: Record<PriceLevel, string> = {
  FREE: 'Free',
  INEXPENSIVE: 'Inexpensive ($)',
  MODERATE: 'Moderate ($$)',
  EXPENSIVE: 'Expensive ($$$)',
  VERY_EXPENSIVE: 'Very expensive ($$$$)',
};

const COMPACT_PRICE: Record<PriceLevel, string> = {
  FREE: 'Free',
  INEXPENSIVE: '$',
  MODERATE: '$$',
  EXPENSIVE: '$$$',
  VERY_EXPENSIVE: '$$$$',
};

export function formatPriceLevelForDisplay(
  level: PriceLevel | undefined
): string | null {
  if (!level) return null;
  return PRICE_LABELS[level] ?? null;
}

export function formatCompactPrice(
  level: PriceLevel | undefined
): string | null {
  if (!level) return null;
  return COMPACT_PRICE[level] ?? null;
}

/** Google Places primary type, e.g. `italian_restaurant` → "Italian Restaurant" */
export function formatPlaceCategoryLabel(
  primaryType: string | undefined
): string | null {
  if (!primaryType) return null;
  return primaryType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const NOISY_TYPES = new Set([
  'establishment',
  'point_of_interest',
  'food',
  'store',
  'health',
]);

export function getDisplayTags(types: string[] | undefined): string[] {
  if (!types) return [];
  return types
    .filter((t) => !NOISY_TYPES.has(t))
    .slice(0, 6)
    .map((t) => t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
}

export function formatOpeningHoursSummary(
  weekdayDescriptions: string[] | undefined
): string | null {
  if (!weekdayDescriptions || weekdayDescriptions.length === 0) return null;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const match = weekdayDescriptions.find((d) =>
    d.toLowerCase().startsWith(today.toLowerCase().slice(0, 3))
  );
  return match ?? weekdayDescriptions[0] ?? null;
}

type OpenStatusResult = {
  isOpen: boolean;
  label: string;
};

/**
 * Derives an "Open · Closes 10 PM" or "Closed · Opens 9 AM" label from
 * the regularOpeningHours payload. Returns null when data is insufficient.
 */
export function formatOpenStatus(
  openingHours:
    | { openNow?: boolean; weekdayDescriptions?: string[] }
    | undefined
): OpenStatusResult | null {
  if (!openingHours || openingHours.openNow === undefined) return null;

  const isOpen = openingHours.openNow;
  const descriptions = openingHours.weekdayDescriptions;
  const timeSuffix = extractTimeSuffix(isOpen, descriptions);

  return {
    isOpen,
    label: timeSuffix
      ? isOpen
        ? `Open · Closes ${timeSuffix}`
        : `Closed · Opens ${timeSuffix}`
      : isOpen
        ? 'Open now'
        : 'Closed',
  };
}

/** Same dash pattern as range splitting elsewhere in this module. */
const RANGE_DASH = /\s*[–—-]\s*/;

/**
 * Parses a Google weekday line time like "9:00 AM" into a Date on the same
 * calendar day as `reference` (local time).
 */
function parseTimeStringToToday(timeStr: string, reference: Date): Date | null {
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  const meridiem = m[3].toUpperCase();
  if (meridiem === 'AM') {
    if (hours === 12) hours = 0;
  } else if (hours !== 12) {
    hours += 12;
  }
  const d = new Date(reference);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * For split-hour schedules, returns the first range start time string that is
 * strictly after `now`. Avoids showing the first range's opening when it has
 * already passed (e.g. between lunch and dinner break).
 */
function findFirstFutureOpeningFromRanges(
  ranges: string[],
  now: Date
): string | null {
  for (const range of ranges) {
    const parts = range.split(RANGE_DASH).map((p) => p.trim());
    if (parts.length === 0) continue;
    const startStr = parts[0];
    if (!startStr) continue;
    const startAt = parseTimeStringToToday(startStr, now);
    if (startAt !== null && startAt.getTime() > now.getTime()) {
      return startStr;
    }
  }
  return null;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Parses a single opening range against a calendar day anchor; if end is at or
 * before start (overnight), extends end to the next calendar day.
 */
function rangeBoundsMs(
  startStr: string,
  endStr: string,
  dayAnchor: Date
): { startMs: number; endMs: number } | null {
  const startAt = parseTimeStringToToday(startStr, dayAnchor);
  const endAt = parseTimeStringToToday(endStr, dayAnchor);
  if (!startAt || !endAt) return null;
  let startMs = startAt.getTime();
  let endMs = endAt.getTime();
  if (endMs <= startMs) {
    endMs += 86400000;
  }
  return { startMs, endMs };
}

/**
 * When open, pick the closing time for the comma-separated range that contains
 * `now` (start <= now < end). Tries today's and yesterday's calendar day as
 * anchors so overnight windows (e.g. 10 PM – 2 AM) resolve correctly.
 */
function findClosingEndForOpenNow(ranges: string[], now: Date): string | null {
  const t = now.getTime();
  const todayStart = startOfLocalDay(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  for (const dayAnchor of [todayStart, yesterdayStart]) {
    for (const range of ranges) {
      const parts = range.split(RANGE_DASH).map((p) => p.trim());
      if (parts.length < 2) continue;
      const startStr = parts[0];
      const endStr = parts[parts.length - 1];
      if (!startStr || !endStr) continue;

      const b = rangeBoundsMs(startStr, endStr, dayAnchor);
      if (!b) continue;
      if (t >= b.startMs && t < b.endMs) {
        return endStr.trim();
      }
    }
  }
  return null;
}

function extractTimeSuffix(
  isOpen: boolean,
  descriptions: string[] | undefined
): string | null {
  if (!descriptions || descriptions.length === 0) return null;

  const now = new Date();
  const todayKey = now
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toLowerCase()
    .slice(0, 3);

  const todayLine = descriptions.find((d) =>
    d.toLowerCase().startsWith(todayKey)
  );
  if (!todayLine) return null;

  const afterColon = todayLine.split(':').slice(1).join(':').trim();
  if (!afterColon || /closed/i.test(afterColon)) {
    if (!isOpen) {
      const tomorrowTime = getNextDayOpenTime(descriptions, now);
      return tomorrowTime ? `tomorrow ${tomorrowTime}` : null;
    }
    return null;
  }

  const ranges = afterColon.split(',').map((r) => r.trim());
  if (isOpen) {
    const fromContaining = findClosingEndForOpenNow(ranges, now);
    if (fromContaining !== null) return fromContaining;

    const lastRange = ranges[ranges.length - 1];
    const closePart = lastRange.split(RANGE_DASH);
    return closePart.length > 1 ? closePart[closePart.length - 1].trim() : null;
  }

  const nextStartToday = findFirstFutureOpeningFromRanges(ranges, now);
  if (nextStartToday !== null) return nextStartToday;

  const tomorrowTime = getNextDayOpenTime(descriptions, now);
  return tomorrowTime ? `tomorrow ${tomorrowTime}` : null;
}

function getNextDayOpenTime(descriptions: string[], now: Date): string | null {
  const dayNames = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  const tomorrowIdx = (now.getDay() + 1) % 7;
  const tomorrowKey = dayNames[tomorrowIdx].slice(0, 3);
  const line = descriptions.find((d) =>
    d.toLowerCase().startsWith(tomorrowKey)
  );
  if (!line) return null;
  const afterColon = line.split(':').slice(1).join(':').trim();
  if (!afterColon || /closed/i.test(afterColon)) return null;
  const firstRange = afterColon.split(',')[0].trim();
  const openPart = firstRange.split(RANGE_DASH);
  return openPart.length > 0 ? openPart[0].trim() : null;
}
