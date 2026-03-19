import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { db, storage } from '@/api/common/firebase';
import type { BankPreference, User } from '@/types';

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  heic: 'image/heic',
  heif: 'image/heif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function getMimeTypeFromUri(imageUri: string): string | null {
  const sanitizedUri = imageUri.split('?')[0] ?? imageUri;
  const extension = sanitizedUri.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();

  return extension ? (MIME_TYPE_BY_EXTENSION[extension] ?? null) : null;
}

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
  const contentType = blob.type || getMimeTypeFromUri(imageUri) || 'image/jpeg';

  const storageRef = ref(storage, `profile_pic/${userId}`);
  await uploadBytes(storageRef, blob, { contentType });
}

export async function getProfilePictureUrl(
  userId: string
): Promise<string | null> {
  try {
    const storageRef = ref(storage, `profile_pic/${userId}`);
    return await getDownloadURL(storageRef);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'storage/object-not-found'
    ) {
      return null;
    }

    console.warn('[user-api] failed to fetch profile picture url', {
      userId,
      error,
    });
    return null;
  }
}

export type CreateUserData = {
  displayName: string;
  username: string;
  email: string;
};

export type UpdateUserSettingsData = {
  dietaryPreferences: string[];
  locationPreference: string;
  eTransferEmail: string;
  bankPreference: BankPreference;
};

export class UserAlreadyExistsError extends Error {
  constructor(userId: string) {
    super(`User profile already exists for ${userId}`);
    this.name = 'UserAlreadyExistsError';
  }
}

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
    email: data.email.trim().toLowerCase(),
    dietaryPreferences: [],
    createdAt: now,
    updatedAt: now,
  };

  const userRef = doc(db, 'users', userId);
  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);

    if (userSnap.exists()) {
      throw new UserAlreadyExistsError(userId);
    }

    transaction.set(userRef, userDoc);
  });
  console.log('[user-api] firestore user created', { userId });
}

export async function updateUserSettingsInFirestore(
  userId: string,
  data: UpdateUserSettingsData
): Promise<void> {
  const userRef = doc(db, 'users', userId);

  await updateDoc(userRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}
