import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { createQuery } from 'react-query-kit';

import { getTempExpense } from '@/lib/store';
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
    if (expenseId === 'temp-expense') {
      const tempExpense = getTempExpense();
      if (!tempExpense) return [];
      const item = tempExpense.items.find((i) => i.id === itemId);
      return (item?.assignedPersonIds ?? []) as UserIdT[];
    }

    const itemRef = doc(db, 'expenses', expenseId, 'items', itemId);
    const itemSnap = await getDoc(itemRef.withConverter(expenseItemConverter));

    if (!itemSnap.exists()) return [];

    return itemSnap.data().assignedPersonIds as UserIdT[];
  },
});

export const usePeopleIds = createQuery<UserIdT[], ExpenseIdT, Error>({
  queryKey: ['people', 'expenseId'],
  fetcher: async (expenseId) => {
    if (expenseId === 'temp-expense') {
      const tempExpense = getTempExpense();
      if (!tempExpense) return [];
      return tempExpense.people.map((p) => p.id as UserIdT);
    }

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
    if (expenseId === 'temp-expense') {
      const tempExpense = getTempExpense();
      if (!tempExpense) throw new Error('Person not found');
      const person = tempExpense.people.find((p) => p.id === personId);
      if (!person) throw new Error('Person not found');
      const isGuest = person.userRef === null;
      return {
        id: personId,
        subtotal: person.subtotal,
        paid: person.paid,
        guestName: isGuest ? (person.name ?? undefined) : undefined,
      };
    }

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
