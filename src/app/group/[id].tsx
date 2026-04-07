import { Redirect, useLocalSearchParams } from 'expo-router';
import * as React from 'react';

import type { GroupIdT } from '@/types';

/**
 * Group home is the chat. Event list + create live in the chat screen.
 * Members / edit: `/group/[id]/members` and `/group/edit`.
 */
export default function GroupDetailRedirect() {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id as GroupIdT | undefined;
  if (!groupId) {
    return <Redirect href="/social" />;
  }
  return <Redirect href={`/chat/${groupId}`} />;
}
