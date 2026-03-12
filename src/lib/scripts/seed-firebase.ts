import * as admin from 'firebase-admin';

import serviceAccount from '../../../service-account-key.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

const db = admin.firestore();
const now = admin.firestore.Timestamp.now();

// ── Users ──────────────────────────────────────────────────────────────────

const mockUsers = [
  {
    id: 'user_ankush',
    username: 'ankush',
    displayName: 'Ankush Zhang',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'user_michael',
    username: 'michael',
    displayName: 'Michael Zhang',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'user_sarah',
    username: 'sarah',
    displayName: 'Sarah Zhang',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'user_jane',
    username: 'jane',
    displayName: 'Jane Zhang',
    createdAt: now,
    updatedAt: now,
  },
];

// ── Events ─────────────────────────────────────────────────────────────────

const mockEvents = [
  {
    id: 'event_birthday',
    name: 'Birthday Party',
    createdBy: 'user_ankush',
    description: 'Annual birthday celebration',
    details: 'Celebrate with cake, games, and great company!',
    startDate: admin.firestore.Timestamp.fromDate(new Date('2026-03-15')),
    endDate: admin.firestore.Timestamp.fromDate(new Date('2026-03-15')),
    startTime: '18:00',
    endTime: '22:00',
    isRecurring: true,
    recurringInterval: 1,
    recurringUnit: 'year' as const,
    recurringEndDate: '2030-03-15',
    location: 'Boston Pizza',
    locationUrl: 'https://maps.google.com/?q=Boston+Pizza',
    groupId: 'group_friends',
    participants: ['user_ankush', 'user_michael', 'user_sarah'],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'event_hotpot',
    name: 'Hotpot Night',
    createdBy: 'user_michael',
    description: 'All-you-can-eat hotpot at Hai Di Lao',
    details:
      'Meet at the restaurant. We have a reservation for 4 under Michael.',
    startDate: admin.firestore.Timestamp.fromDate(new Date('2026-03-20')),
    endDate: admin.firestore.Timestamp.fromDate(new Date('2026-03-20')),
    startTime: '19:00',
    endTime: '21:30',
    isRecurring: false,
    location: 'Hai Di Lao',
    locationUrl: 'https://maps.google.com/?q=Hai+Di+Lao',
    groupId: 'group_friends',
    participants: ['user_ankush', 'user_michael', 'user_sarah', 'user_jane'],
    createdAt: now,
    updatedAt: now,
  },
];

// ── Groups ─────────────────────────────────────────────────────────────────

const mockGroups = [
  {
    id: 'group_friends',
    name: 'The Crew',
    description: 'Our main friend group',
    owner: 'user_ankush',
    admins: ['user_ankush', 'user_michael'],
    members: ['user_ankush', 'user_michael', 'user_sarah', 'user_jane'],
    events: ['event_birthday', 'event_hotpot'],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'group_roommates',
    name: 'Roommates',
    description: 'Shared house expenses',
    owner: 'user_sarah',
    admins: ['user_sarah'],
    members: ['user_sarah', 'user_ankush', 'user_jane'],
    events: [],
    createdAt: now,
    updatedAt: now,
  },
];

// ── Expenses (with people + items subcollections) ──────────────────────────

const mockExpenses = [
  {
    id: 'exp_boston_pizza',
    doc: {
      name: 'Boston Pizza',
      date: admin.firestore.Timestamp.fromDate(new Date('2026-03-15')),
      createdBy: 'user_ankush',
      eventId: 'event_birthday',
      totalAmount: 64.23,
      createdAt: now,
      updatedAt: now,
    },
    people: [
      { id: 'user_ankush', subtotal: 22.04 },
      { id: 'user_michael', subtotal: 20.15 },
      { id: 'user_sarah', subtotal: 22.04 },
    ],
    items: [
      {
        id: 'item_pizza',
        name: 'Pepperoni Pizza',
        price: 30.0,
        tax: 3.9,
        owed: { user_ankush: 11.3, user_michael: 11.3, user_sarah: 11.3 },
        peopleAssigned: ['user_ankush', 'user_michael', 'user_sarah'],
      },
      {
        id: 'item_cactus_cuts',
        name: 'Cactus Cuts',
        price: 13.5,
        tax: 1.76,
        owed: { user_ankush: 7.63, user_michael: 7.63 },
        peopleAssigned: ['user_ankush', 'user_michael'],
      },
      {
        id: 'item_drinks',
        name: 'Drinks',
        price: 15.07,
        tax: 0.0,
        owed: { user_ankush: 3.02, user_michael: 4.53, user_sarah: 7.52 },
        peopleAssigned: ['user_ankush', 'user_michael', 'user_sarah'],
      },
    ],
  },
  {
    id: 'exp_hai_di_lao',
    doc: {
      name: 'Hai Di Lao',
      date: admin.firestore.Timestamp.fromDate(new Date('2026-03-20')),
      createdBy: 'user_michael',
      eventId: 'event_hotpot',
      totalAmount: 250.1,
      createdAt: now,
      updatedAt: now,
    },
    people: [
      { id: 'user_ankush', subtotal: 69.35 },
      { id: 'user_michael', subtotal: 63.25 },
      { id: 'user_sarah', subtotal: 58.75 },
      { id: 'user_jane', subtotal: 58.75 },
    ],
    items: [
      {
        id: 'item_broth',
        name: 'Tomato & Mushroom Broth',
        price: 25.0,
        tax: 3.25,
        owed: {
          user_ankush: 7.06,
          user_michael: 7.06,
          user_sarah: 7.06,
          user_jane: 7.07,
        },
        peopleAssigned: [
          'user_ankush',
          'user_michael',
          'user_sarah',
          'user_jane',
        ],
      },
      {
        id: 'item_meats',
        name: 'Assorted Meats',
        price: 95.1,
        tax: 12.36,
        owed: {
          user_ankush: 28.37,
          user_michael: 28.37,
          user_sarah: 25.36,
          user_jane: 25.36,
        },
        peopleAssigned: [
          'user_ankush',
          'user_michael',
          'user_sarah',
          'user_jane',
        ],
      },
      {
        id: 'item_veggies',
        name: 'Vegetables',
        price: 40.0,
        tax: 5.2,
        owed: {
          user_ankush: 11.3,
          user_michael: 11.3,
          user_sarah: 11.3,
          user_jane: 11.3,
        },
        peopleAssigned: [
          'user_ankush',
          'user_michael',
          'user_sarah',
          'user_jane',
        ],
      },
      {
        id: 'item_noodles',
        name: 'Dancing Noodles',
        price: 55.0,
        tax: 7.15,
        owed: {
          user_ankush: 22.62,
          user_michael: 16.52,
          user_sarah: 15.03,
          user_jane: 15.03,
        },
        peopleAssigned: [
          'user_ankush',
          'user_michael',
          'user_sarah',
          'user_jane',
        ],
      },
    ],
  },
];

