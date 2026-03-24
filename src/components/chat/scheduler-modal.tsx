import Octicons from '@expo/vector-icons/Octicons';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { setMyAvailability, useGroupAvailability } from '@/api/chat/scheduler';
import { colors, Text } from '@/components/ui';
import type { UserIdT } from '@/types';

import { SchedulerGrid } from './scheduler-grid';

type Props = {
  groupId: string;
  memberIds: string[];
  memberNames: Record<string, string>;
  currentUserId: UserIdT;
  onClose: () => void;
};

function startOfWeek(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function SchedulerModal({
  groupId,
  memberIds,
  memberNames,
  currentUserId,
  onClose,
}: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [localSlots, setLocalSlots] = useState<Set<string>>(new Set());

  const weekStart = useMemo(() => startOfWeek(weekOffset), [weekOffset]);
  const availability = useGroupAvailability(groupId);

  // Sync from Firestore whenever server updates arrive, but not mid-drag
  useEffect(() => {
    if (!isDragging) {
      setLocalSlots(new Set(availability[currentUserId] ?? []));
    }
  }, [availability, currentUserId, isDragging]);

  // Override the current user's entry with the optimistic localSlots so the
  // overlap panel (computeTimeRowUsers) stays in sync with the grid cell highlights
  // instead of showing stale Firestore data during in-flight writes.
  const mergedAvailability = useMemo(
    () => ({ ...availability, [currentUserId]: Array.from(localSlots) }),
    [availability, currentUserId, localSlots]
  );

  // Single write to Firestore — called for both taps and completed drags
  const handleBatchUpdate = useCallback(
    async (slots: Set<string>) => {
      setLocalSlots(new Set(slots));
      await setMyAvailability(groupId, currentUserId, Array.from(slots));
    },
    [groupId, currentUserId]
  );

  const weekLabel = weekStart.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 justify-end bg-black/60">
          <View
            className="rounded-t-3xl bg-background-925 px-4 pb-8 pt-4"
            style={{ maxHeight: '90%' }}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-text-50">
                Availability
              </Text>
              <TouchableOpacity
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close scheduler"
              >
                <Octicons name="x" size={20} color={colors.text[800]} />
              </TouchableOpacity>
            </View>

            <View className="mb-3 flex-row items-center justify-center gap-4">
              <TouchableOpacity
                onPress={() => setWeekOffset((w) => w - 1)}
                disabled={weekOffset === 0}
                style={{ opacity: weekOffset === 0 ? 0.3 : 1 }}
              >
                <Octicons
                  name="chevron-left"
                  size={20}
                  color={colors.text[50]}
                />
              </TouchableOpacity>
              <Text className="w-28 text-center text-sm font-semibold text-text-50">
                {weekLabel}
              </Text>
              <TouchableOpacity onPress={() => setWeekOffset((w) => w + 1)}>
                <Octicons
                  name="chevron-right"
                  size={20}
                  color={colors.text[50]}
                />
              </TouchableOpacity>
            </View>

            <Text className="mb-2 text-center text-xs text-text-800">
              Tap or hold & drag to mark availability
            </Text>

            {/* scrollEnabled={false} while dragging prevents gesture conflicts */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              scrollEnabled={!isDragging}
            >
              <SchedulerGrid
                weekStart={weekStart}
                availability={mergedAvailability}
                memberCount={memberIds.length}
                memberNames={memberNames}
                mySlots={localSlots}
                onBatchUpdate={handleBatchUpdate}
                onDragStateChange={setIsDragging}
              />
            </ScrollView>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
