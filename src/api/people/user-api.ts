import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { db, storage } from '@/api/common/firebase';
import { mockData } from '@/lib/mock-data';
import type { User, UserIdT } from '@/types';

const USE_MOCK_DATA = true; // Set to false when ready to use Firestore

export async function checkUserExistsInFirestore(
  userId: string
): Promise<boolean> {
  if (USE_MOCK_DATA) {
    return mockData.users.some((u) => u.id === userId);
  }

  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  return userSnap.exists();
}

export async function checkUsernameExists(
  username: string,
  excludeUserId?: string
): Promise<boolean> {
  const normalized = username.toLowerCase().trim();
  if (!normalized) return true; // Empty is considered "taken"

  if (USE_MOCK_DATA) {
    const exists = mockData.users.some(
      (u) =>
        (u.doc as { username?: string }).username?.toLowerCase() ===
          normalized && u.id !== excludeUserId
    );
    return exists;
  }

  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('username', '==', normalized));
  const snapshot = await getDocs(q);

  return snapshot.docs.some((d) => d.id !== excludeUserId);
}

export async function uploadProfilePicture(
  userId: string,
  imageUri: string
): Promise<string> {
  const response = await fetch(imageUri);
  const blob = await response.blob();

  const storageRef = ref(storage, `users/${userId}/profile.jpg`);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}

export type CreateUserData = {
  displayName: string;
  username: string;
  photoURL?: string | null;
};

export async function createUserInFirestore(
  userId: string,
  data: CreateUserData
): Promise<void> {
  const now = Timestamp.now();
  const userDoc: Omit<User, 'createdAt' | 'updatedAt'> & {
    createdAt: Timestamp;
    updatedAt: Timestamp;
  } = {
    username: data.username.toLowerCase().trim(),
    displayName: data.displayName.trim(),
    photoURL: data.photoURL ?? null,
    createdAt: now,
    updatedAt: now,
  };

  if (USE_MOCK_DATA) {
    mockData.users.push({
      id: userId as UserIdT,
      doc: {
        displayName: userDoc.displayName,
        email: '',
        photoURL: userDoc.photoURL ?? null,
        username: userDoc.username,
      },
    } as unknown as (typeof mockData.users)[number]);
    return;
  }

  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, userDoc);
}
