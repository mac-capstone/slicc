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
import { ref, uploadBytes } from 'firebase/storage';

import { db, storage } from '@/api/common/firebase';
import type { User } from '@/types';

export async function checkUserExistsInFirestore(
  userId: string
): Promise<boolean> {
  console.log('[user-api] checking firestore user', { userId });
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  const exists = userSnap.exists();
  console.log('[user-api] firestore user check result', { userId, exists });
  return exists;
}

export async function checkUsernameExists(
  username: string,
  excludeUserId?: string
): Promise<boolean> {
  const normalized = username.toLowerCase().trim();
  if (!normalized) return true; // Empty is considered "taken"

  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('username', '==', normalized));
  const snapshot = await getDocs(q);

  return snapshot.docs.some((d) => d.id !== excludeUserId);
}

export async function uploadProfilePicture(
  userId: string,
  imageUri: string
): Promise<void> {
  const response = await fetch(imageUri);
  const blob = await response.blob();

  const storageRef = ref(storage, `profile_pic/${userId}`);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
}

export type CreateUserData = {
  displayName: string;
  username: string;
};

export async function createUserInFirestore(
  userId: string,
  data: CreateUserData
): Promise<void> {
  console.log('[user-api] creating firestore user', {
    userId,
    username: data.username.toLowerCase().trim(),
  });
  const now = Timestamp.now();
  const userDoc: Omit<User, 'createdAt' | 'updatedAt'> & {
    createdAt: Timestamp;
    updatedAt: Timestamp;
  } = {
    username: data.username.toLowerCase().trim(),
    displayName: data.displayName.trim(),
    createdAt: now,
    updatedAt: now,
  };

  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, userDoc);
  console.log('[user-api] firestore user created', { userId });
}
