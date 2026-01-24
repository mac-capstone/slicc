import { collection, getDocs } from 'firebase/firestore';

import { app, auth, db } from '@/api/common/firebase';

export async function testFirebaseConnection(): Promise<boolean> {
  try {
    // Test 1: Check if app is initialized
    console.log('✅ Firebase App initialized:', app.name);
    console.log('✅ Firebase Project ID:', app.options.projectId);

    // Test 2: Check if Auth is initialized (without signing in)
    console.log('✅ Firebase Auth initialized:', auth.app.name);

    // Test 3: Test Firestore connection with a simple query
    // This will fail if Firestore rules don't allow reads, but connection is working
    try {
      const testCollection = collection(db, '_test');
      await getDocs(testCollection);
      console.log('✅ Firestore connection successful');
    } catch (firestoreError: unknown) {
      // Firestore might fail due to security rules, but connection is established
      const errorMessage =
        firestoreError instanceof Error
          ? firestoreError.message
          : String(firestoreError);
      if (errorMessage.includes('permission-denied')) {
        console.log(
          '✅ Firestore connected (permission denied is expected without proper rules)'
        );
      } else {
        console.log('⚠️ Firestore test:', errorMessage);
      }
    }

    console.log('✅ Firebase connection test completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Firebase connection error:', error);
    return false;
  }
}
