/**
 * Case-insensitive substring match on display name and/or username (Manage People, Add Friend, etc.).
 */
export function softMatch(
  search: string,
  name: string,
  username?: string
): boolean {
  const searchLower = search.toLowerCase().trim();
  if (!searchLower) return false;
  const nameLower = name.toLowerCase();
  const usernameLower = username?.toLowerCase() ?? '';
  return nameLower.includes(searchLower) || usernameLower.includes(searchLower);
}

function matchRank(
  search: string,
  displayName: string,
  username: string
): number {
  const q = search.toLowerCase().trim();
  if (!q) return 999;
  const name = displayName.toLowerCase();
  const u = username.toLowerCase();
  if (u === q) return 0;
  if (u.startsWith(q)) return 1;
  if (name.startsWith(q)) return 2;
  if (u.includes(q)) return 3;
  if (name.includes(q)) return 4;
  return 999;
}

/**
 * Best-ranked matches for typeahead (e.g. top 3 in Add Friend). Uses the same
 * substring rules as {@link softMatch}, with stronger ranking for exact/prefix matches.
 */
export function topSoftMatches<
  T extends { displayName: string; username: string },
>(search: string, items: T[], limit: number): T[] {
  const q = search.trim();
  if (!q || limit <= 0) return [];

  const scored = items
    .map((item) => ({
      item,
      rank: matchRank(q, item.displayName, item.username),
    }))
    .filter((x) => x.rank < 999)
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.item.displayName.localeCompare(b.item.displayName);
    });

  return scored.slice(0, limit).map((s) => s.item);
}
