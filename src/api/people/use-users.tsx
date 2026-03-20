import { useQuery } from '@tanstack/react-query';
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { createQuery } from 'react-query-kit';

import { db } from '@/api/common/firebase';
import { getUserId } from '@/lib';
import {
  type BankPreference,
  type EventPerson,
  type UserIdT,
  type UserWithId,
} from '@/types';

// Re-export so callers importing from this file still work
export type { UserWithId };

type PublicUserDoc = {
  username?: string;
  displayName?: string;
};

type UserSettingsDoc = {
  dietaryPreferences?: string[];
  locationPreference?: string;
  eTransferEmail?: string;
  bankPreference?: BankPreference;
};

function mapPublicUserDataToUserWithId(
  id: string,
  data: PublicUserDoc
): UserWithId {
  const { displayName } = data;

  if (typeof displayName !== 'string') {
    throw new Error('User profile is missing display name');
  }

  return {
    id: id as UserIdT,
    username: typeof data.username === 'string' ? data.username : '',
    displayName,
  };
}

function mapSettingsData(data: UserSettingsDoc): Partial<UserWithId> {
  return {
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

  const baseUser = mapPublicUserDataToUserWithId(userSnap.id, userSnap.data());
  const authUserId = getUserId();
  if (authUserId !== (userId as UserIdT)) {
    return baseUser;
  }

  const settingsRef = doc(db, 'users', userId, 'settings', 'private');
  const settingsSnap = await getDoc(settingsRef);
  if (!settingsSnap.exists()) {
    return baseUser;
  }

  return {
    ...baseUser,
    ...mapSettingsData(settingsSnap.data()),
  };
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
  return snapshot.docs.map((d) =>
    mapPublicUserDataToUserWithId(d.id, d.data())
  );
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

const FIRESTORE_IN_QUERY_LIMIT = 10;

function chunkUserIds(userIds: UserIdT[]): UserIdT[][] {
  const chunks: UserIdT[][] = [];
  for (
    let index = 0;
    index < userIds.length;
    index += FIRESTORE_IN_QUERY_LIMIT
  ) {
    chunks.push(userIds.slice(index, index + FIRESTORE_IN_QUERY_LIMIT));
  }
  return chunks;
}

async function fetchUsersBatch(userIds: UserIdT[]): Promise<UserWithId[]> {
  if (userIds.length === 0) return [];

  const usersRef = collection(db, 'users');
  const chunks = chunkUserIds(userIds);
  const snapshots = await Promise.all(
    chunks.map((chunk) =>
      getDocs(query(usersRef, where(documentId(), 'in', [...chunk])))
    )
  );

  const byId = new Map<UserIdT, UserWithId>();
  for (const snapshot of snapshots) {
    for (const userDoc of snapshot.docs) {
      const user = mapPublicUserDataToUserWithId(userDoc.id, userDoc.data());
      byId.set(user.id, user);
    }
  }

  const missingUserId = userIds.find((userId) => !byId.has(userId));
  if (missingUserId) {
    throw new Error('User not found');
  }

  return userIds
    .map((userId) => byId.get(userId))
    .filter(Boolean) as UserWithId[];
}

export function useUsersAsPeople(
  userIds: UserIdT[],
  colorKeys: string[] = []
): {
  people: (EventPerson & { id: UserIdT })[];
  isLoading: boolean;
  isError: boolean;
} {
  const {
    data: users = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['users', 'batch', userIds],
    queryFn: () => fetchUsersBatch(userIds),
    staleTime: 5 * 60 * 1000,
    enabled: userIds.length > 0,
  });

  const people = users.map((user, index) => {
    const person: EventPerson & { id: UserIdT } = {
      id: user.id,
      name: user.displayName,
      color: colorKeys.length > 0 ? colorKeys[index % colorKeys.length] : '',
      userRef: user.id,
      subtotal: 0,
      paid: 0,
    };

    return person;
  });

  return { people, isLoading, isError };
}
