import type { ExpenseResponse } from '@/api/expenses/use-expenses';
import type { UserIdT } from '@/types';

import { buildDebtEdges, collectNodeIds } from './build-debt-edges';

const uid = (s: string): UserIdT => s as UserIdT;

function makeExpense(
  overrides: Partial<ExpenseResponse> &
    Pick<ExpenseResponse, 'id' | 'createdBy'>
): ExpenseResponse {
  return {
    name: 'Test',
    date: new Date().toISOString(),
    totalAmount: 0,
    people: [],
    items: [],
    ...overrides,
  };
}

describe('buildDebtEdges', () => {
  it('returns no edges when viewer is null', () => {
    const expenses: ExpenseResponse[] = [
      makeExpense({
        id: 'e1' as ExpenseResponse['id'],
        createdBy: 'payer',
        payerUserId: 'payer',
        people: [{ id: 'a', subtotal: 10, paid: 0 }],
      }),
    ];
    expect(buildDebtEdges(expenses, null)).toEqual([]);
  });

  it('aggregates same debtor-creditor pair across expenses', () => {
    const expenses: ExpenseResponse[] = [
      makeExpense({
        id: 'e1' as ExpenseResponse['id'],
        createdBy: 'payer',
        payerUserId: 'payer',
        people: [
          { id: 'a', subtotal: 10, paid: 0 },
          { id: 'payer', subtotal: 0, paid: 0 },
        ],
      }),
      makeExpense({
        id: 'e2' as ExpenseResponse['id'],
        createdBy: 'payer',
        payerUserId: 'payer',
        people: [
          { id: 'a', subtotal: 5, paid: 0 },
          { id: 'payer', subtotal: 0, paid: 0 },
        ],
      }),
    ];

    const edges = buildDebtEdges(expenses, uid('payer'));
    expect(edges).toEqual([{ from: 'a', to: 'payer', amount: 15 }]);
  });

  it('excludes expenses the viewer is not part of', () => {
    const expenses: ExpenseResponse[] = [
      makeExpense({
        id: 'e1' as ExpenseResponse['id'],
        createdBy: 'other',
        payerUserId: 'x',
        people: [
          { id: 'a', subtotal: 100, paid: 0 },
          { id: 'x', subtotal: 0, paid: 0 },
        ],
      }),
    ];

    expect(buildDebtEdges(expenses, uid('viewer'))).toEqual([]);
  });

  it('includes expense when viewer is a participant', () => {
    const expenses: ExpenseResponse[] = [
      makeExpense({
        id: 'e1' as ExpenseResponse['id'],
        createdBy: 'other',
        payerUserId: 'x',
        people: [
          { id: 'viewer', subtotal: 20, paid: 0 },
          { id: 'x', subtotal: 0, paid: 0 },
        ],
      }),
    ];

    const edges = buildDebtEdges(expenses, uid('viewer'));
    expect(edges).toContainEqual({ from: 'viewer', to: 'x', amount: 20 });
  });

  it('skips zero remaining balance', () => {
    const expenses: ExpenseResponse[] = [
      makeExpense({
        id: 'e1' as ExpenseResponse['id'],
        createdBy: 'p',
        payerUserId: 'p',
        people: [
          { id: 'a', subtotal: 10, paid: 10 },
          { id: 'p', subtotal: 0, paid: 0 },
        ],
      }),
    ];

    expect(buildDebtEdges(expenses, uid('p'))).toEqual([]);
  });

  it('uses createdBy when payerUserId missing', () => {
    const expenses: ExpenseResponse[] = [
      makeExpense({
        id: 'e1' as ExpenseResponse['id'],
        createdBy: 'creditor',
        people: [{ id: 'debtor', subtotal: 7, paid: 0 }],
      }),
    ];

    expect(buildDebtEdges(expenses, uid('creditor'))).toEqual([
      { from: 'debtor', to: 'creditor', amount: 7 },
    ]);
  });
});

describe('collectNodeIds', () => {
  it('returns sorted unique ids', () => {
    expect(
      collectNodeIds([
        { from: 'z' as never, to: 'a' as never, amount: 1 },
        { from: 'a' as never, to: 'b' as never, amount: 2 },
      ])
    ).toEqual(['a', 'b', 'z']);
  });
});
