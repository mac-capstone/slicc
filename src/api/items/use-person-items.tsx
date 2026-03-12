import { createQuery } from 'react-query-kit';

import { mapMockItemToItemWithId } from '@/lib';
import { mockData } from '@/lib/mock-data';
import { getTempExpense } from '@/lib/store';
import { type ExpenseIdT, type ItemWithId } from '@/types';

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
    const expense = mockData.expenses.find((e) => e.id === expenseId);
    if (!expense) throw new Error('Expense not found');
    // go into items, find every item.assignedPersonIds that includes the personId, and return the items
    return expense.items
      .filter((item) => item.doc.assignedPersonIds.includes(personId))
      .map(mapMockItemToItemWithId);
  },
});
