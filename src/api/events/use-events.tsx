import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { createQuery } from 'react-query-kit';
import { z } from 'zod';

import { db } from '@/api/common/firebase';
import colors from '@/components/ui/colors';
import { mockData } from '@/lib/mock-data';
import {
  type Event,
  type EventIdT,
  type EventWithId,
  type Person,
  type UserIdT,
} from '@/types';

// Zod schema for Timestamp validation
const TimestampSchema = z.custom<Timestamp>((val) => val instanceof Timestamp, {
  message: 'Must be a Timestamp object',
});

// Zod schema for Event validation
const EventSchema = z.object({
  name: z.string(),
  startDate: TimestampSchema,
  endDate: TimestampSchema,
  isRecurring: z.boolean(),
  recurringInterval: z.number().int().positive().optional(),
  recurringUnit: z.enum(['day', 'week', 'month', 'year']).optional(),
  recurringEndDate: TimestampSchema.optional(),
  groupId: z.string(),
  location: z.string().optional(),
  locationUrl: z.string().optional(),
  details: z.string().optional(),
  createdBy: z.string(),
  participants: z.array(z.string()).default([]),
});

const USE_MOCK_DATA = false; // Set to false when ready to use Firestore

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
    if (USE_MOCK_DATA) {
      return mockData.events.map((e) => e.id as EventIdT);
    }

    // Firestore implementation
    const eventsRef = collection(db, 'events');
    const snapshot = await getDocs(eventsRef);
    return snapshot.docs.map((doc) => doc.id as EventIdT);
  },
});

// Query to get a single event by ID
export const useEvent = createQuery<EventWithId, EventIdT, Error>({
  queryKey: ['events', 'eventId'],
  fetcher: async (eventId) => {
    if (USE_MOCK_DATA) {
      const event = mockData.events.find((e) => e.id === eventId);
      if (!event) throw new Error('Event not found');

      // Validate with Zod
      console.log(typeof event.doc.startDate, event.doc.startDate);
      const parsedEvent = EventSchema.safeParse(event.doc);
      if (!parsedEvent.success) {
        console.error('Invalid event structure:', parsedEvent.error.flatten());
        throw new Error('Unable to load event data.');
      }
      const validatedEvent = parsedEvent.data;

      return { id: event.id as EventIdT, ...validatedEvent } as EventWithId;
    }

    // Firestore implementation
    const eventRef = doc(db, 'events', eventId);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      throw new Error('Event not found');
    }

    // Validate with Zod
    const parsedEvent = EventSchema.safeParse(eventSnap.data());
    if (!parsedEvent.success) {
      console.error('Invalid event structure:', parsedEvent.error.flatten());
      throw new Error('Unable to load event data.');
    }
    const validatedEvent = parsedEvent.data;

    return { id: eventSnap.id as EventIdT, ...validatedEvent } as EventWithId;
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
      if (USE_MOCK_DATA) {
        // In mock mode, just add to mock data (temporary)

        mockData.events.push({
          id: eventId,
          doc: data as any, // Cast to any for mock data flexibility
        });
        return { id: eventId, ...data };
      }

      // Firestore implementation
      const eventRef = doc(db, 'events', eventId);
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
      if (USE_MOCK_DATA) {
        // In mock mode, update the mock data

        const eventIndex = mockData.events.findIndex((e) => e.id === eventId);
        if (eventIndex === -1) throw new Error('Event not found');

        // Cast to any for mock data flexibility
        // eslint-disable-next-line react-compiler/react-compiler
        mockData.events[eventIndex].doc = {
          ...mockData.events[eventIndex].doc,
          ...data,
        } as any;
        return { id: eventId, ...mockData.events[eventIndex].doc };
      }

      // Firestore implementation
      const eventRef = doc(db, 'events', eventId);
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
      if (USE_MOCK_DATA) {
        const event = mockData.events.find((e) => e.id === eventId);
        if (!event) throw new Error('Event not found');

        if (!event.doc.participants.includes(userId)) {
          event.doc.participants.push(userId);
        }
        return event.doc;
      }

      // Firestore implementation
      const eventRef = doc(db, 'events', eventId);
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
      if (USE_MOCK_DATA) {
        const event = mockData.events.find((e) => e.id === eventId);
        if (!event) throw new Error('Event not found');

        event.doc.participants = event.doc.participants.filter(
          (id) => id !== userId
        );
        return event.doc;
      }

      // Firestore implementation
      const eventRef = doc(db, 'events', eventId);
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

// Query to get a participant with their assigned color in an event
const avatarColors = Object.keys(colors.avatar || {});

export const useEventParticipant = createQuery<
  Person,
  { eventId: EventIdT; userId: UserIdT },
  Error
>({
  queryKey: ['events', 'eventId', 'userId'],
  fetcher: async ({ eventId, userId }) => {
    if (USE_MOCK_DATA) {
      const event = mockData.events.find((e) => e.id === eventId);
      if (!event) throw new Error('Event not found');

      const participantIndex = event.doc.participants.indexOf(userId);
      if (participantIndex === -1) throw new Error('User not a participant');

      const user = mockData.users.find((u) => u.id === userId);
      if (!user) throw new Error('User not found');

      // Assign color based on participant index
      const color = avatarColors[participantIndex % avatarColors.length];

      return {
        name: user.doc.displayName,
        color: color,
        userRef: userId,
        subtotal: 0, // Not relevant for events
      };
    }

    // Firestore implementation
    const eventRef = doc(db, 'events', eventId);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      throw new Error('Event not found');
    }

    const event = eventSnap.data() as Event;
    const participantIndex = event.participants.indexOf(userId);
    if (participantIndex === -1) throw new Error('User not a participant');

    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error('User not found');
    }

    const user = userSnap.data();
    const color = avatarColors[participantIndex % avatarColors.length];

    return {
      name: user.displayName,
      color: color,
      userRef: userId,
      subtotal: 0,
    };
  },
});
