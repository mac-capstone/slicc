import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';

import { MemberPickerModal } from '@/components/member-picker-modal';
import { PersonAvatar } from '@/components/person-avatar';
import { colors, Pressable, Text, View } from '@/components/ui';
import type { EventPerson, UserIdT, UserWithId } from '@/types';

type Props = {
  participants: (EventPerson & { id: UserIdT })[];
  isEditMode: boolean;
  showPicker: boolean;
  groupMembers: UserWithId[];
  selectedParticipantIds: UserIdT[];
  onAddPress: () => void;
  onPickerClose: () => void;
  onPickerConfirm: (ids: UserIdT[]) => void;
};

const avatarColorKeys = Object.keys(
  colors.avatar ?? {}
) as (keyof typeof colors.avatar)[];

export function EventParticipantsSection({
  participants,
  isEditMode,
  showPicker,
  groupMembers,
  selectedParticipantIds,
  onAddPress,
  onPickerClose,
  onPickerConfirm,
}: Props) {
  return (
    <View className="mb-4">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <View className="mr-3 size-10 items-center justify-center rounded-xl bg-neutral-750">
            <Ionicons name="people-outline" size={24} color="#00C8B3" />
          </View>
          <Text className="text-base font-semibold text-text-800">
            {participants.length} people
          </Text>
        </View>
        <Pressable
          onPress={onAddPress}
          className="flex-row items-center rounded-lg bg-neutral-750 px-2 py-1"
        >
          <Ionicons name="person-add" size={18} color="#00C8B3" />
          <Text className="ml-1 text-base font-semibold text-white">Add</Text>
        </Pressable>
      </View>

      <View>
        {participants.map((participant, index) => (
          <View key={participant.id} className="mb-3 flex-row items-center">
            {isEditMode ? (
              <View className="mr-3">
                <PersonAvatar
                  userId={participant.id}
                  color={avatarColorKeys[index % avatarColorKeys.length]}
                  size="md"
                />
              </View>
            ) : (
              <View
                className="mr-3 size-8 items-center justify-center rounded-full"
                style={{ backgroundColor: participant.color }}
              >
                <Text className="text-base font-bold text-white">
                  {participant.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </Text>
              </View>
            )}
            <Text className="text-base text-white">{participant.name}</Text>
          </View>
        ))}
      </View>

      <MemberPickerModal
        visible={showPicker}
        onClose={onPickerClose}
        candidates={groupMembers}
        selectedIds={selectedParticipantIds}
        onConfirm={onPickerConfirm}
        title="Add Participants"
      />
    </View>
  );
}
