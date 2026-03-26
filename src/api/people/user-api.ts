import {
  collection,
  deleteField,
  doc,
  type DocumentData,
  documentId,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { db, storage } from '@/api/common/firebase';
import { normalizeDietaryPreferenceIds } from '@/lib/dietary-preference-options';
import type {
  UpdateUserSettingsData,
  UserProfile,
  UserSettings,
} from '@/types';
import { userConverter } from '@/types/schema';

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

/** Returns another user's id for a normalized username, or null if none. */
export async function getUserIdByUsername(
  username: string,
  excludeUserId?: string
): Promise<string | null> {
  const normalized = username.toLowerCase().trim();
  if (!normalized) return null;

  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('username', '==', normalized));
  const snapshot = await getDocs(q);
  const match = snapshot.docs.find((d) => d.id !== excludeUserId);
  return match?.id ?? null;
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
};

export type { UpdateUserSettingsData };

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
  const userDoc: Omit<UserProfile, 'createdAt' | 'updatedAt'> & {
    createdAt: Timestamp;
    updatedAt: Timestamp;
  } = {
    username: data.username.toLowerCase().trim(),
    displayName: data.displayName.trim(),
    friends: [],
    dietaryPreferenceIds: [],
    createdAt: now,
    updatedAt: now,
  };

  const userSettingsDoc: Omit<UserSettings, 'updatedAt'> & {
    updatedAt: Timestamp;
  } = {
    dietaryPreferences: [],
    defaultTaxRate: 0,
    defaultTipRate: 0,
    updatedAt: now,
  };

  const userRef = doc(db, 'users', userId);
  const userSettingsRef = doc(db, 'users', userId, 'settings', 'private');
  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);

    if (userSnap.exists()) {
      throw new UserAlreadyExistsError(userId);
    }

    transaction.set(userRef, userDoc);
    transaction.set(userSettingsRef, userSettingsDoc);
  });
  console.log('[user-api] firestore user created', { userId });
}

function buildUserSettingsPatch(
  data: UpdateUserSettingsData,
  updatedAt: Timestamp
): DocumentData {
  const payload: DocumentData = { updatedAt };
  const record = data as Record<string, unknown>;

  if (Object.hasOwn(record, 'dietaryPreferences')) {
    const v = data.dietaryPreferences;
    payload.dietaryPreferences = v === undefined ? deleteField() : v;
  }

  if (Object.hasOwn(record, 'locationPreference')) {
    const trimmed = data.locationPreference?.trim();
    payload.locationPreference = trimmed ? trimmed : deleteField();
  }

  if (Object.hasOwn(record, 'eTransferEmail')) {
    const trimmed = data.eTransferEmail?.trim();
    payload.eTransferEmail = trimmed ? trimmed : deleteField();
  }

  if (Object.hasOwn(record, 'bankPreference')) {
    payload.bankPreference = data.bankPreference ?? deleteField();
  }

  if (Object.hasOwn(record, 'defaultTaxRate')) {
    payload.defaultTaxRate =
      data.defaultTaxRate === undefined ? deleteField() : data.defaultTaxRate;
  }

  if (Object.hasOwn(record, 'defaultTipRate')) {
    payload.defaultTipRate =
      data.defaultTipRate === undefined ? deleteField() : data.defaultTipRate;
  }

  return payload;
}

const FIRESTORE_IN_QUERY_LIMIT = 10;

export async function updateUserSettingsInFirestore(
  userId: string,
  data: UpdateUserSettingsData
): Promise<void> {
  const userSettingsRef = doc(db, 'users', userId, 'settings', 'private');
  const now = Timestamp.now();

  await setDoc(userSettingsRef, buildUserSettingsPatch(data, now), {
    merge: true,
  });

  const record = data as Record<string, unknown>;
  if (Object.hasOwn(record, 'dietaryPreferences')) {
    const raw = data.dietaryPreferences;
    const ids = normalizeDietaryPreferenceIds(Array.isArray(raw) ? raw : []);
    await setDoc(
      doc(db, 'users', userId),
      { dietaryPreferenceIds: ids, updatedAt: now },
      { merge: true }
    );
  }
}

/**
 * Batch-load public dietary preference IDs for peer ranking (chunked `in` queries).
 */
export async function fetchPublicDietaryPreferencesByUserIds(
  userIds: string[]
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (userIds.length === 0) return out;

  const usersRef = collection(db, 'users').withConverter(userConverter);
  const unique = [...new Set(userIds)];

  for (let i = 0; i < unique.length; i += FIRESTORE_IN_QUERY_LIMIT) {
    const chunk = unique.slice(i, i + FIRESTORE_IN_QUERY_LIMIT);
    const q = query(usersRef, where(documentId(), 'in', chunk));
    const snapshot = await getDocs(q);
    for (const d of snapshot.docs) {
      const profile = d.data();
      out.set(
        d.id,
        normalizeDietaryPreferenceIds(profile.dietaryPreferenceIds ?? [])
      );
    }
  }
  return out;
}

export async function updateDefaultRatesInFirestore(
  userId: string,
  data: { defaultTaxRate?: number; defaultTipRate?: number }
): Promise<void> {
  const userSettingsRef = doc(db, 'users', userId, 'settings', 'private');
  const now = Timestamp.now();
  const payload: DocumentData = { updatedAt: now };
  const record = data as Record<string, unknown>;

  if (Object.hasOwn(record, 'defaultTaxRate')) {
    payload.defaultTaxRate =
      data.defaultTaxRate === undefined ? deleteField() : data.defaultTaxRate;
  }

  if (Object.hasOwn(record, 'defaultTipRate')) {
    payload.defaultTipRate =
      data.defaultTipRate === undefined ? deleteField() : data.defaultTipRate;
  }

  await setDoc(userSettingsRef, payload, { merge: true });
}
