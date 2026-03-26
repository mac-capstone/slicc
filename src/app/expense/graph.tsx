import Octicons from '@expo/vector-icons/Octicons';
import { useNavigation, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { useLayoutEffect } from 'react';
import { Pressable } from 'react-native';

import { DebtGraphView } from '@/components/expenses/debt-graph-view';
import { colors, View } from '@/components/ui';

export default function ExpenseDebtGraphScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const tint = isDark ? colors.charcoal[100] : colors.charcoal[900];

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTintColor: tint,
      headerLeft: () => (
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          style={{ marginLeft: 4, padding: 4 }}
        >
          <Octicons name="arrow-left" size={22} color={tint} />
        </Pressable>
      ),
    });
  }, [navigation, router, tint]);

  return (
    <View className="flex-1 bg-background-950">
      <DebtGraphView />
    </View>
  );
}
