import { fetchUser } from '@/api/people/use-users';
import type { UserIdT } from '@/types';

export type NodeLabel = {
  displayName: string;
  initials: string;
};

function extractInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export async function fetchDebtGraphLabels(
  nodeIds: UserIdT[],
  _viewerUserId: string | null
): Promise<Record<string, NodeLabel>> {
  const entries = await Promise.all(
    nodeIds.map(async (id) => {
      try {
        const u = await fetchUser(id);
        const name = u.displayName || 'User';
        return [
          id,
          { displayName: name, initials: extractInitials(name) },
        ] as const;
      } catch {
        return [id, { displayName: 'User', initials: '??' }] as const;
      }
    })
  );
  return Object.fromEntries(entries);
}
