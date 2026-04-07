import React from 'react';
import { StyleSheet, View } from 'react-native';
import CircularProgress from 'react-native-circular-progress-indicator';

import { colors, Text } from '@/components/ui';

type Props = {
  youOwe: number;
  owedToYou: number;
};

export function BalanceProgress({ youOwe, owedToYou }: Props) {
  const total = youOwe + owedToYou || 1;
  const youOwePercent = total > 0 ? (youOwe / total) * 100 : 0;
  const owedToYouPercent = total > 0 ? (owedToYou / total) * 100 : 0;

  return (
    <View className="flex-row items-center justify-around gap-4">
      <View className="items-center">
        <View style={styles.circleWrapper}>
          <CircularProgress
            value={youOwePercent}
            radius={48}
            duration={800}
            activeStrokeColor={colors.danger[400]}
            inActiveStrokeColor={colors.charcoal[700]}
            inActiveStrokeOpacity={0.5}
            activeStrokeWidth={8}
            inActiveStrokeWidth={8}
            showProgressValue={false}
          />
          <View style={styles.centerContent}>
            <Text
              className="font-futuraDemi text-base"
              style={{ color: colors.danger[400] }}
            >
              ${youOwe.toFixed(0)}
            </Text>
          </View>
        </View>
        <Text className="mt-2 text-xs" style={{ color: colors.text[800] }}>
          You owe
        </Text>
      </View>
      <View className="items-center">
        <View style={styles.circleWrapper}>
          <CircularProgress
            value={owedToYouPercent}
            radius={48}
            duration={800}
            activeStrokeColor={colors.accent[100]}
            inActiveStrokeColor={colors.charcoal[700]}
            inActiveStrokeOpacity={0.5}
            activeStrokeWidth={8}
            inActiveStrokeWidth={8}
            showProgressValue={false}
          />
          <View style={styles.centerContent}>
            <Text
              className="font-futuraDemi text-base"
              style={{ color: colors.accent[100] }}
            >
              ${owedToYou.toFixed(0)}
            </Text>
          </View>
        </View>
        <Text className="mt-2 text-xs" style={{ color: colors.text[800] }}>
          Owed to you
        </Text>
      </View>
    </View>
  );
}

const CIRCLE_SIZE = 96;

const styles = StyleSheet.create({
  circleWrapper: {
    position: 'relative',
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
  },
  centerContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
