import { Redirect, useLocalSearchParams } from 'expo-router';
import * as React from 'react';

import type { GroupIdT } from '@/types';

/**
 * Group home is the chat. Event list + create live in the chat screen.
 * Group info (members, events, leave/delete): `/group/[id]/members`.
 * Create group: `/group/edit`.
 */
export default function GroupDetailRedirect() {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id as GroupIdT | undefined;
  if (!groupId) {
    return <Redirect href="/social" />;
  }
  return <Redirect href={`/chat/${groupId}`} />;
}
