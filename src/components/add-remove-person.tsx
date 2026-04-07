import Ionicons from '@expo/vector-icons/Ionicons';
import Octicons from '@expo/vector-icons/Octicons';
import { useQuery } from '@tanstack/react-query';
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
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { v4 as uuidv4 } from 'uuid';

import { queryClient } from '@/api/common/api-provider';
import { db } from '@/api/common/firebase';
import { useEvent } from '@/api/events/use-events';
import { useExpense } from '@/api/expenses/use-expenses';
import { useGroup } from '@/api/groups/use-groups';
import { useItem } from '@/api/items/use-items';
import { usePeopleIdsForItem } from '@/api/people/use-people';
import { fetchUsersBatch, useUser } from '@/api/people/use-users';
import { useFriendUserIds } from '@/api/social/friendships';
import { colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { softMatch } from '@/lib/soft-match';
import { useExpenseCreation } from '@/lib/store';
import {
  type EventIdT,
  type EventPerson,
  type ExpenseIdT,
  type ExpensePerson,
  type GroupIdT,
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
  const viewerUserId = useAuth.use.userId() ?? null;
  const { data: userData } = useUser({
    variables: {
      userId: participant.id,
      viewerUserId,
    },
  });

  return (
    <View className="mb-2 flex-row items-center justify-between rounded-lg border border-text-900 p-3">
      <View className="flex-row items-center">
        <PersonAvatar
          size="sm"
          userId={participant.id}
          inSplitView
          isSelected={false}
        />
        <View className="ml-3">
          <Text className="text-white">{participant.name}</Text>
          {userData?.username ? (
            <Text className="text-xs text-gray-400">@{userData.username}</Text>
          ) : null}
        </View>
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
  peopleInExpense,
  searchQuery,
  onSearchChange,
  searchMatches,
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
  peopleInExpense: PersonWithId[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchMatches: (EventPerson & { id: UserIdT })[];
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
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const modalTopPadding = Math.max(insets.top, windowHeight / 3);
  const searchTrimmed = searchQuery.trim();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 items-center justify-start bg-black/80"
        style={{ paddingTop: modalTopPadding }}
        onPress={onClose}
      >
        <Pressable
          className="mx-4 w-full max-w-md self-center rounded-xl border border-text-900 bg-black p-6"
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="mb-4 text-center text-lg font-bold text-white">
            Manage People
          </Text>

          <View className="mb-3 rounded-lg border border-text-900 px-3 py-2">
            <TextInput
              className="text-white"
              placeholder="Search by username or name"
              placeholderTextColor="#6b7280"
              value={searchQuery}
              onChangeText={onSearchChange}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <ScrollView
            className="mb-4"
            style={{ maxHeight: 300 }}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            {searchTrimmed
              ? searchMatches.map((participant) => (
                  <EventParticipantRow
                    key={participant.id}
                    participant={participant}
                    onAdd={onAddParticipant}
                    disabled={maxPeopleReached}
                  />
                ))
              : null}

            {searchTrimmed && searchMatches.length === 0 ? (
              <Text className="py-2 text-center text-sm text-gray-500">
                No matching unassigned users
              </Text>
            ) : null}

            {peopleInExpense.map((expensePerson, index) => {
              const isAssigned = assignedPeopleIds.includes(
                expensePerson.id as UserIdT
              );
              const displayPerson: PersonWithId = {
                ...expensePerson,
                name:
                  expensePerson.name ?? expensePerson.guestName ?? 'Unknown',
                color:
                  expensePerson.color ??
                  avatarColors[index % avatarColors.length] ??
                  '',
              };
              return (
                <ExpensePersonRow
                  key={expensePerson.id}
                  person={displayPerson}
                  isAssigned={isAssigned}
                  onToggle={makeToggleHandler(expensePerson.id, isAssigned)}
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

  const resolvedEventId = (eventId ?? tempExpense?.eventId) as
    | EventIdT
    | undefined;
  const {
    data: assignedPeopleIds,
    isPending: isAssignedPending,
    isError: isAssignedError,
  } = usePeopleIdsForItem({ variables: { expenseId, itemId: itemID } });

  const { assignPersonToItem, removePersonFromItem, addPerson } =
    useExpenseCreation();

  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newPersonName, setNewPersonName] = useState('');

  const avatarColors = useMemo(() => Object.keys(colors.avatar ?? {}), []);
  const randomColor = () =>
    avatarColors[Math.floor(Math.random() * avatarColors.length)] ?? 'white';
  const [previewColor, setPreviewColor] = useState(randomColor);

  const isTempExpense = expenseId === ('temp-expense' as ExpenseIdT);

  // Event-backed expenses: search group members when the event belongs to a group,
  // otherwise event participants (standalone events).
  const {
    data: event,
    isPending: isEventPending,
    isError: isEventError,
  } = useEvent({
    variables: resolvedEventId,
    enabled: Boolean(resolvedEventId),
  });
  const groupIdForSearch = event?.groupId as GroupIdT | undefined;
  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
  } = useGroup({
    variables: groupIdForSearch!,
    enabled: Boolean(resolvedEventId && groupIdForSearch),
  });
  const { data: friendUserIds = [] } = useFriendUserIds({
    variables: currentUserId,
    enabled:
      !resolvedEventId &&
      Boolean(currentUserId) &&
      currentUserId !== 'guest_user',
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
  const groupMemberIds = useMemo(
    () => (group?.members ?? []) as UserIdT[],
    [group?.members]
  );

  const searchPoolUserIds = useMemo((): UserIdT[] => {
    if (!resolvedEventId) return nonEventUserIds;
    if (groupIdForSearch) return groupMemberIds;
    return eventParticipantIds;
  }, [
    resolvedEventId,
    groupIdForSearch,
    groupMemberIds,
    eventParticipantIds,
    nonEventUserIds,
  ]);

  const isWaitingForEventSearchContext =
    Boolean(resolvedEventId) &&
    (isEventPending || (Boolean(groupIdForSearch) && isGroupPending));

  const needsSearchPoolProfiles = searchPoolUserIds.length > 0;

  const {
    data: searchPoolUsers = [],
    isLoading: isSearchPoolLoading,
    isError: isSearchPoolError,
  } = useQuery({
    queryKey: ['users', 'batch', searchPoolUserIds, currentUserId ?? null],
    queryFn: () => fetchUsersBatch(searchPoolUserIds, currentUserId ?? null),
    staleTime: 5 * 60 * 1000,
    enabled: needsSearchPoolProfiles,
  });

  const expensePeopleEarly = (tempExpense?.people ?? []) as PersonWithId[];

  const searchMatches = useMemo((): (EventPerson & { id: UserIdT })[] => {
    const q = searchQuery.trim();
    if (!q) return [];
    const inExpense = new Set(expensePeopleEarly.map((p) => p.id));
    return searchPoolUsers
      .filter((u) => !inExpense.has(u.id))
      .filter((u) =>
        softMatch(q, String(u.displayName ?? ''), String(u.username ?? ''))
      )
      .map((user, index) => ({
        id: user.id,
        name: String(user.displayName ?? ''),
        color: avatarColors[index % avatarColors.length] ?? '',
        userRef: user.id,
        subtotal: 0,
        paid: 0,
      }));
  }, [searchQuery, searchPoolUsers, expensePeopleEarly, avatarColors]);

  if (
    isPending ||
    isAssignedPending ||
    isWaitingForEventSearchContext ||
    (needsSearchPoolProfiles && isSearchPoolLoading)
  )
    return <ActivityIndicator />;
  if (isError || isAssignedError)
    return <Text>Error loading temp expense</Text>;
  if (resolvedEventId && isEventError)
    return (
      <Text className="p-4 text-red-400">
        Could not load event context for people search. Pull to refresh or try
        again.
      </Text>
    );
  if (resolvedEventId && groupIdForSearch && isGroupError)
    return (
      <Text className="p-4 text-red-400">
        Could not load group members for this expense. Pull to refresh or try
        again.
      </Text>
    );
  if (needsSearchPoolProfiles && isSearchPoolError)
    return (
      <Text className="p-4 text-red-400">
        Could not load people for this expense. Pull to refresh or try again.
      </Text>
    );

  const people = tempExpense?.people ?? [];
  const maxPeopleReached = people.length >= MAX_PEOPLE;

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
        onClose={() => {
          setModalVisible(false);
          setSearchQuery('');
        }}
        peopleInExpense={people}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchMatches={searchMatches}
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
