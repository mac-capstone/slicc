import { useQueries } from '@tanstack/react-query';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { createQuery } from 'react-query-kit';

import { db } from '@/api/common/firebase';
import { type BankPreference, type EventPerson, type UserIdT } from '@/types';

type User = {
  displayName: string;
  email: string;
  dietaryPreferences?: string[];
  locationPreference?: string;
  eTransferEmail?: string;
  bankPreference?: BankPreference;
};

export type UserWithId = User & { id: UserIdT };

type UserDoc = {
  displayName?: string;
  email?: string;
  dietaryPreferences?: string[];
  locationPreference?: string;
  eTransferEmail?: string;
  bankPreference?: BankPreference;
};

function mapUserDataToUserWithId(id: string, data: UserDoc): UserWithId {
  const displayName = data.displayName;
  const email = data.email;

  if (typeof displayName !== 'string' || typeof email !== 'string') {
    throw new Error('User profile is missing display name or email');
  }

  return {
    id: id as UserIdT,
    displayName,
    email,
    dietaryPreferences: Array.isArray(data.dietaryPreferences)
      ? data.dietaryPreferences.filter(
          (preference): preference is string => typeof preference === 'string'
        )
      : undefined,
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

export const useUserIds = createQuery<UserIdT[], void, Error>({
  queryKey: ['users'],
  fetcher: async () => {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    return snapshot.docs.map((d) => d.id as UserIdT);
  },
});

// Query to get a single user by ID
export const useUser = createQuery<UserWithId, string | null, Error>({
  queryKey: ['users', 'userId'],
  fetcher: async (userId) => {
    if (!userId) {
      throw new Error('User id is required');
    }
    return fetchUser(userId);
  },
});

// Hook to fetch multiple users and map them to Person type
export const useUsersAsPeople = (userIds: string[], colors: string[]) => {
  const queries = useQueries({
    queries: userIds.map((userId) => ({
      queryKey: ['users', 'userId', userId],
      queryFn: async (): Promise<UserWithId> => fetchUser(userId),
      staleTime: 5 * 60 * 1000, // 5 minutes
    })),
  });

  const isLoading = queries.some((query) => query.isLoading);
  const isError = queries.some((query) => query.isError);

  const people = queries
    .map((query, index) => {
      const user = query.data;
      if (!user) return null;

      const color = colors[index % colors.length];

      const person: EventPerson & { id: UserIdT } = {
        id: user.id,
        name: user.displayName,
        color,
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
};
