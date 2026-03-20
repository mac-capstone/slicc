import Ionicons from '@expo/vector-icons/Ionicons';
import Octicons from '@expo/vector-icons/Octicons';
import {
  arrayRemove,
  arrayUnion,
  doc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import React, { useMemo, useState } from 'react';
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
import { db } from '@/api/common/firebase';
import { useEvent } from '@/api/events/use-events';
import { useExpense } from '@/api/expenses/use-expenses';
import { useItem } from '@/api/items/use-items';
import { usePeopleIdsForItem } from '@/api/people/use-people';
import { useUsersAsPeople } from '@/api/people/use-users';
import { colors } from '@/components/ui';
import { useExpenseCreation } from '@/lib/store';
import {
  type EventIdT,
  type EventPerson,
  type ExpenseIdT,
  type ExpensePerson,
  type ItemIdT,
  type PersonIdT,
  type PersonWithId,
  type UserIdT,
} from '@/types';

import { PersonAvatar } from './person-avatar';

type Props = {
  itemID: ItemIdT;
  expenseId: ExpenseIdT;
  eventId?: EventIdT;
};

const MAX_PEOPLE = 16;

function getCombinedEventParticipantRows(
  eventId: EventIdT | undefined,
  eventParticipants: (EventPerson & { id: UserIdT })[],
  expensePeople: PersonWithId[]
): (EventPerson & { id: UserIdT })[] {
  if (!eventId) {
    return [];
  }
  const seen = new Set<string>();
  const rows: (EventPerson & { id: UserIdT })[] = [];

  for (const ep of eventParticipants) {
    seen.add(ep.id);
    rows.push(ep);
  }

  for (const p of expensePeople) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const pw = p as PersonWithId;
    rows.push({
      id: p.id as UserIdT,
      name: pw.name ?? 'Unknown',
      color: pw.color ?? '',
      userRef: (pw.userRef ?? p.id) as string,
      subtotal: pw.subtotal,
      paid: pw.paid,
    });
  }

  return rows;
}

