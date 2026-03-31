import Feather from '@expo/vector-icons/Feather';
import Octicons from '@expo/vector-icons/Octicons';
import { useQueries } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  buildSlotKey,
  setMyAvailability,
  useGroupAvailability,
} from '@/api/chat/scheduler';
import { useGroup } from '@/api/groups/use-groups';
import { fetchUser } from '@/api/people/use-users';
import {
  SchedulerGrid,
  SchedulerLegendFooter,
} from '@/components/chat/scheduler-grid';
import { colors, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { perfLog } from '@/lib/perf-log';
import type { GroupIdT, UserIdT } from '@/types';

function startOfWeek(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 9); // 9 am – 10 pm
// Grid stops at 10:00 PM (no 10:30 PM row): 13 full hours * 2 + last hour * 1 = 27

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseLocalYmd(ymd: string): Date {
  const [y, m, day] = ymd.split('-').map(Number);
  const d = new Date();
  d.setFullYear(y, (m ?? 1) - 1, day ?? 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekSlotKeys(weekStart: Date): string[] {
  const keys: string[] = [];
  for (let day = 0; day < 7; day++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + day);
    for (let hour = HOURS[0]; hour < HOURS[0] + HOURS.length; hour++) {
      keys.push(buildSlotKey(d, hour, 0));
      if (hour < 22) keys.push(buildSlotKey(d, hour, 30));
    }
  }
  return keys;
}

export default function GroupAvailabilityScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ 'group-id'?: string | string[] }>();
  const groupId = (
    Array.isArray(params['group-id'])
      ? params['group-id'][0]
      : params['group-id']
  ) as GroupIdT | undefined;
  const userId = useAuth.use.userId() as UserIdT;

  const { data: group } = useGroup({
    variables: groupId as GroupIdT,
    enabled: Boolean(groupId),
  });
  const memberIds: string[] = group?.members ?? [];

  const memberQueries = useQueries({
    queries: memberIds.map((id) => ({
      queryKey: ['users', 'userId', id],
      queryFn: () => fetchUser(id as UserIdT),
      enabled: Boolean(groupId),
    })),
  });

  const memberNames = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    memberQueries.forEach((q) => {
      if (q.data) map[q.data.id] = q.data.displayName || q.data.username;
    });
    return map;
  }, [memberQueries]);

  const [weekOffset, setWeekOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  // Fast draft: weekKey (local YYYY-MM-DD) -> Set<slotIndex> (0..188)
  const [draftByWeek, setDraftByWeek] = useState<Record<string, Set<number>>>(
    {}
  );
  const [hasLocalEdits, setHasLocalEdits] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const weekStart = useMemo(() => startOfWeek(weekOffset), [weekOffset]);
  const availability = useGroupAvailability(groupId ?? '');

  const serverSlots = useMemo(
    () => (groupId ? (availability[userId] ?? []) : []),
    [availability, userId, groupId]
  );

  const weekKey = useMemo(() => localYmd(weekStart), [weekStart]);

  const weekSlotKeys = useMemo(() => getWeekSlotKeys(weekStart), [weekStart]);
  const weekKeyToIndex = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < weekSlotKeys.length; i++) map.set(weekSlotKeys[i], i);
    return map;
  }, [weekSlotKeys]);

  const serverWeekIndices = useMemo(() => {
    const set = new Set<number>();
    for (const k of serverSlots) {
      const idx = weekKeyToIndex.get(k);
      if (idx != null) set.add(idx);
    }
    return set;
  }, [serverSlots, weekKeyToIndex]);

  useEffect(() => {
    if (isDragging || hasLocalEdits) return;
    setDraftByWeek((prev) => {
      if (prev[weekKey]) return prev;
      return { ...prev, [weekKey]: serverWeekIndices };
    });
  }, [serverWeekIndices, isDragging, hasLocalEdits, weekKey]);

  const myWeekSlots = useMemo<Set<number>>(() => {
    return draftByWeek[weekKey] ?? serverWeekIndices;
  }, [draftByWeek, weekKey, serverWeekIndices]);

  const handleBatchUpdate = useCallback(
    (slots: Set<number>) => {
      setDraftByWeek((prev) => ({ ...prev, [weekKey]: new Set(slots) }));
      setHasLocalEdits(true);
    },
    [weekKey]
  );

  const handleSave = useCallback(async () => {
    if (!groupId || isSaving || !hasLocalEdits) return;
    setIsSaving(true);
    const t0 = Date.now();
    try {
      // Apply drafts (by week) onto the full server slot set, so saving one week
      // never erases availability for other weeks.
      const nextAll = new Set<string>(serverSlots);

      for (const [wk, indices] of Object.entries(draftByWeek)) {
        if (!indices) continue;
        // wk is local "YYYY-MM-DD" of weekStart; parse as local midnight.
        const wkStart = parseLocalYmd(wk);
        const keys = getWeekSlotKeys(wkStart);
        // Remove all slots for that week, then add selected indices.
        for (const k of keys) nextAll.delete(k);
        for (const idx of indices) {
          if (idx >= 0 && idx < keys.length) nextAll.add(keys[idx]);
        }
      }

      await setMyAvailability(groupId, userId, Array.from(nextAll));
      perfLog('scheduler_save_ok', {
        ms: Date.now() - t0,
        slots: nextAll.size,
      });
      setHasLocalEdits(false);
    } catch (e) {
      perfLog('scheduler_save_err', {
        ms: Date.now() - t0,
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsSaving(false);
    }
  }, [groupId, userId, hasLocalEdits, isSaving, serverSlots, draftByWeek]);

  const rangeEnd = useMemo(() => {
    const e = new Date(weekStart);
    e.setDate(e.getDate() + 6);
    return e;
  }, [weekStart]);

  const rangeLabel = `${weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${rangeEnd.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;

  if (!groupId) {
    return (
      <View className="flex-1 items-center justify-center bg-charcoal-950">
        <Text className="text-white">Missing group</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View
        className="flex-1 bg-charcoal-950"
        style={{ paddingBottom: insets.bottom }}
      >
        <Stack.Screen options={{ headerShown: false }} />

        <View
          className="flex-row items-center justify-between border-b border-charcoal-800 p-2"
          style={{ paddingTop: insets.top + 4 }}
        >
          <PressableRow onPress={() => router.back()} accessibilityLabel="Back">
            <Feather name="arrow-left" size={22} color={colors.white} />
          </PressableRow>
          <Text className="text-base font-bold text-white">Availability</Text>
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={handleSave}
              disabled={!hasLocalEdits || isSaving}
              style={{ opacity: !hasLocalEdits || isSaving ? 0.4 : 1 }}
            >
              <Text
                className="text-sm font-semibold"
                style={{ color: colors.accent[100] }}
              >
                {isSaving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.back()}
              accessibilityLabel="Close"
            >
              <Octicons name="x" size={22} color={colors.charcoal[300]} />
            </TouchableOpacity>
          </View>
        </View>

        <View className="flex-row items-center justify-center gap-4 py-2">
          <TouchableOpacity
            onPress={() => setWeekOffset((w) => w - 1)}
            disabled={weekOffset === 0}
            style={{ opacity: weekOffset === 0 ? 0.3 : 1 }}
          >
            <Octicons name="chevron-left" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text className="min-w-[140px] text-center text-sm font-semibold text-white">
            {rangeLabel}
          </Text>
          <TouchableOpacity onPress={() => setWeekOffset((w) => w + 1)}>
            <Octicons name="chevron-right" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>

        <Text
          className="px-4 pb-2 text-center text-xs"
          style={{ color: colors.charcoal[400] }}
        >
          Tap or hold & drag to mark availability, then press Save
        </Text>

        <ScrollView
          className="flex-1 px-3"
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isDragging}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <SchedulerGrid
            weekStart={weekStart}
            serverAvailability={availability}
            memberCount={memberIds.length}
            memberNames={memberNames}
            mySlots={myWeekSlots}
            currentUserId={userId}
            onBatchUpdate={handleBatchUpdate}
            onDragStateChange={setIsDragging}
            isDragging={isDragging}
            showInlineLegend={false}
          />
        </ScrollView>

        <SchedulerLegendFooter />
      </View>
    </GestureHandlerRootView>
  );
}

function PressableRow({
  onPress,
  children,
  accessibilityLabel,
}: {
  onPress: () => void;
  children: React.ReactNode;
  accessibilityLabel: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="p-2"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </TouchableOpacity>
  );
}
