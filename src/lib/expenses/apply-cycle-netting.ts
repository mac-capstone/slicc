import { doc, writeBatch } from 'firebase/firestore';

import { db } from '@/api/common/firebase';
import type { ExpenseResponse } from '@/api/expenses/use-expenses';
import type { UserIdT } from '@/types';

import { getPayerId, isRealUser } from './build-debt-edges';
import type { CycleEdge } from './debt-graph-cycles';

type NettingOp = {
  expenseId: string;
  personId: string;
  newPaid: number;
  newRemainingAmount: number;
};

type EdgeReductionParams = {
  from: string;
  to: string;
  delta: number;
  expenses: ExpenseResponse[];
  viewerUserId: string;
};

function buildOpsForEdge({
  from,
  to,
  delta,
  expenses,
  viewerUserId,
}: EdgeReductionParams): NettingOp[] {
  const relevant = expenses.filter((e) => {
    const isVisible =
      e.createdBy === viewerUserId ||
      e.people.some((p) => p.id === viewerUserId);
    if (!isVisible) return false;
    const payerId = getPayerId(e);
    if (payerId !== to) return false;
    const person = e.people.find((p) => p.id === from);
    if (!person || !isRealUser(person)) return false;
    const remaining = Math.max(person.subtotal - (person.paid ?? 0), 0);
    return remaining > 0;
  });

  const ops: NettingOp[] = [];
  let left = delta;

  for (const expense of relevant) {
    if (left <= 0) break;
    const person = expense.people.find((p) => p.id === from)!;
    const remaining = Math.max(person.subtotal - (person.paid ?? 0), 0);
    const inc = Math.min(remaining, left);
    const newPaid = (person.paid ?? 0) + inc;
    left -= inc;

    const payerId = getPayerId(expense)!;
    const newRemainingAmount = Math.max(
      expense.people
        .filter((p) => p.id !== payerId)
        .reduce((sum, p) => {
          const pPaid = p.id === from ? newPaid : (p.paid ?? 0);
          return sum + Math.max(p.subtotal - pPaid, 0);
        }, 0),
      0
    );

    ops.push({
      expenseId: expense.id,
      personId: from,
      newPaid,
      newRemainingAmount,
    });
  }

  return ops;
}

export type CycleNettingParams = {
  cycleEdges: CycleEdge[];
  nettingAmount: number;
  expenses: ExpenseResponse[];
  viewerUserId: UserIdT;
};

/**
 * Applies cycle netting across Firestore expenses. For each edge in the cycle,
 * increases `paid` on the debtor's people subdoc(s) by `nettingAmount`,
 * recalculates `remainingAmount`, and commits in a single batch.
 */
export async function applyCycleNetting({
  cycleEdges,
  nettingAmount,
  expenses,
  viewerUserId,
}: CycleNettingParams): Promise<void> {
  const allOps: NettingOp[] = [];

  for (const { from, to } of cycleEdges) {
    const ops = buildOpsForEdge({
      from,
      to,
      delta: nettingAmount,
      expenses,
      viewerUserId,
    });
    allOps.push(...ops);
  }

  if (allOps.length === 0) return;

  const batch = writeBatch(db);

  for (const op of allOps) {
    const expenseRef = doc(db, 'expenses', op.expenseId);
    const personRef = doc(expenseRef, 'people', op.personId);
    batch.update(personRef, { paid: op.newPaid });
    batch.update(expenseRef, { remainingAmount: op.newRemainingAmount });
  }

  await batch.commit();
}
