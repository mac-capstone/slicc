import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

import { colors, Text } from '@/components/ui';

type Props = {
  youOwe: number;
  owedToYou: number;
};

const BAR_HEIGHT = 32;
const BORDER = 2;
const RADIUS = 9999;

export function BalanceProgress({
  youOwe,
  owedToYou,
}: Props): React.JSX.Element {
  const hasOwe = youOwe > 0;
  const hasOwed = owedToYou > 0;
  const total = youOwe + owedToYou || 1;
  const owePercent = hasOwe ? (youOwe / total) * 100 : 0;

  const anim = useRef(new Animated.Value(owePercent)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: owePercent,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [owePercent, anim]);

  const leftWidth = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  // When only one side is non-zero (or both zero), show a single full bar.
  const showSplit = hasOwe && hasOwed;

  return (
    <View>
      <View className="mb-3 flex-row justify-between">
        <View>
          <Text className="text-xs" style={{ color: colors.text[800] }}>
            You owe
          </Text>
          <Text
            className="font-futuraDemi text-base"
            style={{ color: colors.danger[400] }}
          >
            ${youOwe.toFixed(2)}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-xs" style={{ color: colors.text[800] }}>
            Owed to you
          </Text>
          <Text
            className="font-futuraDemi text-base"
            style={{ color: colors.accent[100] }}
          >
            ${owedToYou.toFixed(2)}
          </Text>
        </View>
      </View>

      <View
        style={{
          height: BAR_HEIGHT,
          flexDirection: 'row',
          backgroundColor: colors.background[900],
          borderRadius: RADIUS,
          overflow: 'hidden',
        }}
      >
        {showSplit ? (
          <>
            {/* Left segment — you owe (red) */}
            <Animated.View
              style={{
                height: '100%',
                width: leftWidth,
                backgroundColor: '#F8717130',
                borderTopWidth: BORDER,
                borderBottomWidth: BORDER,
                borderLeftWidth: BORDER,
                borderRightWidth: 0,
                borderColor: colors.danger[400],
                borderTopLeftRadius: RADIUS,
                borderBottomLeftRadius: RADIUS,
              }}
            />
            {/* Right segment — owed to you (teal) */}
            <View
              style={{
                flex: 1,
                height: '100%',
                backgroundColor: '#00DBC52E',
                borderTopWidth: BORDER,
                borderBottomWidth: BORDER,
                borderRightWidth: BORDER,
                borderLeftWidth: 0,
                borderColor: colors.accent[100],
                borderTopRightRadius: RADIUS,
                borderBottomRightRadius: RADIUS,
              }}
            />
          </>
        ) : hasOwe ? (
          /* Only owe — full red bar */
          <View
            style={{
              flex: 1,
              height: '100%',
              backgroundColor: '#F8717130',
              borderWidth: BORDER,
              borderColor: colors.danger[400],
              borderRadius: RADIUS,
            }}
          />
        ) : (
          /* Both zero or only owed — full teal bar */
          <View
            style={{
              flex: 1,
              height: '100%',
              backgroundColor: '#00DBC52E',
              borderWidth: BORDER,
              borderColor: colors.accent[100],
              borderRadius: RADIUS,
            }}
          />
        )}
      </View>
    </View>
  );
}
