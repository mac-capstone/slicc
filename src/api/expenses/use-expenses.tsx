import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { createQuery } from 'react-query-kit';

import { getTempExpense } from '@/lib/store';
import {
  type EventIdT,
  type Expense,
  type ExpenseIdT,
  type ItemIdT,
  type ItemWithId,
  type PersonWithId,
} from '@/types';
import {
  expenseConverter,
  expenseItemConverter,
  expensePersonConverter,
} from '@/types/schema';

import { db } from '../common/firebase';

type ExpenseResponse = Expense & {
  id: ExpenseIdT;
  items: ItemWithId[];
  people: PersonWithId[];
};

const expensesRef = collection(db, 'expenses').withConverter(expenseConverter);

export const useExpenseIds = createQuery<ExpenseIdT[], void, Error>({
  queryKey: ['expenses'],
  fetcher: async () => {
    const snapshot = await getDocs(expensesRef);
    console.log(
      'Fetched expense IDs:',
      snapshot.docs.map((d) => d.id)
    );
    return snapshot.docs.map((d) => d.id as ExpenseIdT);
  },
});

export const useExpenseIdsByEvent = createQuery<ExpenseIdT[], EventIdT, Error>({
  queryKey: ['expenses', 'eventIds'],
  fetcher: async (eventId) => {
    if (!eventId) return [];
    const snapshot = await getDocs(
      query(expensesRef, where('eventId', '==', eventId))
    );
    return snapshot.docs.map((d) => d.id as ExpenseIdT);
  },
});

export const useExpense = createQuery<ExpenseResponse, ExpenseIdT, Error>({
  queryKey: ['expenses', 'expenseId'],
  fetcher: async (expenseId) => {
    if (expenseId === 'temp-expense') {
      const tempExpense = getTempExpense();
      if (!tempExpense) throw new Error('Temp expense not found');
      return tempExpense;
    }

    const expenseRef = doc(expensesRef, expenseId);
    const expenseSnap = await getDoc(expenseRef);

    if (!expenseSnap.exists()) {
      throw new Error(`Expense ${expenseId} not found`);
    }

    const expense = expenseSnap.data();

    const [peopleSnap, itemsSnap] = await Promise.all([
      getDocs(
        collection(expenseRef, 'people').withConverter(expensePersonConverter)
      ),
      getDocs(
        collection(expenseRef, 'items').withConverter(expenseItemConverter)
      ),
    ]);

    const people: PersonWithId[] = peopleSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    const items: ItemWithId[] = itemsSnap.docs.map((d) => ({
      id: d.id as ItemIdT,
      ...d.data(),
    }));

    return { id: expenseId, ...expense, people, items };
  },
});
