import { Env } from '@env';
import { getReactNativePersistence, initializeAuth } from '@firebase/auth';
import { getApps, initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

import { reactNativeAsyncStorage } from '@/lib/storage';

const firebaseConfig = {
  apiKey: Env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: Env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: Env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: Env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: Env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: Env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
// Initialize Firebase using modular Web SDK
// Only initialize if no apps exist to prevent duplicate initialization
export const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);

export const functions = getFunctions(app);

export const storage = getStorage(app);

export const rtdb = getDatabase(app);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(reactNativeAsyncStorage),
});
