import { Stack } from 'expo-router';
import * as React from 'react';

import { colors } from '@/components/ui';

export default function GroupChatStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.charcoal[950] },
        animation: 'slide_from_right',
      }}
    />
  );
}