// ── Row for a person already in the expense (toggles item assignment) ────────
function ExpensePersonRow({
  person,
  isAssigned,
  onToggle,
}: {
  person: PersonWithId;
  isAssigned: boolean;
  onToggle: () => Promise<void>;
}) {
  return (
    <View className="mb-2 flex-row items-center justify-between rounded-lg border border-text-900 p-3">
      <View className="flex-row items-center">
        <PersonAvatar
          size="sm"
          userId={person.id as UserIdT}
          inSplitView
          isSelected={isAssigned}
        />
        <Text className="ml-3 text-white">{person.name}</Text>
      </View>
      <TouchableOpacity
        onPress={onToggle}
        className={`rounded-lg px-4 py-2 ${isAssigned ? 'bg-accent-100' : 'bg-background-700'}`}
        activeOpacity={0.8}
      >
        <View className="flex-row items-center">
          <Ionicons
            name={isAssigned ? 'checkmark' : 'add'}
            size={16}
            color={isAssigned ? '#000' : '#9ca3af'}
          />
          <Text
            className={`ml-1 font-bold ${isAssigned ? 'text-black' : 'text-gray-400'}`}
          >
            {isAssigned ? 'Added' : 'Add'}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ── Row for an event participant not yet in the expense ──────────────────────
function EventParticipantRow({
  participant,
  onAdd,
  disabled,
}: {
  participant: EventPerson & { id: UserIdT };
  onAdd: (participant: EventPerson & { id: UserIdT }) => Promise<void>;
  disabled: boolean;
}) {
  return (
    <View className="mb-2 flex-row items-center justify-between rounded-lg border border-text-900 p-3">
      <View className="flex-row items-center">
        <PersonAvatar
          size="sm"
          userId={participant.id}
          inSplitView
          isSelected={false}
        />
        <Text className="ml-3 text-white">{participant.name}</Text>
      </View>
      <TouchableOpacity
        onPress={() => onAdd(participant)}
        disabled={disabled}
        className="bg-background-700 rounded-lg px-4 py-2"
        activeOpacity={0.8}
      >
        <View className="flex-row items-center">
          <Ionicons name="add" size={16} color="#9ca3af" />
          <Text className="ml-1 font-bold text-gray-400">Add</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export const AddRemovePerson = ({ itemID, expenseId, eventId }: Props) => {
  const {
    data: tempExpense,
    isPending,
    isError,
  } = useExpense({ variables: expenseId });
  const {
    data: assignedPeopleIds,
    isPending: isAssignedPending,
    isError: isAssignedError,
  } = usePeopleIdsForItem({ variables: { expenseId, itemId: itemID } });

  const { assignPersonToItem, removePersonFromItem, addPerson } =
    useExpenseCreation();

  const [modalVisible, setModalVisible] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');

  const avatarColors = useMemo(() => Object.keys(colors.avatar ?? {}), []);
  const randomColor = () =>
    avatarColors[Math.floor(Math.random() * avatarColors.length)] ?? 'white';
  const [previewColor, setPreviewColor] = useState(randomColor);

  const isTempExpense = expenseId === ('temp-expense' as ExpenseIdT);

  // Fetch event participants when eventId is present
  const { data: event } = useEvent({ variables: eventId, enabled: !!eventId });
  const { people: eventParticipants } = useUsersAsPeople(
    (event?.participants ?? []) as UserIdT[],
    avatarColors
  );

  const combinedEventParticipantRows = useMemo(
    () =>
      getCombinedEventParticipantRows(
        eventId,
        eventParticipants,
        (tempExpense?.people ?? []) as PersonWithId[]
      ),
    [eventId, eventParticipants, tempExpense?.people]
  );

  if (isPending || isAssignedPending) return <ActivityIndicator />;
  if (isError || isAssignedError)
    return <Text>Error loading temp expense</Text>;

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
    const newPerson: PersonWithId = {
      id: uuidv4() as PersonIdT,
      name: newPersonName.trim(),
      color: previewColor,
      userRef: null,
      subtotal: 0,
      paid: 0,
    };
    addPerson(newPerson);
    setNewPersonName('');
    setPreviewColor(randomColor());
    await queryClient.invalidateQueries({
      queryKey: ['expenses', 'expenseId', expenseId],
    });
  };

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
        const batch = writeBatch(db);
        const personRef = doc(
          db,
          'expenses',
          expenseId,
          'people',
          participant.id
        );
        const itemRef = doc(db, 'expenses', expenseId, 'items', itemID);
        batch.set(personRef, personData);
        batch.update(itemRef, {
          assignedPersonIds: arrayUnion(participant.id),
        });
        await batch.commit();
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

            <ScrollView
              className="mb-4"
              style={{ maxHeight: 300 }}
              showsVerticalScrollIndicator
            >
              {eventId
                ? combinedEventParticipantRows.map((participant, index) => {
                    const isInExpense = addedIds.has(participant.id);
                    const isAssigned =
                      isInExpense &&
                      assignedPeopleIds.includes(participant.id as UserIdT);

                    if (isInExpense) {
                      // Merge display data from user profile with expense data
                      const expensePerson = people.find(
                        (p) => p.id === participant.id
                      );
                      const displayPerson: PersonWithId = {
                        id: participant.id,
                        name: participant.name,
                        color: avatarColors[index % avatarColors.length],
                        userRef: participant.id,
                        subtotal: expensePerson?.subtotal ?? 0,
                        paid: expensePerson?.paid ?? 0,
                      };
                      return (
                        <ExpensePersonRow
                          key={participant.id}
                          person={displayPerson}
                          isAssigned={isAssigned}
                          onToggle={makeToggleHandler(
                            participant.id,
                            isAssigned
                          )}
                        />
                      );
                    }

                    return (
                      <EventParticipantRow
                        key={participant.id}
                        participant={participant}
                        onAdd={handleAddEventParticipant}
                        disabled={maxPeopleReached}
                      />
                    );
                  })
                : people.map((person) => {
                    const isAssigned =
                      !!itemID &&
                      assignedPeopleIds.includes(person.id as UserIdT);
                    return (
                      <ExpensePersonRow
                        key={person.id}
                        person={person}
                        isAssigned={isAssigned}
                        onToggle={makeToggleHandler(person.id, isAssigned)}
                      />
                    );
                  })}
            </ScrollView>

            {/* Manual add row — only shown when not in event mode */}
            {!eventId && (
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
                  onPress={handleAddManualPerson}
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
            )}
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
