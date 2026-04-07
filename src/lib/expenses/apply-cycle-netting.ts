import { doc, writeBatch } from 'firebase/firestore';

import { db } from '@/api/common/firebase';
import type { ExpenseResponse } from '@/api/expenses/use-expenses';
import type { UserIdT } from '@/types';

import {
  getPayerId,
  isExpenseVisibleToViewer,
  isRealUser,
} from './build-debt-edges';
import type { CycleEdge } from './debt-graph-cycles';

export type CycleNettingParams = {
  cycleEdges: CycleEdge[];
  nettingAmount: number;
  expenses: ExpenseResponse[];
  viewerUserId: UserIdT;
};

export type NettingOp = {
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
    if (!isExpenseVisibleToViewer(e, viewerUserId as UserIdT)) return false;
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

/**
 * Computes Firestore updates for cycle netting without writing (used for optimistic UI).
 */
export function computeCycleNettingOps(
  params: CycleNettingParams
): NettingOp[] {
  const { cycleEdges, nettingAmount, expenses, viewerUserId } = params;
  const allOps: NettingOp[] = [];
  for (const { from, to } of cycleEdges) {
    allOps.push(
      ...buildOpsForEdge({
        from,
        to,
        delta: nettingAmount,
        expenses,
        viewerUserId,
      })
    );
  }
  return allOps;
}

/**
 * Returns an updated expense snapshot after applying netting ops for that document.
 */
export function mergeNettingOpsIntoExpense(
  expense: ExpenseResponse,
  ops: NettingOp[]
): ExpenseResponse {
  const forDoc = ops.filter((o) => o.expenseId === expense.id);
  if (forDoc.length === 0) return expense;

  const paidByPerson = new Map<string, number>();
  for (const op of forDoc) {
    paidByPerson.set(op.personId, op.newPaid);
  }

  const people = expense.people.map((p) => {
    const np = paidByPerson.get(p.id);
    return np !== undefined ? { ...p, paid: np } : p;
  });

  const payerId = getPayerId(expense)!;
  const newRemainingAmount = Math.max(
    people
      .filter((p) => p.id !== payerId)
      .reduce((sum, p) => sum + Math.max(p.subtotal - (p.paid ?? 0), 0), 0),
    0
  );

  return { ...expense, people, remainingAmount: newRemainingAmount };
}

/**
 * Applies cycle netting across Firestore expenses. For each edge in the cycle,
 * increases `paid` on the debtor's people subdoc(s) by `nettingAmount`,
 * recalculates `remainingAmount`, and commits in a single batch.
 */
export type CycleNettingResult = {
  affectedExpenseIds: string[];
};

export async function applyCycleNetting(
  params: CycleNettingParams
): Promise<CycleNettingResult> {
  const allOps = computeCycleNettingOps(params);

  if (allOps.length === 0) {
    return { affectedExpenseIds: [] };
  }

  const batch = writeBatch(db);

  const opsByExpense = new Map<string, NettingOp[]>();
  for (const op of allOps) {
    const list = opsByExpense.get(op.expenseId) ?? [];
    list.push(op);
    opsByExpense.set(op.expenseId, list);
  }

  for (const [expenseId, ops] of opsByExpense) {
    const expenseRef = doc(db, 'expenses', expenseId);
    for (const op of ops) {
      const personRef = doc(expenseRef, 'people', op.personId);
      batch.update(personRef, { paid: op.newPaid });
    }
    const finalRemainingAmount = ops[ops.length - 1].newRemainingAmount;
    batch.update(expenseRef, { remainingAmount: finalRemainingAmount });
  }

  await batch.commit();

  const affectedExpenseIds = [...opsByExpense.keys()];
  return { affectedExpenseIds };
}
