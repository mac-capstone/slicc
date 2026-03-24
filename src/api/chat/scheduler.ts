import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '@/api/common/firebase';

/** Map of userId -> array of available ISO-8601 slot strings ("YYYY-MM-DDTHH:MM"). */
export type GroupAvailability = Record<string, string[]>;

/**
 * Module-level cache: groupId -> availability snapshot.
 * Persists across modal open/close so reopening the scheduler never triggers
 * a cold re-read of the entire subcollection.
 */
const availabilityCache = new Map<string, GroupAvailability>();

/** Real-time subscription to all members' availability for a group. */
export function useGroupAvailability(
  groupId: string | null
): GroupAvailability {
  // Seed from cache so the modal renders immediately with the last known state
  const [availability, setAvailability] = useState<GroupAvailability>(() =>
    groupId ? (availabilityCache.get(groupId) ?? {}) : {}
  );

  useEffect(() => {
    if (!groupId) return;

    const ref = collection(db, 'groups', groupId, 'availability');

    // docChanges() means subsequent snapshots only process the member docs that
    // actually changed, not the entire collection on every write.
    const unsub = onSnapshot(ref, (snap) => {
      const data: GroupAvailability = {
        ...(availabilityCache.get(groupId) ?? {}),
      };
      snap.docChanges().forEach((change) => {
        if (change.type === 'removed') {
          delete data[change.doc.id];
        } else {
          data[change.doc.id] = (change.doc.data().slots as string[]) ?? [];
        }
      });
      availabilityCache.set(groupId, data);
      setAvailability({ ...data });
    });

    return () => unsub();
  }, [groupId]);

  return availability;
}

/** Write the current user's available time slots. */
export async function setMyAvailability(
  groupId: string,
  userId: string,
  slots: string[]
): Promise<void> {
  await setDoc(doc(db, 'groups', groupId, 'availability', userId), {
    slots,
    updatedAt: Timestamp.now(),
  });
}

/** Build a slot key from a date and hour/minute. */
export function buildSlotKey(date: Date, hour: number, minute: 0 | 30): string {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
}

/** Get slot keys for a week starting from `startDate`. */
export function getWeekSlots(startDate: Date): string[] {
  const slots: string[] = [];
  for (let day = 0; day < 7; day++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + day);
    for (let hour = 9; hour < 23; hour++) {
      slots.push(buildSlotKey(d, hour, 0));
      slots.push(buildSlotKey(d, hour, 30));
    }
  }
  return slots;
}

/** Count how many users are available in each slot. */
export function computeSlotCounts(
  availability: GroupAvailability
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const slots of Object.values(availability)) {
    for (const slot of slots) {
      counts[slot] = (counts[slot] ?? 0) + 1;
    }
  }
  return counts;
}

const DAY_LABELS_ORDERED = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Per-row entry: which user, and on which specific days of the displayed week
 * they have a slot at this hour:minute.
 */
export type TimeRowUserEntry = {
  uid: string;
  /** Abbreviated day labels sorted by week order, e.g. ["Mo", "We", "Fr"] */
  days: string[];
};

/**
 * For each HH:MM time key, return entries with per-user per-day breakdown
 * for the given week. Used by the overlap panel to the right of the grid.
 */
export function computeTimeRowUsers(
  availability: GroupAvailability,
  weekStart: Date
): Record<string, TimeRowUserEntry[]> {
  const weekEndMs = weekStart.getTime() + 7 * 24 * 60 * 60 * 1000;

  // timeKey → uid → Set<dayIndex (0=Su … 6=Sa)>
  const map: Record<string, Record<string, Set<number>>> = {};

  for (const [userId, slots] of Object.entries(availability)) {
    for (const slot of slots) {
      // buildSlotKey stores time via toISOString() (UTC). Parsing the string
      // without a timezone suffix would make JS treat it as local, shifting the
      // time by the UTC offset. Appending 'Z' forces UTC parsing so that
      // getHours()/getDay() return correct LOCAL values.
      const date = new Date(slot + 'Z');
      const ms = date.getTime();
      if (ms >= weekStart.getTime() && ms < weekEndMs) {
        const timeKey = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        const dayIndex = date.getDay();
        if (!map[timeKey]) map[timeKey] = {};
        if (!map[timeKey][userId]) map[timeKey][userId] = new Set();
        map[timeKey][userId].add(dayIndex);
      }
    }
  }

  const result: Record<string, TimeRowUserEntry[]> = {};
  for (const [timeKey, userMap] of Object.entries(map)) {
    result[timeKey] = Object.entries(userMap).map(([uid, dayIndexSet]) => ({
      uid,
      days: Array.from(dayIndexSet)
        .sort((a, b) => a - b)
        .map((i) => DAY_LABELS_ORDERED[i]),
    }));
  }
  return result;
}
