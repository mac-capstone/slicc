import { createQuery } from 'react-query-kit';

import { mockData } from '@/lib/mock-data';
import { getTempExpense } from '@/lib/store';
import {
  type EventIdT,
  type Expense,
  type ExpenseIdT,
  type ItemWithId,
  type PersonWithId,
} from '@/types';

type AllExpensesResponse = ExpenseIdT[];
type AllExpensesVariables = void;
export const useExpenseIds = createQuery<
  AllExpensesResponse,
  AllExpensesVariables,
  Error
>({
  queryKey: ['expenses'],
  fetcher: () => {
    return mockData.expenses.map((e) => e.id as ExpenseIdT);
  },
});

type ExpenseIdsByEventResponse = ExpenseIdT[];
type ExpenseIdsByEventVariables = EventIdT;

export const useExpenseIdsByEvent = createQuery<
  ExpenseIdsByEventResponse,
  ExpenseIdsByEventVariables,
  Error
>({
  queryKey: ['expenses', 'eventId'],
  fetcher: async (_eventId) => {
    // TODO: Filter expenses by eventId once the Expense model includes an eventId field
    // For now, returning all expenses as a placeholder
    return mockData.expenses.map((e) => e.id as ExpenseIdT);
  },
});

type ExpenseResponse = Expense & {
  id?: ExpenseIdT;
  items?: ItemWithId[];
  people?: PersonWithId[];
};
export const useExpense = createQuery<ExpenseResponse, ExpenseIdT, Error>({
  queryKey: ['expenses', 'expenseId'],
  fetcher: async (expenseId) => {
    if (expenseId === 'temp-expense') {
      const tempExpense = getTempExpense();
      if (!tempExpense) throw new Error('Temp expense not found');
      return tempExpense as ExpenseResponse;
    }
    const expense = mockData.expenses.find((e) => e.id === expenseId);
    if (!expense) throw new Error('Expense not found');
    return expense.doc as Expense;
  },
});
