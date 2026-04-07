import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import { useBalances } from '@/api/expenses/use-balances';
import {
  type ExpenseResponse,
  fetchExpense,
  useExpenseIds,
} from '@/api/expenses/use-expenses';
import { type ExpenseIdT, type UserIdT } from '@/types';

jest.mock('@/api/expenses/use-expenses', () => ({
  useExpenseIds: jest.fn(),
  fetchExpense: jest.fn(),
}));

const mockUseExpenseIds = useExpenseIds as jest.MockedFunction<
  typeof useExpenseIds
>;
const mockFetchExpense = fetchExpense as jest.MockedFunction<
  typeof fetchExpense
>;

/**
 * V&V §6.3.2 — data-layer responsiveness: mocked “API” work stays under budget.
 */
describe('V&V data-layer performance (§6.3.2)', () => {
  function wrapper() {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const W = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    W.displayName = 'QCWrap';
    return W;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseExpenseIds.mockReturnValue({
      data: Array.from({ length: 12 }, (_, i) => `e${i}` as ExpenseIdT),
      isPending: false,
      isError: false,
    } as ReturnType<typeof useExpenseIds>);
  });

  it('resolves balance aggregation under 500ms when each fetch is fast', async () => {
    mockFetchExpense.mockImplementation(async (id: ExpenseIdT) => {
      await new Promise((r) => setTimeout(r, 5));
      return {
        id,
        name: 'X',
        date: '2026-01-01',
        createdBy: 'payer' as UserIdT,
        payerUserId: 'payer' as UserIdT,
        totalAmount: 10,
        items: [],
        people: [
          { id: 'payer' as UserIdT, subtotal: 0, paid: 0 },
          { id: 'guest' as UserIdT, subtotal: 5, paid: 0 },
        ],
      } satisfies ExpenseResponse;
    });

    const t0 = global.performance.now();
    const { result } = renderHook(() => useBalances('payer' as UserIdT), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(global.performance.now() - t0).toBeLessThan(500);
  });
});