// ── Notifications ──────────────────────────────────────────────────────────

const mockNotifications = [
  {
    id: 'notif_group_invite_sarah',
    type: 'groupInvite' as const,
    senderId: 'user_ankush',
    receiverId: 'user_sarah',
    isRead: false,
    createdAt: now,
  },
  {
    id: 'notif_event_invite_jane',
    type: 'eventInvite' as const,
    senderId: 'user_ankush',
    receiverId: 'user_jane',
    isRead: false,
    createdAt: now,
  },
  {
    id: 'notif_reminder_michael',
    type: 'reminder' as const,
    senderId: 'user_ankush',
    receiverId: 'user_michael',
    isRead: true,
    createdAt: admin.firestore.Timestamp.fromDate(new Date('2026-03-01')),
    readAt: admin.firestore.Timestamp.fromDate(new Date('2026-03-02')),
  },
  {
    id: 'notif_event_coming_up',
    type: 'eventComingUp' as const,
    senderId: 'user_ankush',
    receiverId: 'user_michael',
    isRead: false,
    createdAt: now,
  },
];

// ── Seed function ──────────────────────────────────────────────────────────

async function deleteCollection(path: string): Promise<void> {
  const collRef = db.collection(path);
  const snapshot = await collRef.get();
  if (snapshot.empty) return;

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

async function seed(): Promise<void> {
  console.log('Clearing existing data...');
  await Promise.all([
    deleteCollection('users'),
    deleteCollection('groups'),
    deleteCollection('events'),
    deleteCollection('notifications'),
  ]);
  const expensesSnap = await db.collection('expenses').get();
  for (const expDoc of expensesSnap.docs) {
    await deleteCollection(`expenses/${expDoc.id}/people`);
    await deleteCollection(`expenses/${expDoc.id}/items`);
    await expDoc.ref.delete();
  }

  // Users
  const userBatch = db.batch();
  for (const { id, ...data } of mockUsers) {
    userBatch.set(db.collection('users').doc(id), data);
  }
  await userBatch.commit();
  console.log(`Seeded ${mockUsers.length} users`);

  // Groups
  const groupBatch = db.batch();
  for (const { id, ...data } of mockGroups) {
    groupBatch.set(db.collection('groups').doc(id), data);
  }
  await groupBatch.commit();
  console.log(`Seeded ${mockGroups.length} groups`);

  // Events
  const eventBatch = db.batch();
  for (const { id, ...data } of mockEvents) {
    eventBatch.set(db.collection('events').doc(id), data);
  }
  await eventBatch.commit();
  console.log(`Seeded ${mockEvents.length} events`);

  // Expenses + subcollections
  for (const expense of mockExpenses) {
    await db.collection('expenses').doc(expense.id).set(expense.doc);

    for (const person of expense.people) {
      const { id, ...personData } = person;
      await db
        .collection('expenses')
        .doc(expense.id)
        .collection('people')
        .doc(id)
        .set(personData);
    }

    for (const item of expense.items) {
      const { id, ...itemData } = item;
      await db
        .collection('expenses')
        .doc(expense.id)
        .collection('items')
        .doc(id)
        .set(itemData);
    }
  }
  console.log(`Seeded ${mockExpenses.length} expenses with subcollections`);

  // Notifications
  const notifBatch = db.batch();
  for (const { id, ...data } of mockNotifications) {
    notifBatch.set(db.collection('notifications').doc(id), data);
  }
  await notifBatch.commit();
  console.log(`Seeded ${mockNotifications.length} notifications`);

  console.log('Done!');
}

seed().catch(console.error);
