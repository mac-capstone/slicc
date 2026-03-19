import { useQueries } from '@tanstack/react-query';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { createQuery } from 'react-query-kit';

import { db } from '@/api/common/firebase';
import { mockData } from '@/lib/mock-data';
import { type EventPerson, type UserIdT } from '@/types';

const USE_MOCK_DATA = true; // Set to false when ready to use Firestore

type User = {
  displayName: string;
  email: string;
};

export type UserWithId = User & { id: UserIdT };

export async function fetchUser(userId: UserIdT): Promise<UserWithId> {
  if (USE_MOCK_DATA) {
    const user = mockData.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');
    return { id: user.id as UserIdT, ...user.doc } as UserWithId;
  }

  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error('User not found');
  }

  const data = userSnap.data();
  return {
    id: userSnap.id as UserIdT,
    displayName: data.displayName ?? '',
    email: data.email ?? '',
  } as UserWithId;
}

export const useUserIds = createQuery<UserIdT[], void, Error>({
  queryKey: ['users'],
  fetcher: async () => {
    if (USE_MOCK_DATA) {
      return mockData.users.map((u) => u.id as UserIdT);
    }
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    return snapshot.docs.map((d) => d.id as UserIdT);
  },
});

// Query to get a single user by ID
export const useUser = createQuery<UserWithId, UserIdT, Error>({
  queryKey: ['users', 'userId'],
  fetcher: async (userId) => {
    if (USE_MOCK_DATA) {
      const user = mockData.users.find((u) => u.id === userId);
      if (!user) throw new Error('User not found');
      return { id: user.id as UserIdT, ...user.doc } as UserWithId;
    }

    // Firestore implementation
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error('User not found');
    }

    return { id: userSnap.id as UserIdT, ...userSnap.data() } as UserWithId;
  },
});

// Hook to fetch multiple users and map them to Person type
export const useUsersAsPeople = (userIds: UserIdT[], colors: string[]) => {
  const queries = useQueries({
    queries: userIds.map((userId) => ({
      queryKey: ['users', 'userId', userId],
      queryFn: async () => {
        if (USE_MOCK_DATA) {
          const user = mockData.users.find((u) => u.id === userId);
          if (!user) throw new Error('User not found');
          return { id: user.id as UserIdT, ...user.doc } as UserWithId;
        }

        // Firestore implementation
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          throw new Error('User not found');
        }

        return {
          id: userSnap.id as UserIdT,
          ...userSnap.data(),
        } as UserWithId;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    })),
  });

  const isLoading = queries.some((query) => query.isLoading);
  const isError = queries.some((query) => query.isError);

  const people: (EventPerson & { id: UserIdT })[] = queries.map(
    (query, index) => {
      const user = query.data;
      const userId = userIds[index];
      const color = colors[index % colors.length];

      return {
        id: userId,
        name: user?.displayName || `User ${userId}`,
        color: color,
        userRef: userId,
        subtotal: 0,
        paid: 0,
      };
    }
  );

  return { people, isLoading, isError };
};
