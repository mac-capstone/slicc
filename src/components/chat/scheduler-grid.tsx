import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import type { GroupAvailability, TimeRowUserEntry } from '@/api/chat/scheduler';
import {
  buildSlotKey,
  computeSlotCounts,
  computeTimeRowUsers,
} from '@/api/chat/scheduler';
import { PersonAvatar } from '@/components/person-avatar';
import { colors, Text } from '@/components/ui';
import type { UserIdT } from '@/types';

import { SchedulerCell } from './scheduler-cell';

// Grid dimensions
// LW + 7×CW + PANEL_W ≈ 340 px -> fills a 375 px phone (32 px total padding)
const LW = 36; // label column width
const CW = 40; // day column width
const CH = 24; // cell height (22px content + 1px margin × 2)
const HOURS = Array.from({ length: 14 }, (_, i) => i + 9); // 9 am – 10 pm
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
function withAlpha(hex: string, opacity: number): string {
  // RN supports 8-digit hex (#RRGGBBAA). Avoid rgba() per design request.
  const a = Math.round(Math.min(1, Math.max(0, opacity)) * 255);
  return `${hex}${a.toString(16).padStart(2, '0')}`;
}

export const SCHEDULER_LEGEND_COLORS = [
  // None: #333333 at 30% opacity
  withAlpha(colors.scheduler.noneBase, 0.3),
  // Extra step (between none and low)
  withAlpha(colors.scheduler.primary, 0.25),
  // Low / Medium / High / All
  withAlpha(colors.scheduler.primary, 0.4),
  withAlpha(colors.scheduler.primary, 0.65),
  withAlpha(colors.scheduler.primary, 0.85),
  colors.scheduler.primary,
] as const;

const LEGEND = SCHEDULER_LEGEND_COLORS;

const AVATAR_COLOR_KEYS = [
  'red',
  'blue',
  'green',
  'yellow',
  'white',
] as const satisfies readonly (keyof typeof colors.avatar)[];

function avatarColorKeyForUid(uid: string): (typeof AVATAR_COLOR_KEYS)[number] {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return AVATAR_COLOR_KEYS[h % AVATAR_COLOR_KEYS.length];
}

function formatTimeKey(timeKey: string, addMinute: 0 | 30 = 0): string {
  const [h, m = 0] = timeKey.split(':').map(Number);
  const totalMinutes = h * 60 + m + addMinute;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;

  const period = newH < 12 ? 'AM' : 'PM';
  return `${newH % 12 || 12}:${String(newM).padStart(2, '0')} ${period}`;
}

// ── Member avatar (overlap panel) ────────────────────────────────────────────

type SchedulerMemberChipProps = {
  userId: string;
  name: string;
  onPress: () => void;
};

function SchedulerMemberChip({
  userId,
  name,
  onPress,
}: SchedulerMemberChipProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <PersonAvatar
        userId={userId as UserIdT}
        fallbackLabel={name}
        size={20}
        color={avatarColorKeyForUid(userId)}
      />
    </TouchableOpacity>
  );
}

// ── Overlap panel ─────────────────────────────────────────────────────────────

type TooltipInfo = {
  timeKey: string;
  entry: TimeRowUserEntry;
  name: string;
};

type OverlapPanelProps = {
  hdrH: number;
  timeRowUsers: Record<string, TimeRowUserEntry[]>;
  memberNames: Record<string, string>;
  onAvatarPress: (info: TooltipInfo) => void;
};

/** Wide enough for 2–3 avatars side by side without overlap before scroll. */
const PANEL_W = 76;

