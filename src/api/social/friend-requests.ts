import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  type QuerySnapshot,
  runTransaction,
  Timestamp,
  where,
} from 'firebase/firestore';
import { createQuery } from 'react-query-kit';

import { db } from '@/api/common/firebase';
import { getUserIdByUsername } from '@/api/people/user-api';
import { encodeIdBase64Url } from '@/lib/utils';
import type { UserIdT } from '@/types';

type FirestoreTransaction = Parameters<Parameters<typeof runTransaction>[1]>[0];

const COLLECTION = 'friendRequests';
const FRIENDSHIPS = 'friendships';

export function friendshipDocId(a: string, b: string): string {
  return [encodeIdBase64Url(a), encodeIdBase64Url(b)].sort().join('.');
}

export function friendRequestDocId(
  fromUserId: string,
  toUserId: string
): string {
  return `${encodeIdBase64Url(fromUserId)}.${encodeIdBase64Url(toUserId)}`;
}

export type FriendRequestFirestore = {
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: Timestamp;
  updatedAt?: Timestamp;
};

export type IncomingFriendRequest = {
  id: string;
  fromUserId: string;
  toUserId: string;
  createdAt: Timestamp;
};

export class FriendRequestConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FriendRequestConflictError';
  }
}

function requestRef(id: string) {
  return doc(db, COLLECTION, id);
}

function friendshipRef(id: string) {
  return doc(db, FRIENDSHIPS, id);
}

function userRef(uid: string) {
  return doc(db, 'users', uid);
}

/** React Query root key; variables (user id) are appended by react-query-kit `getKey`. */
export const INCOMING_FRIEND_REQUESTS_QUERY_KEY = [
  'friendRequests',
  'incoming',
] as const;

function pendingIncomingFriendRequestsQuery(toUserId: UserIdT) {
  return query(
    collection(db, COLLECTION),
    where('toUserId', '==', toUserId),
    where('status', '==', 'pending')
  );
}

function mapSnapshotToIncomingRequests(
  snapshot: QuerySnapshot
): IncomingFriendRequest[] {
  return snapshot.docs.map((d) => {
    const data = d.data() as FriendRequestFirestore;
    return {
      id: d.id,
      fromUserId: data.fromUserId,
      toUserId: data.toUserId,
      createdAt: data.createdAt,
    };
  });
}

/**
 * Fetch pending requests where the current user is the recipient.
 * Requires a Firestore composite index on (toUserId, status).
 */
export async function fetchPendingIncomingFriendRequests(
  toUserId: UserIdT
): Promise<IncomingFriendRequest[]> {
  const snapshot = await getDocs(pendingIncomingFriendRequestsQuery(toUserId));
  return mapSnapshotToIncomingRequests(snapshot);
}

/**
 * Real-time listener for pending incoming requests. Unsubscribe when done.
 */
