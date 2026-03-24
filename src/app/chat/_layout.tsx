import { Stack } from 'expo-router';
import * as React from 'react';

import { colors } from '@/components/ui';

export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background[950] },
        headerTintColor: colors.text[50],
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background[950] },
      }}
    />
  );
}
