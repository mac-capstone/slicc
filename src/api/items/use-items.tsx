import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { createQuery } from 'react-query-kit';

import { db } from '@/api/common/firebase';
import { getTempExpense } from '@/lib/store';
import { type ExpenseIdT, type ItemIdT, type ItemWithId } from '@/types';
import { expenseItemConverter } from '@/types/schema';

export const useItems = createQuery<ItemWithId[], ExpenseIdT, Error>({
  queryKey: ['items', 'expenseId'],
  fetcher: async (expenseId) => {
    if (expenseId === 'temp-expense') {
      const tempExpense = getTempExpense();
      if (!tempExpense) throw new Error('Temp expense not found');
      return tempExpense.items;
    }

    const expenseRef = doc(db, 'expenses', expenseId);
    const itemsSnap = await getDocs(
      collection(expenseRef, 'items').withConverter(expenseItemConverter)
    );

    return itemsSnap.docs.map((d) => ({
      id: d.id as ItemIdT,
      ...d.data(),
    }));
  },
});

export const useItem = createQuery<
  ItemWithId,
  { expenseId: ExpenseIdT; itemId: ItemIdT },
  Error
>({
  queryKey: ['items', 'expenseId', 'itemId'],
  fetcher: async ({ expenseId, itemId }) => {
    if (expenseId === 'temp-expense') {
      const tempExpense = getTempExpense();
      if (!tempExpense) throw new Error('Temp expense not found');
      const item = tempExpense.items.find((i) => i.id === itemId);
      if (!item) throw new Error('Item not found');
      return item;
    }

    const itemRef = doc(
      db,
      'expenses',
      expenseId,
      'items',
      itemId
    ).withConverter(expenseItemConverter);
    const itemSnap = await getDoc(itemRef);

    if (!itemSnap.exists()) {
      throw new Error('Item not found');
    }

    return {
      id: itemSnap.id as ItemIdT,
      ...itemSnap.data(),
    };
  },
});
