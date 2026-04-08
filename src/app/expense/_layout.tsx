import { Stack } from 'expo-router';
import * as React from 'react';

import { colors } from '@/components/ui';

export default function ExpenseLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background[950] },
        headerTitleStyle: { fontSize: 24, fontWeight: 'bold' },
        contentStyle: { backgroundColor: colors.background[950] },
      }}
    >
      <Stack.Screen
        name="graph"
        options={{ title: 'Expense Flow Graph', headerShown: true }}
      />
    </Stack>
  );
}
