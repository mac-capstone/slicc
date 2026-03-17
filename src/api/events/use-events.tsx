import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { db } from '@/api/common/firebase';
import { useUser } from '@/api/people/use-users';
import {
  type Event,
  type EventIdT,
  type EventWithId,
  type UserIdT,
} from '@/types';
import { eventConverter } from '@/types/schema';

const eventsRef = collection(db, 'events').withConverter(eventConverter);

export const eventKeys = {
  all: ['events'] as const,
  detail: (eventId: EventIdT) => ['events', eventId] as const,
  participant: (eventId: EventIdT, userId: UserIdT) =>
    ['events', eventId, 'participant', userId] as const,
};

export async function fetchEvents(): Promise<EventWithId[]> {
  const snapshot = await getDocs(eventsRef);
  return snapshot.docs.map((eventDoc) => ({
    id: eventDoc.id as EventIdT,
    ...eventDoc.data(),
  }));
}

export async function fetchEvent(eventId: EventIdT): Promise<EventWithId> {
  const eventRef = doc(eventsRef, eventId);
  const eventSnap = await getDoc(eventRef);
  if (!eventSnap.exists()) throw new Error('Event not found');
  return { id: eventId, ...eventSnap.data() };
}

// ── Queries ──────────────────────────────────────────────────────────────────

type UseEventsOptions = {
  enabled?: boolean;
};

export function useEvents(options?: UseEventsOptions) {
  return useQuery({
    queryKey: eventKeys.all,
    queryFn: fetchEvents,
    ...options,
  });
}

export function useEventIds(options?: UseEventsOptions) {
  return useQuery({
    queryKey: eventKeys.all,
    queryFn: fetchEvents,
    select: (events) => events.map((e) => e.id),
    ...options,
  });
}

type UseEventOptions = {
  variables: EventIdT;
  enabled?: boolean;
};

export function useEvent({
  variables: eventId,
  enabled = true,
}: UseEventOptions) {
  return useQuery({
    queryKey: eventKeys.detail(eventId),
    queryFn: () => fetchEvent(eventId),
    enabled,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

type CreateEventVariables = {
  eventId: EventIdT;
  data: Event;
};

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation<EventWithId, Error, CreateEventVariables>({
    mutationFn: async ({ eventId, data }) => {
      const eventRef = doc(eventsRef, eventId);
      await setDoc(eventRef, data, { merge: true });
      return { id: eventId, ...data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}

type UpdateEventVariables = {
  eventId: EventIdT;
  data: Partial<Event>;
};

export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation<EventWithId, Error, UpdateEventVariables>({
    mutationFn: async ({ eventId, data }) => {
      const eventRef = doc(eventsRef, eventId);
      await updateDoc(eventRef, data);
      const updatedSnap = await getDoc(eventRef);
      if (!updatedSnap.exists()) throw new Error('Event not found');
      return { id: eventId, ...updatedSnap.data() };
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}

type AddParticipantVariables = {
  eventId: EventIdT;
  userId: UserIdT;
};

export function useAddParticipant() {
  const queryClient = useQueryClient();

  return useMutation<EventWithId, Error, AddParticipantVariables>({
    mutationFn: async ({ eventId, userId }) => {
      const eventRef = doc(eventsRef, eventId);
      const eventSnap = await getDoc(eventRef);
      if (!eventSnap.exists()) throw new Error('Event not found');

      await updateDoc(eventRef, { participants: arrayUnion(userId) });

      const updatedSnap = await getDoc(eventRef);
      if (!updatedSnap.exists()) throw new Error('Event not found');
      return { id: eventId, ...updatedSnap.data() };
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
    },
  });
}

type RemoveParticipantVariables = {
  eventId: EventIdT;
  userId: UserIdT;
};

export function useRemoveParticipant() {
  const queryClient = useQueryClient();

  return useMutation<EventWithId, Error, RemoveParticipantVariables>({
    mutationFn: async ({ eventId, userId }) => {
      const eventRef = doc(eventsRef, eventId);
      const eventSnap = await getDoc(eventRef);
      if (!eventSnap.exists()) throw new Error('Event not found');

      await updateDoc(eventRef, { participants: arrayRemove(userId) });

      const updatedSnap = await getDoc(eventRef);
      if (!updatedSnap.exists()) throw new Error('Event not found');
      return { id: eventId, ...updatedSnap.data() };
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
    },
  });
}

type EventParticipant = {
  name: string;
  userRef: string;
};

type UseEventParticipantOptions = {
  variables: { eventId: EventIdT; userId: UserIdT };
  enabled?: boolean;
};

export function useEventParticipant({
  variables: { eventId, userId },
  enabled = true,
}: UseEventParticipantOptions) {
  const eventQuery = useEvent({ variables: eventId, enabled });

  const isParticipant = eventQuery.data?.participants.includes(userId) ?? false;

  const userQuery = useUser({
    variables: userId,
    enabled: enabled && isParticipant,
  });

  const data: EventParticipant | undefined = userQuery.data
    ? { name: userQuery.data.displayName, userRef: userId }
    : undefined;

  return {
    data,
    isLoading: eventQuery.isLoading || (isParticipant && userQuery.isLoading),
    isError: eventQuery.isError || userQuery.isError,
    error: eventQuery.error || userQuery.error,
  };
}
