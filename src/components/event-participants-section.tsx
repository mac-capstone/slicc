import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';

import { MemberPickerModal } from '@/components/member-picker-modal';
import {
  PersonAvatar,
  personAvatarColorForIndex,
} from '@/components/person-avatar';
import { Pressable, Text, View } from '@/components/ui';
import type { EventPerson, UserIdT, UserWithId } from '@/types';

type Props = {
  participants: (EventPerson & { id: UserIdT })[];
  showPicker: boolean;
  groupMembers: UserWithId[];
  selectedParticipantIds: UserIdT[];
  onAddPress: () => void;
  onPickerClose: () => void;
  onPickerConfirm: (ids: UserIdT[]) => void;
};

export function EventParticipantsSection({
  participants,
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
            <View className="mr-3">
              <PersonAvatar
                userId={participant.id}
                fallbackLabel={participant.name}
                color={personAvatarColorForIndex(index)}
                size="md"
              />
            </View>
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
