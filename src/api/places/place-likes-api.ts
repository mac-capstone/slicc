import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';

import { db } from '@/api/common/firebase';

const COLLECTION = 'placeLikes';

export async function setPlaceLikes(
  userId: string,
  placeIds: string[]
): Promise<void> {
  const ref = doc(db, COLLECTION, userId);
  await setDoc(
    ref,
    {
      placeIds,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );
}

export async function upsertPlaceLike(
  userId: string,
  placeId: string
): Promise<void> {
  const ref = doc(db, COLLECTION, userId);
  await setDoc(
    ref,
    {
      placeIds: arrayUnion(placeId),
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );
}

export async function removePlaceLike(
  userId: string,
  placeId: string
): Promise<void> {
  const ref = doc(db, COLLECTION, userId);
  await setDoc(
    ref,
    {
      placeIds: arrayRemove(placeId),
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );
}

export type UserPlaceLikesDoc = {
  id: string;
  placeIds: string[];
};

export async function getUsersWhoLikedPlace(
  placeId: string,
  limitCount = 50
): Promise<UserPlaceLikesDoc[]> {
  const ref = collection(db, COLLECTION);
  const q = query(
    ref,
    where('placeIds', 'array-contains', placeId),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data() as { placeIds?: string[] };
    return {
      id: d.id,
      placeIds: data.placeIds ?? [],
    };
  });
}

export async function getPlaceLikesForUser(userId: string): Promise<string[]> {
  const ref = doc(db, COLLECTION, userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const data = snap.data() as { placeIds?: string[] };
  return data.placeIds ?? [];
}
