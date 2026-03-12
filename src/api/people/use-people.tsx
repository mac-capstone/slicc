import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { createQuery } from 'react-query-kit';

import { type ExpenseIdT, type ExpensePerson, type UserIdT } from '@/types';
import { expenseItemConverter, expensePersonConverter } from '@/types/schema';

import { db } from '../common/firebase';

export const usePeopleIdsForItem = createQuery<
  UserIdT[],
  { expenseId: ExpenseIdT; itemId: string },
  Error
>({
  queryKey: ['people', 'expenseId', 'itemId'],
  fetcher: async ({ expenseId, itemId }) => {
    const itemRef = doc(db, 'expenses', expenseId, 'items', itemId);
    const itemSnap = await getDoc(itemRef.withConverter(expenseItemConverter));

    if (!itemSnap.exists()) return [];

    return itemSnap.data().assignedPersonIds as UserIdT[];
  },
});

export const usePeopleIds = createQuery<UserIdT[], ExpenseIdT, Error>({
  queryKey: ['people', 'expenseId'],
  fetcher: async (expenseId) => {
    const peopleRef = collection(
      db,
      'expenses',
      expenseId,
      'people'
    ).withConverter(expensePersonConverter);
    const snapshot = await getDocs(peopleRef);
    return snapshot.docs.map((d) => d.id as UserIdT);
  },
});

export const usePerson = createQuery<
  ExpensePerson & { id: UserIdT },
  { expenseId: ExpenseIdT; personId: UserIdT },
  Error
>({
  queryKey: ['people', 'expenseId', 'personId'],
  fetcher: async ({ expenseId, personId }) => {
    const personRef = doc(
      db,
      'expenses',
      expenseId,
      'people',
      personId
    ).withConverter(expensePersonConverter);
    const personSnap = await getDoc(personRef);

    if (!personSnap.exists()) {
      throw new Error('Person not found');
    }

    return { id: personId, ...personSnap.data() };
  },
});
