import Octicons from '@expo/vector-icons/Octicons';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { setMyAvailability, useGroupAvailability } from '@/api/chat/scheduler';
import { colors, Text } from '@/components/ui';
import { perfLog } from '@/lib/perf-log';
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
  const [hasLocalEdits, setHasLocalEdits] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const weekStart = useMemo(() => startOfWeek(weekOffset), [weekOffset]);
  const availability = useGroupAvailability(groupId);

  const serverSlots = useMemo(
    () => availability[currentUserId] ?? [],
    [availability, currentUserId]
  );

  // Sync from server whenever updates arrive, but not while dragging
  // and not after the user has made local edits (until they Save).
  useEffect(() => {
    if (!isDragging && !hasLocalEdits) {
      setLocalSlots(new Set(serverSlots));
    }
  }, [serverSlots, isDragging, hasLocalEdits]);

  const handleBatchUpdate = useCallback((slots: Set<string>) => {
    setLocalSlots(new Set(slots));
    setHasLocalEdits(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (isSaving || !hasLocalEdits) return;
    setIsSaving(true);
    const t0 = Date.now();
    const slotCount = localSlots.size;
    try {
      await setMyAvailability(groupId, currentUserId, Array.from(localSlots));
      perfLog('scheduler_save_ok', {
        ms: Date.now() - t0,
        slots: slotCount,
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
  }, [groupId, currentUserId, localSlots, hasLocalEdits, isSaving]);

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
              <View className="flex-row items-center gap-3">
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={!hasLocalEdits || isSaving}
                  accessibilityRole="button"
                  accessibilityLabel="Save availability"
                  style={{ opacity: !hasLocalEdits || isSaving ? 0.4 : 1 }}
                >
                  <Text className="text-sm font-semibold text-text-50">
                    {isSaving ? 'Saving…' : 'Save'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Close scheduler"
                >
                  <Octicons name="x" size={20} color={colors.text[800]} />
                </TouchableOpacity>
              </View>
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
              Tap or hold & drag to mark availability, then press Save
            </Text>

            {/* scrollEnabled={false} while dragging prevents gesture conflicts */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              scrollEnabled={!isDragging}
            >
              <SchedulerGrid
                weekStart={weekStart}
                serverAvailability={availability}
                memberCount={memberIds.length}
                memberNames={memberNames}
                mySlots={localSlots}
                currentUserId={currentUserId}
                onBatchUpdate={handleBatchUpdate}
                onDragStateChange={setIsDragging}
                isDragging={isDragging}
              />
            </ScrollView>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
