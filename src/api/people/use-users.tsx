import { useQueries } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { createQuery } from 'react-query-kit';

import { db } from '@/api/common/firebase';
import {
  type BankPreference,
  type EventPerson,
  type UserIdT,
  type UserWithId,
} from '@/types';

// Re-export so callers importing from this file still work
export type { UserWithId };

type UserDoc = {
  username?: string;
  displayName?: string;
  dietaryPreferences?: string[];
  locationPreference?: string;
  eTransferEmail?: string;
  bankPreference?: BankPreference;
};

function mapUserDataToUserWithId(id: string, data: UserDoc): UserWithId {
  const { displayName } = data;

  if (typeof displayName !== 'string') {
    throw new Error('User profile is missing display name');
  }

  return {
    id: id as UserIdT,
    username: typeof data.username === 'string' ? data.username : '',
    displayName,
    dietaryPreferences: Array.isArray(data.dietaryPreferences)
      ? data.dietaryPreferences.filter(
          (p): p is string => typeof p === 'string'
        )
      : [],
    locationPreference:
      typeof data.locationPreference === 'string'
        ? data.locationPreference
        : undefined,
    eTransferEmail:
      typeof data.eTransferEmail === 'string' ? data.eTransferEmail : undefined,
    bankPreference: data.bankPreference,
  };
}

export async function fetchUser(userId: string): Promise<UserWithId> {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error('User not found');
  }

  return mapUserDataToUserWithId(userSnap.id, userSnap.data());
}

// Firestore prefix search on username (stored lowercase — reliable & case-safe).
// For display-name search use client-side filtering via fetchAllUsers.
export async function searchUsersByUsername(
  searchQuery: string,
  resultLimit = 10
): Promise<UserWithId[]> {
  if (!searchQuery.trim()) return [];

  const q = searchQuery.trim().toLowerCase();
  const usersRef = collection(db, 'users');
  const firestoreQuery = query(
    usersRef,
    where('username', '>=', q),
    where('username', '<=', q + '\uf8ff'),
    limit(resultLimit)
  );
  const snapshot = await getDocs(firestoreQuery);
  return snapshot.docs.map((d) => mapUserDataToUserWithId(d.id, d.data()));
}

export const useUserIds = createQuery<UserIdT[], void, Error>({
  queryKey: ['users'],
  fetcher: async () => {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    return snapshot.docs.map((d) => d.id as UserIdT);
  },
});

export const useUser = createQuery<UserWithId, UserIdT, Error>({
  queryKey: ['users', 'userId'],
  fetcher: async (userId) => fetchUser(userId),
});

export const useSearchUsers = createQuery<UserWithId[], string, Error>({
  queryKey: ['users', 'search'],
  fetcher: async (searchQuery) => searchUsersByUsername(searchQuery),
});

export function useUsersAsPeople(
  userIds: UserIdT[],
  colors: string[]
): {
  people: (EventPerson & { id: UserIdT })[];
  isLoading: boolean;
  isError: boolean;
} {
  const queries = useQueries({
    queries: userIds.map((userId) => ({
      queryKey: ['users', 'userId', userId],
      queryFn: () => fetchUser(userId),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);

  const people = queries
    .map((q, index) => {
      const user = q.data;
      if (!user) return null;

      const person: EventPerson & { id: UserIdT } = {
        id: user.id,
        name: user.displayName,
        color: colors[index % colors.length] ?? '',
        userRef: user.id,
        subtotal: 0,
        paid: 0,
      };

      return person;
    })
    .filter(
      (person): person is EventPerson & { id: UserIdT } => person !== null
    );

  return { people, isLoading, isError };
}
