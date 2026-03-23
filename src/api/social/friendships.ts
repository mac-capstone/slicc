import {
  arrayRemove,
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  Timestamp,
  where,
} from 'firebase/firestore';
import { createQuery } from 'react-query-kit';

import { db } from '@/api/common/firebase';
import type { UserIdT } from '@/types';

import { friendRequestDocId, friendshipDocId } from './friend-requests';

const FRIENDSHIPS = 'friendships';
const FRIEND_REQUESTS = 'friendRequests';

function friendRequestRef(fromUserId: string, toUserId: string) {
  return doc(db, FRIEND_REQUESTS, friendRequestDocId(fromUserId, toUserId));
}

function friendshipRef(pairId: string) {
  return doc(db, FRIENDSHIPS, pairId);
}

function userDocRef(uid: string) {
  return doc(db, 'users', uid);
}

/**
 * User ids for everyone in a friendship with `forUserId` (from `friendships` docs).
 */
export async function fetchFriendUserIds(
  forUserId: UserIdT
): Promise<UserIdT[]> {
  const q = query(
    collection(db, FRIENDSHIPS),
    where('userIds', 'array-contains', forUserId)
  );
  const snapshot = await getDocs(q);
  const out = new Set<UserIdT>();

  for (const d of snapshot.docs) {
    const userIds = d.data()?.userIds;
    if (!Array.isArray(userIds) || userIds.length !== 2) continue;
    const other = userIds.find((id: string) => id !== forUserId);
    if (other) out.add(other as UserIdT);
  }

  return [...out];
}

type FriendIdsVariables = UserIdT | null;

export const useFriendUserIds = createQuery<
  UserIdT[],
  FriendIdsVariables,
  Error
>({
  queryKey: ['friendships', 'friendIds'],
  fetcher: async (uid) => {
    if (!uid || uid === 'guest_user') return [];
    return fetchFriendUserIds(uid);
  },
});

/**
 * Remove friendship doc and both users' `friends` array entries (persisted unfriend).
 */
export async function unfriendUser(params: {
  currentUserId: UserIdT;
  friendUserId: UserIdT;
}): Promise<void> {
  const { currentUserId, friendUserId } = params;
  if (currentUserId === friendUserId) {
    throw new Error('Invalid unfriend target');
  }

  const pairId = friendshipDocId(currentUserId, friendUserId);
  const fRef = friendshipRef(pairId);
  const selfRef = userDocRef(currentUserId);
  const otherRef = userDocRef(friendUserId);
  const requestForwardRef = friendRequestRef(currentUserId, friendUserId);
  const requestReverseRef = friendRequestRef(friendUserId, currentUserId);
  const now = Timestamp.now();

  await runTransaction(db, async (transaction) => {
    const fSnap = await transaction.get(fRef);
    if (!fSnap.exists()) {
      throw new Error('Friendship not found');
    }

    const forwardReqSnap = await transaction.get(requestForwardRef);
    const reverseReqSnap = await transaction.get(requestReverseRef);

    await transaction.get(selfRef);
    await transaction.get(otherRef);

    transaction.delete(fRef);
    if (forwardReqSnap.exists()) {
      transaction.delete(requestForwardRef);
    }
    if (reverseReqSnap.exists()) {
      transaction.delete(requestReverseRef);
    }
    transaction.update(selfRef, {
      friends: arrayRemove(friendUserId),
      updatedAt: now,
    });
    transaction.update(otherRef, {
      friends: arrayRemove(currentUserId),
      updatedAt: now,
    });
  });
}
