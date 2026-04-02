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
import { getAuthUserId, useAuth } from '@/lib/auth';
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

/** Variables for {@link useUser}; include viewer so the query refetches when auth hydrates. */
export type UseUserVariables = {
  userId: UserIdT;
  viewerUserId: string | null;
};

function userDocRef(userId: string) {
  return doc(db, 'users', userId).withConverter(userConverter);
}

function privateSettingsDocRef(userId: string) {
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

/**
 * Loads `users/{userId}/settings/private` only when `viewerUserId === userId`.
 * Callers must not use this for arbitrary users (social/search/batch for others).
 */
async function loadPrivateSettingsWhenSelf(
  userId: string,
  viewerUserId: string | null
): Promise<Partial<UserSettings>> {
  if (viewerUserId == null || viewerUserId !== userId) return {};

  const snap = await getDoc(privateSettingsDocRef(userId));
  if (!snap.exists()) return {};
  return snap.data();
}

export async function fetchUser(
  userId: string,
  viewerUserId: string | null = getAuthUserId()
): Promise<UserWithId> {
  const userSnap = await getDoc(userDocRef(userId));

  if (!userSnap.exists()) {
    throw new Error('User not found');
  }

  const profile = userSnap.data();
  const settings = await loadPrivateSettingsWhenSelf(userId, viewerUserId);
  return toUserWithId(userSnap.id, profile, settings);
}

// Firestore prefix search on username (stored lowercase — reliable & case-safe).
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
  return snapshot.docs.map((d) => {
    const profile = d.data();
    return toUserWithId(d.id, profile, {});
  });
}

export const useUserIds = createQuery<UserIdT[], void, Error>({
  queryKey: ['users'],
  fetcher: async () => {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    return snapshot.docs.map((d) => d.id as UserIdT);
  },
});

export const useUser = createQuery<UserWithId, UseUserVariables, Error>({
  queryKey: ['users', 'userId'],
  fetcher: async ({ userId, viewerUserId }) => fetchUser(userId, viewerUserId),
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

export async function fetchUsersBatch(
  userIds: UserIdT[],
  viewerUserId: string | null
): Promise<UserWithId[]> {
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

  let selfPrivate: Partial<UserSettings> = {};
  if (viewerUserId != null && userIds.some((id) => id === viewerUserId)) {
    selfPrivate = await loadPrivateSettingsWhenSelf(viewerUserId, viewerUserId);
  }

  return userIds.map((userId) => {
    const profile = profileById.get(userId);
    if (!profile) {
      throw new Error('User not found');
    }
    const settings = viewerUserId === userId ? selfPrivate : {};
    return toUserWithId(userId, profile, settings);
  });
}

export function useUsersAsPeople(
  userIds: UserIdT[],
  colors: string[] = [],
  options?: { enabled?: boolean }
): {
  people: (EventPerson & { id: UserIdT })[];
  isLoading: boolean;
  isError: boolean;
} {
  const viewerUserId = useAuth.use.userId() ?? null;
  const queryEnabled = userIds.length > 0 && (options?.enabled ?? true);

  const {
    data: users = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['users', 'batch', userIds, viewerUserId],
    queryFn: () => fetchUsersBatch(userIds, viewerUserId),
    staleTime: 5 * 60 * 1000,
    enabled: queryEnabled,
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
