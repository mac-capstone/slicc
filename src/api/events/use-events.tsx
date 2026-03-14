import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { createQuery } from 'react-query-kit';

import { db } from '@/api/common/firebase';
import {
  type Event,
  type EventIdT,
  type EventWithId,
  type UserIdT,
} from '@/types';
import { eventConverter } from '@/types/schema';

const eventsRef = collection(db, 'events').withConverter(eventConverter);

// Query to get all event IDs
type AllEventsResponse = EventIdT[];
type AllEventsVariables = void;

export const useEventIds = createQuery<
  AllEventsResponse,
  AllEventsVariables,
  Error
>({
  queryKey: ['events'],
  fetcher: async () => {
    // Firestore implementation
    const snapshot = await getDocs(eventsRef);
    return snapshot.docs.map((doc) => doc.id as EventIdT);
  },
});

// Query to get a single event by ID
export const useEvent = createQuery<EventWithId, EventIdT, Error>({
  queryKey: ['events', 'eventId'],
  fetcher: async (eventId) => {
    // Firestore implementation
    const eventRef = doc(eventsRef, eventId);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      throw new Error('Event not found');
    }

    return { id: eventSnap.id as EventIdT, ...eventSnap.data() } as EventWithId;
  },
});

// Mutation to create a new event
type CreateEventVariables = {
  eventId: EventIdT;
  data: Event;
};

export const useCreateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, data }: CreateEventVariables) => {
      // Firestore implementation
      const eventRef = doc(eventsRef, eventId);
      await setDoc(eventRef, data);
      return { id: eventId, ...data };
    },
    onSuccess: () => {
      // Invalidate and refetch events list
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

// Mutation to update an existing event
type UpdateEventVariables = {
  eventId: EventIdT;
  data: Partial<Event>;
};

export const useUpdateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, data }: UpdateEventVariables) => {
      // Firestore implementation
      const eventRef = doc(eventsRef, eventId);
      await updateDoc(eventRef, data);
      const updatedSnap = await getDoc(eventRef);
      return { id: eventId, ...updatedSnap.data() };
    },
    onSuccess: (_, variables) => {
      // Invalidate specific event query and events list
      queryClient.invalidateQueries({
        queryKey: ['events', 'eventId', variables.eventId],
      });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

// Mutation to add a participant to an event
type AddParticipantVariables = {
  eventId: EventIdT;
  userId: UserIdT;
};

export const useAddParticipant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, userId }: AddParticipantVariables) => {
      // Firestore implementation
      const eventRef = doc(eventsRef, eventId);
      const eventSnap = await getDoc(eventRef);

      if (!eventSnap.exists()) {
        throw new Error('Event not found');
      }

      await updateDoc(eventRef, {
        participants: arrayUnion(userId),
      });

      const updatedSnap = await getDoc(eventRef);
      return updatedSnap.data();
    },
    onSuccess: (_, variables) => {
      // Invalidate specific event query
      queryClient.invalidateQueries({
        queryKey: ['events', 'eventId', variables.eventId],
      });
    },
  });
};

// Mutation to remove a participant from an event
type RemoveParticipantVariables = {
  eventId: EventIdT;
  userId: UserIdT;
};

export const useRemoveParticipant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, userId }: RemoveParticipantVariables) => {
      // Firestore implementation
      const eventRef = doc(eventsRef, eventId);
      const eventSnap = await getDoc(eventRef);

      if (!eventSnap.exists()) {
        throw new Error('Event not found');
      }

      await updateDoc(eventRef, {
        participants: arrayRemove(userId),
      });

      const updatedSnap = await getDoc(eventRef);
      return updatedSnap.data();
    },
    onSuccess: (_, variables) => {
      // Invalidate specific event query
      queryClient.invalidateQueries({
        queryKey: ['events', 'eventId', variables.eventId],
      });
    },
  });
};

type EventParticipant = {
  name: string;
  userRef: string;
};

export const useEventParticipant = createQuery<
  EventParticipant,
  { eventId: EventIdT; userId: UserIdT },
  Error
>({
  queryKey: ['events', 'eventId', 'userId'],
  fetcher: async ({ eventId, userId }) => {
    const eventRef = doc(eventsRef, eventId);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) throw new Error('Event not found');

    const event = eventSnap.data();
    if (!event.participants.includes(userId))
      throw new Error('User not a participant');

    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) throw new Error('User not found');

    return {
      name: userSnap.data().displayName,
      userRef: userId,
    };
  },
});
