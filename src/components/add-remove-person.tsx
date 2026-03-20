import Ionicons from '@expo/vector-icons/Ionicons';
import Octicons from '@expo/vector-icons/Octicons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { v4 as uuidv4 } from 'uuid';

import { queryClient } from '@/api/common/api-provider';
import { useExpense } from '@/api/expenses/use-expenses';
import { useItem } from '@/api/items/use-items';
import { usePeopleIdsForItem } from '@/api/people/use-people';
import { colors } from '@/components/ui';
import { useExpenseCreation } from '@/lib/store';
import {
  type ExpenseIdT,
  type ItemIdT,
  type PersonIdT,
  type PersonWithId,
  type UserIdT,
} from '@/types';

import { PersonAvatar } from './person-avatar';

type Props = {
  itemID: ItemIdT;
  expenseId: ExpenseIdT;
};

const MAX_PEOPLE = 16;

export const AddRemovePerson = ({ itemID, expenseId }: Props) => {
  const {
    data: tempExpense,
    isPending,
    isError,
  } = useExpense({
    variables: expenseId,
  });

  const {
    data: assignedPeopleIds,
    isPending: isAssignedPending,
    isError: isAssignedError,
  } = usePeopleIdsForItem({
    variables: { expenseId, itemId: itemID },
  });

  const { assignPersonToItem, removePersonFromItem, addPerson } =
    useExpenseCreation();

  const [modalVisible, setModalVisible] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');

  const getRandomColor = () => {
    const avatarColors = Object.keys(colors.avatar || {});
    return avatarColors[Math.floor(Math.random() * avatarColors.length)];
  };

  const [previewColor, setPreviewColor] = useState(getRandomColor);

  if (isPending || isAssignedPending) {
    return <ActivityIndicator />;
  }

  if (isError || isAssignedError) {
    return <Text>Error loading temp expense</Text>;
  }

<<<<<<< HEAD
  const handleAddPerson = async () => {
    if (maxPeopleReached) return;
    if (!newPersonName.trim()) return;
    const name = newPersonName.trim();
=======
  const people = tempExpense?.people ?? [];
  const maxPeopleReached = people.length >= MAX_PEOPLE;
  const addedIds = new Set(people.map((p) => p.id));

  // ── Invalidation helpers ──────────────────────────────────────────────────
  const invalidateExpense = () =>
    queryClient.invalidateQueries({ queryKey: useExpense.getKey(expenseId) });
  const invalidateItemPeople = () =>
    queryClient.invalidateQueries({
      queryKey: usePeopleIdsForItem.getKey({ expenseId, itemId: itemID }),
    });
  const invalidateItem = () =>
    queryClient.invalidateQueries({
      queryKey: useItem.getKey({ expenseId, itemId: itemID }),
    });

  // ── Toggle assignment for a person already in the expense ─────────────────
  const makeToggleHandler =
    (personId: string, isAssigned: boolean) => async () => {
      if (isTempExpense) {
        if (isAssigned) removePersonFromItem(itemID, personId);
        else assignPersonToItem(itemID, personId);
      } else {
        try {
          const itemRef = doc(db, 'expenses', expenseId, 'items', itemID);
          if (isAssigned) {
            await updateDoc(itemRef, {
              assignedPersonIds: arrayRemove(personId),
            });
          } else {
            await updateDoc(itemRef, {
              assignedPersonIds: arrayUnion(personId),
            });
          }
        } catch (error) {
          console.error('Failed to update assignment:', error);
          Alert.alert('Error', 'Failed to update. Please try again.');
          return;
        }
      }
      await invalidateItemPeople();
      await invalidateItem();
    };

  // ── Add a manual (pseudo) person — only in non-event mode ─────────────────
  const handleAddManualPerson = async () => {
    if (maxPeopleReached || !newPersonName.trim()) return;
>>>>>>> d440821 (fix: coderabbit changes)
    const newPerson: PersonWithId = {
      id: uuidv4() as PersonIdT,
      name,
      color: previewColor,
      userRef: null,
      subtotal: 0,
      paid: 0,
    };
    addPerson(newPerson);
    setNewPersonName('');
    setPreviewColor(getRandomColor());
    await queryClient.invalidateQueries({
      queryKey: ['expenses', 'expenseId', expenseId],
    });
  };

<<<<<<< HEAD
  const people = tempExpense?.people ?? [];
  const maxPeopleReached = people.length >= MAX_PEOPLE;
=======
  // ── Add an event participant to the expense ───────────────────────────────
  const handleAddEventParticipant = async (
    participant: EventPerson & { id: UserIdT }
  ) => {
    if (maxPeopleReached) return;

    const personData: ExpensePerson = { subtotal: 0, paid: 0 };

    if (isTempExpense) {
      const newPerson: PersonWithId = {
        id: participant.id,
        name: participant.name,
        color: randomColor(),
        userRef: participant.id,
        ...personData,
      };
      addPerson(newPerson);
      assignPersonToItem(itemID, participant.id);
    } else {
      try {
        await setDoc(
          doc(db, 'expenses', expenseId, 'people', participant.id),
          personData
        );
        await updateDoc(doc(db, 'expenses', expenseId, 'items', itemID), {
          assignedPersonIds: arrayUnion(participant.id),
        });
      } catch (error) {
        console.error('Failed to add participant:', error);
        Alert.alert('Error', 'Failed to add participant. Please try again.');
        return;
      }
    }

    await invalidateExpense();
    await invalidateItemPeople();
    await invalidateItem();
  };
>>>>>>> d440821 (fix: coderabbit changes)

  return (
    <View className="bg-transparent p-4">
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/80"
          onPress={() => setModalVisible(false)}
        >
          <Pressable
            className="mx-4 w-full rounded-xl border border-text-900 bg-black p-6"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="mb-4 text-center text-lg font-bold text-white">
              Manage People
            </Text>

            {people.length > 0 && (
              <ScrollView
                className="mb-4"
                style={{ maxHeight: 224 }}
                showsVerticalScrollIndicator
              >
                {people.map((person) => {
                  const isAssigned =
                    itemID && assignedPeopleIds.includes(person.id as UserIdT);
                  return (
                    <View
                      key={person.id}
                      className="mb-2 flex-row items-center justify-between rounded-lg border border-text-900 p-3"
                    >
                      <View className="flex-row items-center">
                        <PersonAvatar
                          size="sm"
                          userId={person.id as UserIdT}
                          // expenseId={expenseId}
                          inSplitView={true}
                          isSelected={isAssigned}
                        />
                        <Text className="ml-3 text-white">{person.name}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={async () => {
                          if (!itemID) return;
                          if (isAssigned) {
                            removePersonFromItem(itemID, person.id);
                          } else {
                            assignPersonToItem(itemID, person.id);
                          }
                          await queryClient.invalidateQueries({
                            queryKey: usePeopleIdsForItem.getKey({
                              expenseId,
                              itemId: itemID,
                            }),
                          });
                          await queryClient.invalidateQueries({
                            queryKey: useItem.getKey({
                              expenseId,
                              itemId: itemID,
                            }),
                          });
                        }}
                        disabled={!itemID}
                        className={`rounded-lg px-4 py-2 ${
                          isAssigned ? 'bg-accent-100' : 'bg-background-700'
                        }`}
                        activeOpacity={0.8}
                      >
                        <View className="flex-row items-center">
                          <Ionicons
                            name={isAssigned ? 'checkmark' : 'add'}
                            size={16}
                            color={isAssigned ? '#000' : '#9ca3af'}
                          />
                          <Text
                            className={`ml-1 font-bold ${
                              isAssigned ? 'text-black' : 'text-gray-400'
                            }`}
                          >
                            {isAssigned ? 'Added' : 'Add'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            <View className="flex-row items-center rounded-lg border border-text-900 p-3">
              <View
                className="size-8 items-center justify-center rounded-full"
                style={{
                  backgroundColor:
                    (colors.avatar as Record<string, string>)[previewColor] ||
                    previewColor,
                }}
              >
                <Octicons name="person" size={15} color="#D4D4D4" />
              </View>
              <TextInput
                className="ml-3 flex-1 text-white"
                placeholder="Enter name here"
                placeholderTextColor="#6b7280"
                value={newPersonName}
                onChangeText={setNewPersonName}
              />
              <TouchableOpacity
                onPress={handleAddPerson}
                disabled={maxPeopleReached || !newPersonName.trim()}
                className={`rounded-lg px-4 py-2 ${
                  maxPeopleReached || !newPersonName.trim()
                    ? 'bg-background-700'
                    : 'bg-primary-500'
                }`}
                activeOpacity={0.8}
              >
                <Text
                  className={`font-bold ${
                    maxPeopleReached || !newPersonName.trim()
                      ? 'text-gray-500'
                      : 'text-white'
                  }`}
                >
                  Add
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <View className="pb-4">
        <TouchableOpacity
          className="bg-background-800 items-center rounded-lg border border-text-900 p-3"
          onPress={() => setModalVisible(true)}
          activeOpacity={1}
        >
          <Text className="font-bold text-white">Manage People</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
