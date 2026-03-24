import { useQuery } from '@tanstack/react-query';
import {
  collection,
  type CollectionReference,
  doc,
  type DocumentData,
  documentId,
  getDoc,
  getDocs,
  limit,
  type Query,
  query,
  where,
} from 'firebase/firestore';
import { createQuery } from 'react-query-kit';

import { db } from '@/api/common/firebase';
import {
  type EventPerson,
  userConverter,
  type UserIdT,
  type UserProfile,
  type UserSettings,
  userSettingsConverter,
  type UserWithId,
} from '@/types';

// Re-export so callers importing from this file still work
export type { UserWithId };

function userDocRef(userId: string) {
  return doc(db, 'users', userId).withConverter(userConverter);
}

function userSettingsDocRef(userId: string) {
  return doc(db, 'users', userId, 'settings', 'private').withConverter(
    userSettingsConverter
  );
}

function usersCollectionRef(): CollectionReference<UserProfile, DocumentData> {
  return collection(db, 'users').withConverter(userConverter);
}

function toUserWithId(
  id: string,
  profile: UserProfile,
  settings: Partial<UserSettings>
): UserWithId {
  return {
    id: id as UserIdT,
    ...profile,
    ...settings,
  };
}

async function loadUserSettingsPartial(
  userId: string
): Promise<Partial<UserSettings>> {
  try {
    const snap = await getDoc(userSettingsDocRef(userId));
    if (!snap.exists()) return {};
    return snap.data();
  } catch {
    return {};
  }
}

export async function fetchUser(userId: string): Promise<UserWithId> {
  const userSnap = await getDoc(userDocRef(userId));

  if (!userSnap.exists()) {
    throw new Error('User not found');
  }

  const profile = userSnap.data();
  const settings = await loadUserSettingsPartial(userId);
  return toUserWithId(userSnap.id, profile, settings);
}

// Firestore prefix search on username (stored lowercase -- reliable & case-safe).
// For display-name search use client-side filtering via fetchAllUsers.
export async function searchUsersByUsername(
  searchQuery: string,
  resultLimit = 10
): Promise<UserWithId[]> {
  if (!searchQuery.trim()) return [];

  const q = searchQuery.trim().toLowerCase();
  const usersRef = usersCollectionRef();
  const firestoreQuery: Query<UserProfile, DocumentData> = query(
    usersRef,
    where('username', '>=', q),
    where('username', '<=', q + '\uf8ff'),
    limit(resultLimit)
  );
  const snapshot = await getDocs(firestoreQuery);
  return Promise.all(
    snapshot.docs.map(async (d) => {
      const profile = d.data();
      const settings = await loadUserSettingsPartial(d.id);
      return toUserWithId(d.id, profile, settings);
    })
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

  const usersRef = usersCollectionRef();
  const chunks = chunkUserIds(userIds);
  const snapshots = await Promise.all(
    chunks.map((chunk) =>
      getDocs(
        query<UserProfile, DocumentData>(
          usersRef,
          where(documentId(), 'in', [...chunk])
        )
      )
    )
  );

  const profileById = new Map<string, UserProfile>();
  for (const snapshot of snapshots) {
    for (const userDoc of snapshot.docs) {
      profileById.set(userDoc.id, userDoc.data());
    }
  }

  const missingUserId = userIds.find((userId) => !profileById.has(userId));
  if (missingUserId) {
    throw new Error('User not found');
  }

  const settingsPartials = await Promise.all(
    userIds.map((id) => loadUserSettingsPartial(id))
  );

  return userIds.map((userId, index) => {
    const profile = profileById.get(userId);
    if (!profile) {
      throw new Error('User not found');
    }
    return toUserWithId(userId, profile, settingsPartials[index] ?? {});
  });
}

export function useUsersAsPeople(
  userIds: UserIdT[],
  colors: string[] = []
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
      color: colors.length > 0 ? colors[index % colors.length] : '',
      userRef: user.id,
      subtotal: 0,
      paid: 0,
    };

    return person;
  });

  return { people, isLoading, isError };
}
