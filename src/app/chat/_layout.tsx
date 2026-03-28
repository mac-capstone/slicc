import { Stack } from 'expo-router';
import * as React from 'react';

import { colors } from '@/components/ui';

export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.charcoal[950] },
        headerTintColor: colors.white,
        headerTitleStyle: { color: colors.white },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.charcoal[950] },
      }}
    />
  );
}
