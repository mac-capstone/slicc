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

function makeExpense(
  partial: Partial<ExpenseResponse> & { id: ExpenseIdT }
): ExpenseResponse {
  return {
    name: 'Test',
    date: '2026-04-01',
    createdBy: 'payer-1' as UserIdT,
    totalAmount: 100,
    remainingAmount: 0,
    participantCount: 2,
    items: [],
    people: [],
    ...partial,
  };
}

function wrapperForTest() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryClientTestWrapper';
  return Wrapper;
}

describe('useBalances (data + business aggregation, §6.2 / §6.3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseExpenseIds.mockReturnValue({
      data: ['e1' as ExpenseIdT],
      isPending: false,
      isError: false,
    } as ReturnType<typeof useExpenseIds>);
  });

  it('returns zeros when userId is null', async () => {
    mockFetchExpense.mockResolvedValue(
      makeExpense({
        id: 'e1' as ExpenseIdT,
        people: [
          {
            id: 'u1' as UserIdT,
            subtotal: 10,
            paid: 0,
            name: 'A',
          },
        ],
      })
    );

    const { result } = renderHook(() => useBalances(null), {
      wrapper: wrapperForTest(),
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.youOwe).toBe(0);
    expect(result.current.owedToYou).toBe(0);
  });

  it('sums owedToYou for payer from other participants’ remaining balances', async () => {
    const payer = 'payer-1' as UserIdT;
    const guest = 'guest-1' as UserIdT;
    mockFetchExpense.mockResolvedValue(
      makeExpense({
        id: 'e1' as ExpenseIdT,
        createdBy: payer,
        payerUserId: payer,
        people: [
          { id: payer, subtotal: 0, paid: 0, name: 'P' },
          { id: guest, subtotal: 40, paid: 10, name: 'G' },
        ],
      })
    );

    const { result } = renderHook(() => useBalances(payer), {
      wrapper: wrapperForTest(),
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.owedToYou).toBe(30);
    expect(result.current.youOwe).toBe(0);
  });

  it('sums youOwe for non-payer participant from self remaining balance', async () => {
    const payer = 'payer-1' as UserIdT;
    const guest = 'guest-1' as UserIdT;
    mockFetchExpense.mockResolvedValue(
      makeExpense({
        id: 'e1' as ExpenseIdT,
        payerUserId: payer,
        people: [
          { id: payer, subtotal: 0, paid: 0 },
          { id: guest, subtotal: 25, paid: 5 },
        ],
      })
    );

    const { result } = renderHook(() => useBalances(guest), {
      wrapper: wrapperForTest(),
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.youOwe).toBe(20);
    expect(result.current.owedToYou).toBe(0);
  });
});
