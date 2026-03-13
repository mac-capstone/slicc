import * as admin from 'firebase-admin';

import serviceAccount from '../../../service-account-key.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

const db = admin.firestore();

const TOP_LEVEL_COLLECTIONS = [
  'users',
  'groups',
  'events',
  'notifications',
  'expenses',
];

const EXPENSE_SUBCOLLECTIONS = ['people', 'items'];

async function deleteCollection(path: string): Promise<number> {
  const collRef = db.collection(path);
  const snapshot = await collRef.get();
  if (snapshot.empty) return 0;

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snapshot.size;
}

async function cleanFirestore(): Promise<void> {
  console.log('Deleting all Firestore data...\n');

  for (const name of TOP_LEVEL_COLLECTIONS) {
    if (name === 'expenses') {
      const expensesSnap = await db.collection('expenses').get();
      let subDeleted = 0;

      for (const expDoc of expensesSnap.docs) {
        for (const sub of EXPENSE_SUBCOLLECTIONS) {
          subDeleted += await deleteCollection(`expenses/${expDoc.id}/${sub}`);
        }
        await expDoc.ref.delete();
      }

      console.log(
        `  expenses: deleted ${expensesSnap.size} docs + ${subDeleted} subcollection docs`
      );
      continue;
    }

    const count = await deleteCollection(name);
    console.log(`  ${name}: deleted ${count} docs`);
  }

  console.log('\nDone — Firestore is empty.');
}

cleanFirestore().catch(console.error);
