import { Env } from '@env';
// import firebaseApp from '@react-native-firebase/app'; // Deprecated - using modular Web SDK instead
import { getApps, initializeApp } from 'firebase/app';
import {
  // connectAuthEmulator,
  getAuth,
  // @ts-ignore: getReactNativePersistence exists in the RN bundle
  // but is often missing from public TypeScript definitions.
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
// import { connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
// import { connectFunctionsEmulator } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

// import { connectStorageEmulator } from 'firebase/storage';
// import * as Device from 'expo-device';
// import { Platform } from 'react-native';
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

// Check if Firestore is already initialized by attempting to get it first
let dbInstance: ReturnType<typeof getFirestore>;

const isAlreadyInitializedError = (error: unknown) => {
  const msg = String((error as { message?: string })?.message ?? '');
  const code = String((error as { code?: string })?.code ?? '');
  return (
    /already.*initialized|already.*been|already.*started/i.test(msg) ||
    code === 'failed-precondition' ||
    code === 'auth/already-initialized'
  );
};
try {
  dbInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch (_error) {
  if (!isAlreadyInitializedError(_error)) throw _error;
  dbInstance = getFirestore(app);
}
export const db = dbInstance;

// Initialize Auth with defensive pattern to prevent reinitialization errors
let authInstance: ReturnType<typeof getAuth>;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(reactNativeAsyncStorage),
  });
} catch (_error) {
  if (!isAlreadyInitializedError(_error)) throw _error;
  authInstance = getAuth(app);
}
export const auth = authInstance;

// Lazy initialize functions to avoid errors if Functions is not enabled in Firebase project
let functionsInstance: ReturnType<typeof getFunctions> | null = null;
export const getFunctionsInstance = () => {
  if (!functionsInstance) {
    try {
      functionsInstance = getFunctions(app);
    } catch (_error) {
      console.warn('Firebase Functions not available:', _error);
      return null;
    }
  }
  return functionsInstance;
};

// For backward compatibility, provide a functions export
export const functions = getFunctionsInstance();

export const storage = getStorage(app);

// Emulator connection code (commented out - always connect to production)
// Uncomment below to enable emulator connections in development
// 10.0.2.2 is a special IP address to connect to the 'localhost' of the host computer from an Android emulator
// const emulatorHost = Platform.OS === 'ios' ? '127.0.0.1' : '10.0.2.2';
// const realDeviceHost = '192.168.0.117';
// const FIRESTORE_PORT = 8080;
// const FUNCTIONS_PORT = 5001;
// const AUTH_PORT = 9099;
// const STORAGE_PORT = 9199;

// export const isRealDevice = Device.isDevice;

// if (__DEV__) {
//   if (isRealDevice) {
//     console.log('Connecting to real device');
//     connectFirestoreEmulator(db, realDeviceHost, FIRESTORE_PORT);
//     connectFunctionsEmulator(functions, realDeviceHost, FUNCTIONS_PORT);
//     connectAuthEmulator(auth, `http://${realDeviceHost}:${AUTH_PORT}`);
//     connectStorageEmulator(storage, realDeviceHost, STORAGE_PORT);

//     // register for push tokens
//     // registerForPushTokens().then((token) => {
//     //   console.log('token', token);
//     // });
//   } else {
//     console.log('Connecting to emulator');
//     connectFirestoreEmulator(db, emulatorHost, FIRESTORE_PORT);
//     connectFunctionsEmulator(functions, emulatorHost, FUNCTIONS_PORT);
//     connectAuthEmulator(auth, `http://${emulatorHost}:${AUTH_PORT}`);
//     connectStorageEmulator(storage, emulatorHost, STORAGE_PORT);
//   }
// }
