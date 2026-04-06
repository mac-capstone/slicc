import { v4 as uuidv4 } from 'uuid';

import { queryClient } from '@/api/common/api-provider';
import { auth } from '@/api/common/firebase';
import {
  type CommitExpenseInput,
  commitExpenseToFirestore,
} from '@/api/expenses/commit-expense';
import { fetchIsOnline } from '@/lib/network-status';
import { storage } from '@/lib/storage';

const QUEUE_KEY = 'pending-expense-sync-queue';

export type PendingExpenseRecord = {
  localId: string;
  createdAt: number;
  payload: CommitExpenseInput;
};

function readQueue(): PendingExpenseRecord[] {
  const raw = storage.getString(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PendingExpenseRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(records: PendingExpenseRecord[]): void {
  storage.set(QUEUE_KEY, JSON.stringify(records));
}

export function enqueuePendingExpense(payload: CommitExpenseInput): string {
  const localId = uuidv4();
  const next = [...readQueue(), { localId, createdAt: Date.now(), payload }];
  writeQueue(next);
  return localId;
}

/**
 * Upload queued expenses when the device is online and Firebase Auth has a user.
 */
export async function flushPendingExpenseQueue(): Promise<void> {
  if (!auth.currentUser) return;
  const online = await fetchIsOnline();
  if (!online) return;

  const queue = readQueue();
  if (queue.length === 0) return;

  const failed: PendingExpenseRecord[] = [];
  let anyCommitted = false;

  for (const record of queue) {
    try {
      await commitExpenseToFirestore(record.payload);
      anyCommitted = true;
    } catch (e) {
      console.warn('Pending expense sync failed, will retry:', e);
      failed.push(record);
    }
  }

  writeQueue(failed);
  if (anyCommitted) {
    await queryClient.invalidateQueries({ queryKey: ['expenses'] });
  }
}
