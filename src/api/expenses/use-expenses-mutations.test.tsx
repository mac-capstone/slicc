/**
 * V&V §6.3.1 — successful mutations invalidate dependent queries so lists do not stay stale.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import { useCreateExpense } from '@/api/expenses/use-expenses';
import { type ItemIdT, type ItemWithId, type UserIdT } from '@/types';

jest.mock('@/api/common/firebase', () => ({
  db: {},
}));

const mockBatch = {
  set: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  commit: jest.fn().mockResolvedValue(undefined),
};

jest.mock('firebase/firestore', () => ({
  writeBatch: jest.fn(() => mockBatch),
  collection: jest.fn(() => ({
    path: 'expenses',
    withConverter: jest.fn(() => ({})),
  })),
  doc: jest.fn((...args: unknown[]) => {
    if (args.length === 1) {
      return { id: 'new_expense_id', path: 'expenses/new_expense_id' };
    }
    const last = args[args.length - 1];
    return { id: String(last), path: `nested/${String(last)}` };
  }),
  serverTimestamp: jest.fn(() => ({})),
}));

function wrapperWithClient(client: QueryClient) {
  const W = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  W.displayName = 'MutationTestWrapper';
  return W;
}

describe('useCreateExpense (§6.3.1 cache invalidation)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBatch.commit.mockResolvedValue(undefined);
  });

  it('invalidates the expenses query key after a successful create', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    const uid = 'creator-1' as UserIdT;
    const item: ItemWithId = {
      id: 'it1' as ItemIdT,
      name: 'Item',
      amount: 10,
      taxRate: 0,
      split: { mode: 'equal', shares: { [uid]: 1 } },
      assignedPersonIds: [uid],
    };

    const { result } = renderHook(() => useCreateExpense(), {
      wrapper: wrapperWithClient(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        name: 'Dinner',
        date: '2026-04-01',
        createdBy: uid,
        totalAmount: 10,
        remainingAmount: 0,
        people: [
          {
            id: uid,
            subtotal: 10,
            paid: 0,
            userRef: uid,
          },
        ],
        items: [item],
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['expenses'],
        refetchType: 'all',
      });
    });

    client.clear();
  });
});
