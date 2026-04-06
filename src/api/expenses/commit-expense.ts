import {
  collection,
  doc,
  serverTimestamp,
  type WriteBatch,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/api/common/firebase';
import {
  type EventIdT,
  type ExpenseWithId,
  type ItemWithId,
  type PersonWithId,
} from '@/types';

export type CommitExpenseInput = {
  expense: ExpenseWithId;
  eventId: EventIdT | undefined;
  people: PersonWithId[] | undefined;
  items: ItemWithId[] | undefined;
};

/**
 * Writes a new expense document and subcollections (same shape as expense confirm flow).
 */
export function applyExpenseCommitToBatch(
  batch: WriteBatch,
  input: CommitExpenseInput
): { expenseDocRef: ReturnType<typeof doc> } {
  const { expense, eventId, people, items } = input;
  const expenseDocRef = doc(collection(db, 'expenses'));

  batch.set(expenseDocRef, {
    name: expense.name,
    date: expense.date,
    createdBy: expense.createdBy,
    payerUserId: expense.payerUserId,
    ...(eventId ? { eventId } : {}),
    totalAmount: expense.totalAmount,
    remainingAmount: expense.remainingAmount ?? 0,
    participantCount: expense.participantCount ?? 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (people) {
    people.forEach((person) => {
      const personDocRef = doc(expenseDocRef, 'people', person.id);
      const isGuest = person.userRef === null;
      batch.set(personDocRef, {
        subtotal: person.subtotal,
        paid: person.paid ?? 0,
        ...(isGuest && person.name ? { guestName: person.name } : {}),
      });
    });
  }

  if (items) {
    items.forEach((item) => {
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
  }

  return { expenseDocRef };
}

export async function commitExpenseToFirestore(
  input: CommitExpenseInput
): Promise<string> {
  const batch = writeBatch(db);
  const { expenseDocRef } = applyExpenseCommitToBatch(batch, input);
  await batch.commit();
  return expenseDocRef.id;
}
