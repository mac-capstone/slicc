import { useEffect } from 'react';

import { fetchIsOnline, subscribeReachability } from '@/lib/network-status';
import { flushPendingExpenseQueue } from '@/lib/offline/pending-expense-queue';

/**
 * When the user is signed in, retries uploading expenses saved while offline.
 */
export function usePendingExpenseSync(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const run = () => {
      void flushPendingExpenseQueue();
    };

    run();
    void fetchIsOnline().then((online) => {
      if (online) run();
    });

    const unsub = subscribeReachability((online) => {
      if (online) run();
    });

    const interval = setInterval(run, 60_000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [enabled]);
}
