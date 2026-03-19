import { collection, doc, getDocs } from 'firebase/firestore';
import { createQuery } from 'react-query-kit';

import { db } from '@/api/common/firebase';
import { getTempExpense } from '@/lib/store';
import { type ExpenseIdT, type ItemIdT, type ItemWithId } from '@/types';
import { expenseItemConverter } from '@/types/schema';

export const usePersonItems = createQuery<
  ItemWithId[],
  { expenseId: ExpenseIdT; personId: string },
  Error
>({
  queryKey: ['items', 'expenseId', 'personId'],
  fetcher: async ({ expenseId, personId }) => {
    if (expenseId === 'temp-expense') {
      const tempExpense = getTempExpense();
      if (!tempExpense) throw new Error('Temp expense not found');
      return tempExpense.items.filter((i) =>
        i.assignedPersonIds.includes(personId)
      );
    }

    const expenseRef = doc(db, 'expenses', expenseId);
    const itemsSnap = await getDocs(
      collection(expenseRef, 'items').withConverter(expenseItemConverter)
    );

    return itemsSnap.docs
      .map((d) => ({
        id: d.id as ItemIdT,
        ...d.data(),
      }))
      .filter((item) => item.assignedPersonIds.includes(personId));
  },
});
