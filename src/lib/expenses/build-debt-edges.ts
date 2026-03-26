import type { ExpenseResponse } from '@/api/expenses/use-expenses';
import type { UserIdT } from '@/types';

export type DebtEdge = {
  from: UserIdT;
  to: UserIdT;
  amount: number;
};

export function getPayerId(expense: ExpenseResponse): string | null {
  return expense.payerUserId ?? expense.createdBy ?? null;
}

export function isRealUser(person: {
  id: string;
  guestName?: string;
}): boolean {
  return !person.guestName;
}

function remainingForPerson(
  expense: ExpenseResponse,
  personId: string,
  payerId: string
): number {
  if (personId === payerId) return 0;
  const person = expense.people.find((p) => p.id === personId);
  if (!person) return 0;
  return Math.max(person.subtotal - (person.paid ?? 0), 0);
}

/**
 * Builds aggregated directed edges debtor -> creditor for outstanding balances
 * across expenses. Only includes real (non-guest) users.
 */
export function buildDebtEdges(
  expenses: ExpenseResponse[],
  viewerUserId: UserIdT | null
): DebtEdge[] {
  if (!viewerUserId) return [];

  const visible = expenses.filter(
    (e) =>
      e.createdBy === viewerUserId ||
      e.people.some((p) => p.id === viewerUserId)
  );

  const weights = new Map<string, number>();

  for (const expense of visible) {
    const payerId = getPayerId(expense);
    if (!payerId) continue;

    for (const person of expense.people) {
      if (!isRealUser(person)) continue;
      const remaining = remainingForPerson(expense, person.id, payerId);
      if (remaining <= 0) continue;
      const key = `${person.id}\0${payerId}`;
      weights.set(key, (weights.get(key) ?? 0) + remaining);
    }
  }

  const edges: DebtEdge[] = [];
  for (const [key, amount] of weights) {
    const [from, to] = key.split('\0') as [UserIdT, UserIdT];
    edges.push({ from, to, amount });
  }

  edges.sort((a, b) => {
    const c = a.from.localeCompare(b.from);
    if (c !== 0) return c;
    return a.to.localeCompare(b.to);
  });

  return edges;
}

/**
 * Unique user ids that appear as endpoints of the given edges.
 */
export function collectNodeIds(edges: DebtEdge[]): UserIdT[] {
  const set = new Set<string>();
  for (const e of edges) {
    set.add(e.from);
    set.add(e.to);
  }
  return [...set].sort() as UserIdT[];
}
