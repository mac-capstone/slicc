import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useState } from 'react';
import { FlatList, Modal, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PersonAvatar } from '@/components/person-avatar';
import { Button, Pressable, Text, View } from '@/components/ui';
import type { UserIdT, UserWithId } from '@/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  candidates: UserWithId[];
  selectedIds: UserIdT[];
  onConfirm: (selectedIds: UserIdT[]) => void;
  title?: string;
};

function MemberRow({
  user,
  isSelected,
  onToggle,
}: {
  user: UserWithId;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={user.displayName}
      accessibilityState={{ selected: isSelected }}
      className="flex-row items-center border-b border-neutral-800 py-3"
    >
      <View className="mr-3">
        <PersonAvatar
          userId={user.id}
          fallbackLabel={user.displayName}
          size={36}
          color="white"
        />
      </View>
      <Text className="flex-1 text-base text-white">{user.displayName}</Text>
      {isSelected && <Feather name="check-circle" size={20} color="#00C8B3" />}
      {!isSelected && (
        <View className="size-5 rounded-full border border-neutral-600" />
      )}
    </Pressable>
  );
}

export function MemberPickerModal({
  visible,
  onClose,
  candidates,
  selectedIds,
  onConfirm,
  title = 'Add Members',
}: Props) {
  const insets = useSafeAreaInsets();
  const [localSelected, setLocalSelected] = useState<Set<UserIdT>>(
    () => new Set(selectedIds)
  );
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (visible) {
      setLocalSelected(new Set(selectedIds));
      setSearchQuery('');
    }
  }, [visible, selectedIds]);

  const filtered = candidates.filter((u) =>
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggle = (id: UserIdT): void => {
    setLocalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View
        className="flex-1 bg-background-950 px-4 pb-4"
        style={{ paddingTop: Math.max(insets.top, 16) }}
      >
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-xl font-bold text-white">{title}</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close member picker"
            className="p-1"
          >
            <Feather name="x" size={24} color="#fff" />
          </Pressable>
        </View>

        <View className="mb-4 flex-row items-center rounded-full bg-neutral-900 px-4 py-2">
          <Feather name="search" size={16} color="#A4A4A4" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search members..."
            placeholderTextColor="#A4A4A4"
            style={{ flex: 1, marginLeft: 8, color: '#fff', fontSize: 14 }}
          />
        </View>

        <FlatList
          data={filtered}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => (
            <MemberRow
              user={item}
              isSelected={localSelected.has(item.id)}
              onToggle={() => toggle(item.id)}
            />
          )}
          ListEmptyComponent={
            <Text className="mt-8 text-center text-neutral-500">
              {searchQuery ? 'No members found' : 'No members available'}
            </Text>
          }
        />

        <Button
          label={`Confirm (${localSelected.size} selected)`}
          onPress={() => onConfirm(Array.from(localSelected))}
          className="mt-4"
          fullWidth
        />
      </View>
    </Modal>
  );
}