function OverlapPanel({
  hdrH,
  timeRowUsers,
  memberNames,
  onAvatarPress,
}: OverlapPanelProps) {
  return (
    <View
      style={{
        width: PANEL_W,
        paddingLeft: 6,
        borderLeftWidth: 1,
        borderLeftColor: colors.charcoal[800],
      }}
    >
      {/* Header spacer — aligns with grid day-label row */}
      <View style={{ height: hdrH + 4 }} className="justify-end pb-1">
        <Text className="text-[9px] font-semibold text-text-800">Who</Text>
      </View>

      {HOURS.flatMap((hour) =>
        // Stop at 10:00 PM — don't render a 10:30 PM row
        ([0, 30] as const)
          .filter((min) => hour < 22 || min === 0)
          .map((min) => {
            const timeKey = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
            const entries = timeRowUsers[timeKey] ?? [];

            return (
              <View
                key={`${hour}:${min}`}
                style={{
                  height: CH,
                  width: PANEL_W,
                  justifyContent: 'center',
                }}
              >
                {/* Horizontal scroll so every avatar is reachable with no cap */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ alignItems: 'center', gap: 6 }}
                >
                  {entries.map((entry) => {
                    const name = memberNames[entry.uid] ?? '?';
                    return (
                      <SchedulerMemberChip
                        key={entry.uid}
                        userId={entry.uid}
                        name={name}
                        onPress={() => onAvatarPress({ timeKey, entry, name })}
                      />
                    );
                  })}
                </ScrollView>
              </View>
            );
          })
      )}
    </View>
  );
}

// ── Detail card (shown below the grid when an avatar is tapped) ───────────────

type DetailCardProps = {
  info: TooltipInfo;
  allEntries: TimeRowUserEntry[];
  memberNames: Record<string, string>;
  onDismiss: () => void;
};

