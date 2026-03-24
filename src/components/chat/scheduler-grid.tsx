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
import { colors, Text } from '@/components/ui';

import { SchedulerCell } from './scheduler-cell';

// Grid dimensions
// LW + 7×CW + PANEL_W ≈ 340 px → fills a 375 px phone (32 px total padding)
const LW = 36; // label column width
const CW = 40; // day column width
const CH = 24; // cell height (22px content + 1px margin × 2)
const HOURS = Array.from({ length: 14 }, (_, i) => i + 9); // 9 am – 10 pm
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const LEGEND = [
  colors.background[900],
  colors.primary[900],
  colors.primary[700],
  colors.primary[500],
  colors.primary[400],
];

// Stable per-name colour (matches message bubble palette)
const AVATAR_COLOURS = [
  '#a78bfa',
  '#60a5fa',
  '#34d399',
  '#f472b6',
  '#fb923c',
  '#38bdf8',
  '#4ade80',
  '#facc15',
];
function avatarColour(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length];
}

function formatTimeKey(timeKey: string): string {
  const [h, m] = timeKey.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}

function slotAt({
  x,
  y,
  hdrH,
  days,
}: {
  x: number;
  y: number;
  hdrH: number;
  days: Date[];
}): string | null {
  const di = Math.floor((x - LW) / CW);
  if (di < 0 || di >= days.length) return null;
  const si = Math.floor((y - hdrH) / CH);
  if (si < 0 || si >= HOURS.length * 2) return null;
  return buildSlotKey(
    days[di],
    HOURS[Math.floor(si / 2)],
    (si % 2 === 0 ? 0 : 30) as 0 | 30
  );
}

// ── Member avatar ─────────────────────────────────────────────────────────────

type MemberAvatarProps = {
  name: string;
  // photoURL is not in the current userProfileSchema.
  // When it is added, swap the initial View for an <Image source={{ uri: photoURL }} />.
  onPress: () => void;
};

function MemberAvatar({ name, onPress }: MemberAvatarProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: avatarColour(name),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 7, color: '#fff', fontWeight: '700' }}>
        {name.charAt(0).toUpperCase()}
      </Text>
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

// Panel width: 340 - (36 + 7×36) = 340 - 288 = 52 px
// Shows 2 avatars (16 px each + 2 px gap) before horizontal scroll kicks in
const PANEL_W = 52;

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
        borderLeftColor: colors.background[900],
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
                  width: PANEL_W - 6,
                  justifyContent: 'center',
                }}
              >
                {/* Horizontal scroll so every avatar is reachable with no cap */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ alignItems: 'center', gap: 2 }}
                >
                  {entries.map((entry) => {
                    const name = memberNames[entry.uid] ?? '?';
                    return (
                      <MemberAvatar
                        key={entry.uid}
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
          {formatTimeKey(info.timeKey)}
        </Text>
        <TouchableOpacity onPress={onDismiss}>
          <Text className="text-[10px] text-text-800">✕</Text>
        </TouchableOpacity>
      </View>

      {allEntries.map((entry) => {
        const name = memberNames[entry.uid] ?? '?';
        const isSelected = entry.uid === info.entry.uid;
        return (
          <View
            key={entry.uid}
            className="mb-0.5 flex-row items-center gap-1.5"
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: avatarColour(name),
              }}
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
  availability: GroupAvailability;
  memberCount: number;
  memberNames: Record<string, string>;
  mySlots: Set<string>;
  onBatchUpdate: (slots: Set<string>) => void;
  onDragStateChange: (isDragging: boolean) => void;
};

export function SchedulerGrid({
  weekStart,
  availability,
  memberCount,
  memberNames,
  mySlots,
  onBatchUpdate,
  onDragStateChange,
}: Props) {
  const [hdrH, setHdrH] = useState(32);
  const [renderSlots, setRenderSlots] = useState(mySlots);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  const pending = useRef(new Set<string>());
  const visited = useRef(new Set<string>());
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

  const slotCounts = computeSlotCounts(availability);

  const timeRowUsers = useMemo(
    () => computeTimeRowUsers(availability, weekStart),
    [availability, weekStart]
  );

  // ── Gesture helpers ───────────────────────────────────────────────────────

  function applySlot(slot: string) {
    if (visited.current.has(slot)) return;
    visited.current.add(slot);
    const next = new Set(pending.current);
    if (dragAction.current === 'add') next.add(slot);
    else next.delete(slot);
    pending.current = next;
    setRenderSlots(new Set(next));
  }

  function handleTap(x: number, y: number) {
    const slot = slotAt({ x, y, hdrH, days });
    if (!slot) return;
    const next = new Set(mySlots);
    if (next.has(slot)) next.delete(slot);
    else next.add(slot);
    onBatchUpdate(next);
  }

  function handleDragStart(x: number, y: number) {
    const slot = slotAt({ x, y, hdrH, days });
    if (!slot) return;
    pending.current = new Set(mySlots);
    visited.current = new Set();
    dragAction.current = mySlots.has(slot) ? 'remove' : 'add';
    onDragStateChange(true);
    applySlot(slot);
  }

  function handleDragMove(x: number, y: number) {
    const slot = slotAt({ x, y, hdrH, days });
    if (slot) applySlot(slot);
  }

  function handleDragEnd() {
    onBatchUpdate(new Set(pending.current));
    dragAction.current = null;
    visited.current = new Set();
    onDragStateChange(false);
  }

  const tap = Gesture.Tap()
    .maxDeltaX(10)
    .maxDeltaY(10)
    .onEnd((e, success) => {
      if (success) runOnJS(handleTap)(e.x, e.y);
    });

  const drag = Gesture.Pan()
    .activateAfterLongPress(200)
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
                .map((min) => (
                  <View
                    key={`${hour}:${min}`}
                    className="flex-row items-center"
                  >
                    <View style={{ width: LW }} className="items-end pr-1">
                      <Text className="text-[9px] text-text-800">
                        {min === 0
                          ? `${hour % 12 || 12}${hour < 12 ? 'a' : 'p'}`
                          : ''}
                      </Text>
                    </View>
                    {days.map((d, di) => {
                      const k = buildSlotKey(d, hour, min);
                      return (
                        <View key={di} style={{ width: CW }}>
                          <SchedulerCell
                            count={slotCounts[k] ?? 0}
                            total={memberCount}
                            isMine={renderSlots.has(k)}
                          />
                        </View>
                      );
                    })}
                  </View>
                ))
            )}

            {/* Legend */}
            <View className="mt-3 flex-row items-center gap-1.5 px-1">
              {LEGEND.map((c, i) => (
                <View
                  key={i}
                  className="size-3 rounded-sm"
                  style={{ backgroundColor: c }}
                />
              ))}
              <Text className="text-[9px] text-text-800">None → All</Text>
            </View>
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
