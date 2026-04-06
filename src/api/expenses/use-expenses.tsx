import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
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

export type ExpenseResponse = Expense & {
  id: ExpenseIdT;
  items: ItemWithId[];
  people: PersonWithId[];
};

const expensesRef = collection(db, 'expenses').withConverter(expenseConverter);

export async function fetchExpense(
  expenseId: ExpenseIdT
): Promise<ExpenseResponse> {
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
}

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
  fetcher: fetchExpense,
});

// ── Mutations ────────────────────────────────────────────────────────────────

type CreateExpenseVariables = {
  name: string;
  date: string | Date;
  createdBy: string;
  payerUserId?: string;
  eventId?: string;
  totalAmount: number;
  remainingAmount: number;
  people: PersonWithId[];
  items: ItemWithId[];
};

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation<{ expenseId: string }, Error, CreateExpenseVariables>({
    mutationFn: async (variables) => {
      const batch = writeBatch(db);
      const expenseDocRef = doc(collection(db, 'expenses'));

      const activePeople = variables.people.filter((p) => p.subtotal > 0);

      batch.set(expenseDocRef, {
        name: variables.name,
        date: variables.date,
        createdBy: variables.createdBy,
        ...(variables.payerUserId
          ? { payerUserId: variables.payerUserId }
          : {}),
        ...(variables.eventId ? { eventId: variables.eventId } : {}),
        totalAmount: variables.totalAmount,
        remainingAmount: variables.remainingAmount ?? 0,
        participantCount: activePeople.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      activePeople.forEach((person) => {
        const personDocRef = doc(expenseDocRef, 'people', person.id);
        const isGuest = person.userRef === null;
        batch.set(personDocRef, {
          subtotal: person.subtotal,
          paid: person.paid ?? 0,
          ...(isGuest && person.name ? { guestName: person.name } : {}),
        });
      });

      variables.items.forEach((item) => {
        const itemDocRef = doc(expenseDocRef, 'items', item.id);
        batch.set(itemDocRef, {
          name: item.name,
          amount: item.amount,
          taxRate: item.taxRate ?? 0,
          split: item.split,
          assignedPersonIds: item.assignedPersonIds,
          isTip: item.isTip ?? false,
        });
      });

      await batch.commit();
      return { expenseId: expenseDocRef.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['expenses'],
        refetchType: 'all',
      });
    },
  });
}

type UpdateExpenseVariables = {
  originalExpenseId: string;
  originalItemIds: ItemIdT[];
  originalPersonIds: string[];
  name: string;
  totalAmount: number;
  remainingAmount: number;
  people: PersonWithId[];
  items: ItemWithId[];
};

export function useUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation<{ expenseId: string }, Error, UpdateExpenseVariables>({
    mutationFn: async (variables) => {
      const origId = variables.originalExpenseId;
      const batch = writeBatch(db);
      const expenseDocRef = doc(db, 'expenses', origId);

      // Delete old subcollection docs so stale items/people don't linger
      variables.originalItemIds.forEach((itemId) => {
        batch.delete(doc(db, 'expenses', origId, 'items', itemId));
      });
      variables.originalPersonIds.forEach((personId) => {
        batch.delete(doc(db, 'expenses', origId, 'people', personId));
      });

      // Write updated people (skip anyone with subtotal 0)
      const activePeople = variables.people.filter((p) => p.subtotal > 0);
      activePeople.forEach((person) => {
        const personDocRef = doc(db, 'expenses', origId, 'people', person.id);
        const isGuest = person.userRef === null;
        batch.set(personDocRef, {
          subtotal: person.subtotal,
          paid: person.paid ?? 0,
          ...(isGuest && person.name ? { guestName: person.name } : {}),
        });
      });

      // Update the expense document
      batch.update(expenseDocRef, {
        name: variables.name,
        totalAmount: variables.totalAmount,
        remainingAmount: variables.remainingAmount ?? 0,
        participantCount: activePeople.length,
        updatedAt: serverTimestamp(),
      });

      // Write updated items
      variables.items.forEach((item) => {
        const itemDocRef = doc(db, 'expenses', origId, 'items', item.id);
        batch.set(itemDocRef, {
          name: item.name,
          amount: item.amount,
          taxRate: item.taxRate ?? 0,
          split: item.split,
          assignedPersonIds: item.assignedPersonIds,
          isTip: item.isTip ?? false,
        });
      });

      await batch.commit();
      return { expenseId: origId };
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['expenses'] });
      queryClient.removeQueries({ queryKey: ['items'] });
      queryClient.removeQueries({ queryKey: ['people'] });
    },
  });
}