export function subscribePendingIncomingFriendRequests(
  toUserId: UserIdT,
  onNext: (rows: IncomingFriendRequest[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = pendingIncomingFriendRequestsQuery(toUserId);
  return onSnapshot(
    q,
    (snapshot) => onNext(mapSnapshotToIncomingRequests(snapshot)),
    (error) => {
      onError?.(error);
    }
  );
}

type IncomingVariables = UserIdT | null;

export const useIncomingFriendRequests = createQuery<
  IncomingFriendRequest[],
  IncomingVariables,
  Error
>({
  queryKey: INCOMING_FRIEND_REQUESTS_QUERY_KEY,
  fetcher: async (userId) => {
    if (!userId || userId === 'guest_user') return [];
    return fetchPendingIncomingFriendRequests(userId);
  },
});

function completeFriendshipInTransaction(
  transaction: FirestoreTransaction,
  params: {
    requestRefId: string;
    fromUserId: string;
    toUserId: string;
  }
) {
  const { requestRefId, fromUserId, toUserId } = params;
  const now = Timestamp.now();
  const pairId = friendshipDocId(fromUserId, toUserId);
  const sortedPair = [fromUserId, toUserId].sort() as [string, string];

  transaction.update(requestRef(requestRefId), {
    status: 'accepted',
    updatedAt: now,
  });

  transaction.set(friendshipRef(pairId), {
    userIds: sortedPair,
    createdAt: now,
    acceptedFromRequestId: requestRefId,
  });

  transaction.update(userRef(fromUserId), {
    friends: arrayUnion(toUserId),
    updatedAt: now,
  });
  transaction.update(userRef(toUserId), {
    friends: arrayUnion(fromUserId),
    updatedAt: now,
  });
}

/**
 * Send a friend request by username (normalized). Resolves recipient id inside.
 * If the other user already sent a pending request to you, accepts that request instead.
 */
export async function sendFriendRequest(params: {
  fromUserId: UserIdT;
  toUsername: string;
}): Promise<void> {
  const { fromUserId, toUsername } = params;
  const normalized = toUsername.toLowerCase().trim();
  if (!normalized) {
    throw new FriendRequestConflictError('Enter a username');
  }

  const toUserId = await getUserIdByUsername(normalized, fromUserId);
  if (!toUserId) {
    throw new FriendRequestConflictError('No user found with that username.');
  }
  if (toUserId === fromUserId) {
    throw new FriendRequestConflictError('You cannot add yourself.');
  }

  await runTransaction(db, async (transaction) => {
    const pairId = friendshipDocId(fromUserId, toUserId);
    const fSnap = await transaction.get(friendshipRef(pairId));
    if (fSnap.exists()) {
      throw new FriendRequestConflictError(
        'You are already friends with this user.'
      );
    }

    const forwardId = friendRequestDocId(fromUserId, toUserId);
    const reverseId = friendRequestDocId(toUserId, fromUserId);
    const forwardSnap = await transaction.get(requestRef(forwardId));
    const reverseSnap = await transaction.get(requestRef(reverseId));

    const forward = forwardSnap.exists()
      ? (forwardSnap.data() as FriendRequestFirestore)
      : null;
    const reverse = reverseSnap.exists()
      ? (reverseSnap.data() as FriendRequestFirestore)
      : null;

    if (forward?.status === 'pending') {
      throw new FriendRequestConflictError('Friend request already sent.');
    }
    if (forward?.status === 'accepted') {
      throw new FriendRequestConflictError(
        'You are already friends with this user.'
      );
    }

    if (reverse?.status === 'pending') {
      completeFriendshipInTransaction(transaction, {
        requestRefId: reverseId,
        fromUserId: toUserId,
        toUserId: fromUserId,
      });
      return;
    }

    const now = Timestamp.now();
    transaction.set(requestRef(forwardId), {
      fromUserId,
      toUserId,
      status: 'pending',
      createdAt: now,
    } satisfies FriendRequestFirestore);
  });
}

/** Recipient accepts an incoming pending request. */
export async function acceptFriendRequest(params: {
  requestId: string;
  currentUserId: UserIdT;
}): Promise<void> {
  const { requestId, currentUserId } = params;

  await runTransaction(db, async (transaction) => {
    const reqSnap = await transaction.get(requestRef(requestId));
    if (!reqSnap.exists()) {
      throw new FriendRequestConflictError('Request not found.');
    }
    const data = reqSnap.data() as FriendRequestFirestore;
    if (data.toUserId !== currentUserId) {
      throw new FriendRequestConflictError('You cannot accept this request.');
    }
    if (data.status !== 'pending') {
      throw new FriendRequestConflictError(
        'This request is no longer pending.'
      );
    }

    const pairId = friendshipDocId(data.fromUserId, data.toUserId);
    const fSnap = await transaction.get(friendshipRef(pairId));
    if (fSnap.exists()) {
      transaction.update(requestRef(requestId), {
        status: 'accepted',
        updatedAt: Timestamp.now(),
      });
      return;
    }

    completeFriendshipInTransaction(transaction, {
      requestRefId: requestId,
      fromUserId: data.fromUserId,
      toUserId: data.toUserId,
    });
  });
}

/** Recipient declines an incoming pending request. */
export async function declineFriendRequest(params: {
  requestId: string;
  currentUserId: UserIdT;
}): Promise<void> {
  const { requestId, currentUserId } = params;

  await runTransaction(db, async (transaction) => {
    const reqSnap = await transaction.get(requestRef(requestId));
    if (!reqSnap.exists()) {
      throw new FriendRequestConflictError('Request not found.');
    }
    const data = reqSnap.data() as FriendRequestFirestore;
    if (data.toUserId !== currentUserId) {
      throw new FriendRequestConflictError('You cannot decline this request.');
    }
    if (data.status !== 'pending') {
      throw new FriendRequestConflictError(
        'This request is no longer pending.'
      );
    }

    transaction.update(requestRef(requestId), {
      status: 'declined',
      updatedAt: Timestamp.now(),
    });
  });
}
