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
import { setGroupUnread } from '@/lib/group-preferences';
import { getItem, setItem } from '@/lib/storage';
import {
  type Event,
  type EventIdT,
  type EventWithId,
  type UserIdT,
} from '@/types';
import { eventConverter, eventSchema } from '@/types/schema';

const eventsRef = collection(db, 'events').withConverter(eventConverter);

const EVENT_IDS_CACHE_KEY = 'events:ids';
const getEventCacheKey = (eventId: EventIdT) => `events:${eventId}`;

const isEventId = (value: string): value is EventIdT => value.length > 0;

const toDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsedDate = new Date(value);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  return undefined;
};

const hydrateCachedEvent = (cachedEvent: EventWithId): EventWithId | null => {
  const startDate = toDate(cachedEvent.startDate);
  const endDate = toDate(cachedEvent.endDate);

  if (!startDate || !endDate) {
    return null;
  }

  return {
    ...cachedEvent,
    startDate,
    endDate,
    recurringEndDate: toDate(cachedEvent.recurringEndDate),
    createdAt: toDate(cachedEvent.createdAt),
    updatedAt: toDate(cachedEvent.updatedAt),
  };
};

const saveEventToCache = async (event: EventWithId) => {
  await setItem(getEventCacheKey(event.id), event);
};

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
    const cachedEventIds = getItem<AllEventsResponse>(EVENT_IDS_CACHE_KEY);
    if (cachedEventIds) {
      return cachedEventIds;
    }

    // Firestore implementation
    const snapshot = await getDocs(eventsRef);
    const eventIds = snapshot.docs
      .map((eventDoc) => eventDoc.id)
      .filter(isEventId);
    await setItem(EVENT_IDS_CACHE_KEY, eventIds);
    return eventIds;
  },
});

export async function fetchEvent(eventId: EventIdT): Promise<EventWithId> {
  const eventRef = doc(db, 'events', eventId);
  const eventSnap = await getDoc(eventRef);

  if (!eventSnap.exists()) {
    throw new Error('Event not found');
  }

  const parsedEvent = eventSchema.safeParse(eventSnap.data());
  if (!parsedEvent.success) {
    console.error('Invalid event structure:', parsedEvent.error.flatten());
    throw new Error('Unable to load event data.');
  }
  const validatedEvent = parsedEvent.data;

  return { id: eventSnap.id as EventIdT, ...validatedEvent } as EventWithId;
}

// Query to get a single event by ID
export const useEvent = createQuery<EventWithId, EventIdT, Error>({
  queryKey: ['events', 'eventId'],
  fetcher: async (eventId) => {
    const cachedEvent = getItem<EventWithId>(getEventCacheKey(eventId));
    if (cachedEvent) {
      const hydratedEvent = hydrateCachedEvent(cachedEvent);
      if (hydratedEvent) {
        return hydratedEvent;
      }
    }

    const event = await fetchEvent(eventId);
    await saveEventToCache(event);
    return event;
  },
});

// Mutation to create a new event
type CreateEventVariables = {
  eventId: EventIdT;
  data: Event;
};

export const useCreateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation<EventWithId, Error, CreateEventVariables>({
    mutationFn: async ({ eventId, data }: CreateEventVariables) => {
      // Firestore implementation
      const eventRef = doc(eventsRef, eventId);
      await setDoc(eventRef, data);

      const createdEvent = { id: eventId, ...data };
      await saveEventToCache(createdEvent);

      const cachedEventIds =
        getItem<AllEventsResponse>(EVENT_IDS_CACHE_KEY) ?? [];
      if (!cachedEventIds.includes(eventId)) {
        await setItem(EVENT_IDS_CACHE_KEY, [...cachedEventIds, eventId]);
      }

      if (data.groupId) {
        const groupRef = doc(db, 'groups', data.groupId);
        await updateDoc(groupRef, {
          events: arrayUnion(eventId),
        });
        setGroupUnread(data.groupId);
        queryClient.invalidateQueries({
          queryKey: ['groups', 'groupId', data.groupId],
        });
      }

      return createdEvent;
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

  return useMutation<EventWithId, Error, UpdateEventVariables>({
    mutationFn: async ({ eventId, data }: UpdateEventVariables) => {
      // Firestore implementation
      const eventRef = doc(eventsRef, eventId);
      await updateDoc(eventRef, data);
      const updatedSnap = await getDoc(eventRef);

      if (!updatedSnap.exists()) {
        throw new Error('Event not found');
      }

      const updatedEvent = { id: eventId, ...updatedSnap.data() } as EventWithId;
      await saveEventToCache(updatedEvent);
      return updatedEvent;
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

  return useMutation<EventWithId, Error, AddParticipantVariables>({
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

      if (!updatedSnap.exists()) {
        throw new Error('Event not found');
      }

      const updatedEvent = { id: eventId, ...updatedSnap.data() };
      await saveEventToCache(updatedEvent);
      return updatedEvent;
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

  return useMutation<EventWithId, Error, RemoveParticipantVariables>({
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

      if (!updatedSnap.exists()) {
        throw new Error('Event not found');
      }

      const updatedEvent = { id: eventId, ...updatedSnap.data() };
      await saveEventToCache(updatedEvent);
      return updatedEvent;
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