function DetailCard({
  info,
  allEntries,
  memberNames,
  onDismiss,
}: DetailCardProps) {
  return (
    <View
      className="mt-3 rounded-xl px-3 py-2"
      style={{ backgroundColor: colors.background[900] }}
    >
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-[11px] font-bold text-text-50">
          {formatTimeKey(info.timeKey)} - {formatTimeKey(info.timeKey, 30)}
        </Text>
        <TouchableOpacity onPress={onDismiss}>
          <Text className="text-[10px] text-text-800">✕</Text>
        </TouchableOpacity>
      </View>

      {allEntries.map((entry) => {
        const name = memberNames[entry.uid] ?? '?';
        const isSelected = entry.uid === info.entry.uid;
        return (
          <View key={entry.uid} className="mb-0.5 flex-row items-center gap-1">
            <PersonAvatar
              userId={entry.uid as UserIdT}
              fallbackLabel={name}
              size={20}
              color={avatarColorKeyForUid(entry.uid)}
            />
            <Text
              style={{
                fontSize: 10,
                color: isSelected ? colors.text[50] : colors.text[800],
                fontWeight: isSelected ? '600' : '400',
              }}
            >
              {name}
            </Text>
            <Text style={{ fontSize: 10, color: colors.text[800] }}>
              : {entry.days.join(' · ')}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Main grid ─────────────────────────────────────────────────────────────────

type Props = {
  weekStart: Date;
  serverAvailability: GroupAvailability;
  currentUserId: UserIdT;
  isDragging: boolean;
  memberCount: number;
  memberNames: Record<string, string>;
  mySlots: Set<number>;
  onBatchUpdate: (slots: Set<number>) => void;
  onDragStateChange: (isDragging: boolean) => void;
  /** When false, legend is omitted (e.g. show centered below the grid on a full page). */
  showInlineLegend?: boolean;
};

export function SchedulerGrid({
  weekStart,
  serverAvailability,
  currentUserId,
  isDragging,
  memberCount,
  memberNames,
  mySlots,
  onBatchUpdate,
  onDragStateChange,
  showInlineLegend = true,
}: Props) {
  const [hdrH, setHdrH] = useState(32);
  const [renderSlots, setRenderSlots] = useState(mySlots);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  const pending = useRef(new Set<number>());
  const visited = useRef(new Set<number>());
  const dragAction = useRef<'add' | 'remove' | null>(null);

  useEffect(() => {
    if (!dragAction.current) {
      pending.current = new Set(mySlots);
      setRenderSlots(new Set(mySlots));
    }
  }, [mySlots]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart]
  );

  // Precompute all slot keys for this week once, so drag/tap renders don't do
  // expensive Date/toISOString work for every cell.
  const slotKeysByDayAndSlotIndex = useMemo(() => {
    return days.map((day) =>
      Array.from({ length: HOURS.length * 2 }, (_, si) => {
        const hour = HOURS[Math.floor(si / 2)];
        const minute = (si % 2 === 0 ? 0 : 30) as 0 | 30;
        return buildSlotKey(day, hour, minute);
      })
    );
  }, [days]);

  // Grid stops at 10:00 PM (no 10:30 PM row)
  const slotsPerDay = HOURS.length * 2 - 1;
  const slotKeysFlat = useMemo(() => {
    const flat: string[] = [];
    for (let di = 0; di < 7; di++) {
      for (let si = 0; si < slotsPerDay; si++) {
        flat.push(slotKeysByDayAndSlotIndex[di][si]);
      }
    }
    return flat;
  }, [slotKeysByDayAndSlotIndex, slotsPerDay]);

  // Base derived data is computed once from server state *excluding* the current
  // user. While dragging/tapping, we only adjust it with `renderSlots`
  // (optimistic selection), which is much cheaper than recomputing for all users.
  const othersAvailability = useMemo(() => {
    const { [currentUserId]: _ignored, ...rest } = serverAvailability;
    return rest as GroupAvailability;
  }, [serverAvailability, currentUserId]);

  const baseSlotCounts = useMemo(
    () => computeSlotCounts(othersAvailability),
    [othersAvailability]
  );

  const baseTimeRowUsers = useMemo(
    () => computeTimeRowUsers(othersAvailability, weekStart),
    [othersAvailability, weekStart]
  );

  const myTimeRowUsers = useMemo(() => {
    // While dragging, keep the grid responsive but skip the expensive
    // per-time-row breakdown for the overlap panel.
    if (isDragging) return {};
    return computeTimeRowUsers(
      { [currentUserId]: Array.from(renderSlots).map((i) => slotKeysFlat[i]!) },
      weekStart
    );
  }, [renderSlots, weekStart, currentUserId, isDragging, slotKeysFlat]);

  const timeRowUsers = useMemo(() => {
    const result: Record<string, TimeRowUserEntry[]> = {
      ...baseTimeRowUsers,
    };

    for (const [timeKey, entries] of Object.entries(myTimeRowUsers)) {
      result[timeKey] = [...(result[timeKey] ?? []), ...entries];
    }
    return result;
  }, [baseTimeRowUsers, myTimeRowUsers]);

  // ── Gesture helpers ───────────────────────────────────────────────────────

  function applySlot(slotIndex: number) {
    if (visited.current.has(slotIndex)) return;
    visited.current.add(slotIndex);
    const next = new Set(pending.current);
    if (dragAction.current === 'add') next.add(slotIndex);
    else next.delete(slotIndex);
    pending.current = next;
    setRenderSlots(new Set(next));
  }

  function handleTap(x: number, y: number) {
    const di = Math.floor((x - LW) / CW);
    if (di < 0 || di >= 7) return;
    const si = Math.floor((y - hdrH) / CH);
    if (si < 0 || si >= slotsPerDay) return;
    const idx = di * slotsPerDay + si;

    // Use a ref-based source of truth so two taps before a React re-render
    // never clobber each other.
    const next = new Set(pending.current.size ? pending.current : renderSlots);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    pending.current = new Set(next);
    setRenderSlots(new Set(next));
    onBatchUpdate(next);
  }

  function handleDragStart(x: number, y: number) {
    const di = Math.floor((x - LW) / CW);
    if (di < 0 || di >= 7) return;
    const si = Math.floor((y - hdrH) / CH);
    if (si < 0 || si >= slotsPerDay) return;
    const idx = di * slotsPerDay + si;

    pending.current = new Set(mySlots);
    visited.current = new Set();
    dragAction.current = mySlots.has(idx) ? 'remove' : 'add';
    onDragStateChange(true);
    applySlot(idx);
  }

  function handleDragMove(x: number, y: number) {
    const di = Math.floor((x - LW) / CW);
    if (di < 0 || di >= 7) return;
    const si = Math.floor((y - hdrH) / CH);
    if (si < 0 || si >= slotsPerDay) return;
    const idx = di * slotsPerDay + si;
    applySlot(idx);
  }

  function handleDragEnd() {
    onBatchUpdate(new Set(pending.current));
    dragAction.current = null;
    visited.current = new Set();
    onDragStateChange(false);
  }

  const tap = Gesture.Tap()
    .maxDeltaX(32)
    .maxDeltaY(32)
    .onEnd((e, success) => {
      if (success) runOnJS(handleTap)(e.x, e.y);
    });

  const drag = Gesture.Pan()
    .activateAfterLongPress(180)
    .onStart((e) => runOnJS(handleDragStart)(e.x, e.y))
    .onUpdate((e) => runOnJS(handleDragMove)(e.x, e.y))
    .onFinalize(() => runOnJS(handleDragEnd)());

  const gesture = Gesture.Race(drag, tap);

  const tooltipEntries = tooltip ? (timeRowUsers[tooltip.timeKey] ?? []) : [];

  return (
    <View>
      <View style={{ flexDirection: 'row', alignSelf: 'flex-start' }}>
        {/* ── 7-day grid (gesture-enabled) ── */}
        <GestureDetector gesture={gesture}>
          <View style={{ width: LW + 7 * CW }}>
            {/* Day header */}
            <View
              className="mb-1 flex-row"
              onLayout={(e) => setHdrH(e.nativeEvent.layout.height)}
            >
              <View style={{ width: LW }} />
              {days.map((d, i) => (
                <View key={i} style={{ width: CW }} className="items-center">
                  <Text className="text-[10px] font-semibold text-text-800">
                    {DAY_LABELS[d.getDay()]}
                  </Text>
                  <Text className="text-[10px] text-text-800">
                    {d.getDate()}
                  </Text>
                </View>
              ))}
            </View>

            {/* Time rows — stop at 10:00 PM, no 10:30 PM row */}
            {HOURS.flatMap((hour) =>
              ([0, 30] as const)
                .filter((min) => hour < 22 || min === 0)
                .map((min) => {
                  const hourIndex = hour - HOURS[0];
                  const slotIndex = hourIndex * 2 + (min === 0 ? 0 : 1);

                  return (
                    <View
                      key={`${hour}:${min}`}
                      className="flex-row items-start"
                    >
                      <View
                        style={{ width: LW, paddingBottom: 2 }}
                        className="items-end pr-1"
                      >
                        <Text className="text-[9px] text-text-800">
                          {min === 0
                            ? `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`
                            : ''}
                        </Text>
                      </View>
                      {days.map((_, di) => {
                        const k = slotKeysByDayAndSlotIndex[di][slotIndex];
                        const idx = di * slotsPerDay + slotIndex;
                        const isMine = renderSlots.has(idx);
                        const count =
                          (baseSlotCounts[k] ?? 0) + (isMine ? 1 : 0);
                        return (
                          <View key={di} style={{ width: CW }}>
                            <SchedulerCell
                              count={count}
                              total={memberCount}
                              isMine={isMine}
                            />
                          </View>
                        );
                      })}
                    </View>
                  );
                })
            )}

            {showInlineLegend ? (
              <View className="mt-3 flex-row items-center gap-1.5 px-1">
                {LEGEND.map((c, i) => (
                  <View
                    key={i}
                    className="size-3 rounded-sm"
                    style={{ backgroundColor: c }}
                  />
                ))}
                <View
                  className="size-3 rounded-sm"
                  style={{
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    borderColor: colors.scheduler.mine,
                  }}
                />
                <Text className="text-[9px] text-text-800">
                  None → All · Me
                </Text>
              </View>
            ) : null}
          </View>
        </GestureDetector>

        {/* ── Right: per-time-row overlap panel ── */}
        <OverlapPanel
          hdrH={hdrH}
          timeRowUsers={timeRowUsers}
          memberNames={memberNames}
          onAvatarPress={setTooltip}
        />
      </View>

      {/* ── Detail card: appears below grid when an avatar is tapped ── */}
      {tooltip && (
        <DetailCard
          info={tooltip}
          allEntries={tooltipEntries}
          memberNames={memberNames}
          onDismiss={() => setTooltip(null)}
        />
      )}
    </View>
  );
}

/** Centered “None → All” scale for full-screen availability. */
export function SchedulerLegendFooter() {
  return (
    <View className="flex-row items-center justify-center gap-2 py-5">
      {SCHEDULER_LEGEND_COLORS.map((c, i) => (
        <View
          key={i}
          className="rounded-full"
          style={{ width: 14, height: 14, backgroundColor: c }}
        />
      ))}
      <View
        className="rounded-full"
        style={{
          width: 14,
          height: 14,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: colors.scheduler.mine,
        }}
      />
      <Text className="text-xs" style={{ color: colors.charcoal[400] }}>
        None → All · Me
      </Text>
    </View>
  );
}
