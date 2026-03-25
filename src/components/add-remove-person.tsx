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
import { useUser, useUsersAsPeople } from '@/api/people/use-users';
import { useFriendUserIds } from '@/api/social/friendships';
import { colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
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
      name: pw.name ?? pw.guestName ?? 'Unknown',
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
  const isRealUser = person.userRef != null;
  const viewerUserId = useAuth.use.userId() ?? null;
  const { data: userData } = useUser({
    variables: {
      userId: (person.userRef ?? person.id) as UserIdT,
      viewerUserId,
    },
    enabled: isRealUser,
  });

  return (
    <View className="mb-2 flex-row items-center justify-between rounded-lg border border-text-900 p-3">
      <View className="flex-row items-center">
        <PersonAvatar
          size="sm"
          userId={person.id as UserIdT}
          inSplitView
          isSelected={isAssigned}
        />
        <View className="ml-3">
          <Text className="text-white">{person.name}</Text>
          {isRealUser && userData?.username ? (
            <Text className="text-xs text-gray-400">@{userData.username}</Text>
          ) : null}
        </View>
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

// ── Modal containing the full people management UI ───────────────────────────
function ManagePeopleModal({
  visible,
  onClose,
  people,
  combinedRows,
  addedIds,
  assignedPeopleIds,
  avatarColors,
  maxPeopleReached,
  makeToggleHandler,
  onAddParticipant,
  newPersonName,
  onPersonNameChange,
  previewColor,
  onAddGuest,
}: {
  visible: boolean;
  onClose: () => void;
  people: PersonWithId[];
  combinedRows: (EventPerson & { id: UserIdT })[];
  addedIds: Set<string>;
  assignedPeopleIds: UserIdT[];
  avatarColors: string[];
  maxPeopleReached: boolean;
  makeToggleHandler: (
    personId: string,
    isAssigned: boolean
  ) => () => Promise<void>;
  onAddParticipant: (p: EventPerson & { id: UserIdT }) => Promise<void>;
  newPersonName: string;
  onPersonNameChange: (name: string) => void;
  previewColor: string;
  onAddGuest: () => Promise<void>;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/80"
        onPress={onClose}
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
            {combinedRows.map((participant, index) => {
              const isInExpense = addedIds.has(participant.id);
              const isAssigned =
                isInExpense &&
                assignedPeopleIds.includes(participant.id as UserIdT);

              if (isInExpense) {
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
                    onToggle={makeToggleHandler(participant.id, isAssigned)}
                  />
                );
              }

              return (
                <EventParticipantRow
                  key={participant.id}
                  participant={participant}
                  onAdd={onAddParticipant}
                  disabled={maxPeopleReached}
                />
              );
            })}
          </ScrollView>

          {/* Manual add row — add a guest who doesn't have the app */}
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
              placeholder="Add guest (non-user)"
              placeholderTextColor="#6b7280"
              value={newPersonName}
              onChangeText={onPersonNameChange}
            />
            <TouchableOpacity
              onPress={onAddGuest}
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
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export const AddRemovePerson = ({ itemID, expenseId, eventId }: Props) => {
  const currentUserId = useAuth.use.userId();
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
  const { data: friendUserIds = [] } = useFriendUserIds({
    variables: currentUserId,
    enabled:
      !eventId && Boolean(currentUserId) && currentUserId !== 'guest_user',
  });
  const nonEventUserIds = useMemo(() => {
    const ids = new Set<UserIdT>();
    if (currentUserId) ids.add(currentUserId as UserIdT);
    for (const friendUserId of friendUserIds) ids.add(friendUserId);
    return [...ids];
  }, [currentUserId, friendUserIds]);
  const eventParticipantIds = useMemo(
    () => (event?.participants ?? []) as UserIdT[],
    [event?.participants]
  );

  const {
    people: nonEventParticipants,
    isLoading: isNonEventUsersLoading,
    isError: isNonEventUsersError,
  } = useUsersAsPeople(nonEventUserIds, avatarColors, {
    enabled: !eventId && nonEventUserIds.length > 0,
  });
  const {
    people: eventParticipants,
    isLoading: isEventUsersLoading,
    isError: isEventUsersError,
  } = useUsersAsPeople(eventParticipantIds, avatarColors, {
    enabled: Boolean(eventId) && eventParticipantIds.length > 0,
  });

  const needsNonEventUserProfiles = !eventId && nonEventUserIds.length > 0;
  const needsEventParticipantProfiles =
    Boolean(eventId) && eventParticipantIds.length > 0;

  const nonEventParticipantRows = useMemo(
    () =>
      getCombinedEventParticipantRows(
        'non-event' as EventIdT,
        nonEventParticipants,
        (tempExpense?.people ?? []) as PersonWithId[]
      ),
    [nonEventParticipants, tempExpense?.people]
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

  if (
    isPending ||
    isAssignedPending ||
    (needsNonEventUserProfiles && isNonEventUsersLoading) ||
    (needsEventParticipantProfiles && isEventUsersLoading)
  )
    return <ActivityIndicator />;
  if (isError || isAssignedError)
    return <Text>Error loading temp expense</Text>;
  if (needsNonEventUserProfiles && isNonEventUsersError)
    return (
      <Text className="p-4 text-red-400">
        Could not load people for this expense. Pull to refresh or try again.
      </Text>
    );
  if (needsEventParticipantProfiles && isEventUsersError)
    return (
      <Text className="p-4 text-red-400">
        Could not load event participants. Pull to refresh or try again.
      </Text>
    );

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

  // ── Add a manual (pseudo) person ─────────────────────────────────────────
  const handleAddManualPerson = async () => {
    if (maxPeopleReached || !newPersonName.trim()) return;
    const newPersonId = uuidv4() as PersonIdT;
    const trimmedName = newPersonName.trim();

    if (isTempExpense) {
      const newPerson: PersonWithId = {
        id: newPersonId,
        name: trimmedName,
        color: previewColor,
        userRef: null,
        subtotal: 0,
        paid: 0,
      };
      addPerson(newPerson);
    } else {
      try {
        const batch = writeBatch(db);
        const personRef = doc(db, 'expenses', expenseId, 'people', newPersonId);
        const itemRef = doc(db, 'expenses', expenseId, 'items', itemID);
        batch.set(personRef, { subtotal: 0, paid: 0, guestName: trimmedName });
        batch.update(itemRef, {
          assignedPersonIds: arrayUnion(newPersonId),
        });
        await batch.commit();
      } catch (error) {
        console.error('Failed to add guest:', error);
        Alert.alert('Error', 'Failed to add guest. Please try again.');
        return;
      }
    }

    setNewPersonName('');
    setPreviewColor(randomColor());
    await invalidateExpense();
    await invalidateItemPeople();
    await invalidateItem();
  };

  // ── Add a listed participant to the expense ───────────────────────────────
  const handleAddParticipant = async (
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
      <ManagePeopleModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        people={people}
        combinedRows={
          eventId ? combinedEventParticipantRows : nonEventParticipantRows
        }
        addedIds={addedIds}
        assignedPeopleIds={assignedPeopleIds}
        avatarColors={avatarColors}
        maxPeopleReached={maxPeopleReached}
        makeToggleHandler={makeToggleHandler}
        onAddParticipant={handleAddParticipant}
        newPersonName={newPersonName}
        onPersonNameChange={setNewPersonName}
        previewColor={previewColor}
        onAddGuest={handleAddManualPerson}
      />

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
