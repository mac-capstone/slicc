import * as React from 'react';

import { Pressable, Text, View } from '@/components/ui';
import type { TxKeyPath } from '@/lib';
import { cn } from '@/lib/utils';

type ItemProps = {
  text: TxKeyPath;
  value?: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  testID?: string;
};

export function Item({
  text,
  value,
  icon,
  onPress,
  testID,
}: ItemProps): React.ReactElement {
  const isPressable = onPress !== undefined;
  return (
    <Pressable
      accessibilityRole={isPressable ? 'button' : undefined}
      onPress={onPress}
      pointerEvents={isPressable ? 'auto' : 'none'}
      testID={testID}
      className={cn(
        'w-full flex-row items-center justify-between px-4 py-3.5',
        isPressable ? 'active:opacity-80' : ''
      )}
    >
      <View className="min-w-0 flex-1 flex-row items-center pr-3">
        {icon ? <View className="pr-2">{icon}</View> : null}
        <Text className="shrink text-base text-text-50" tx={text} />
      </View>
      <Text className="max-w-[50%] shrink-0 text-right text-base text-charcoal-400">
        {value}
      </Text>
    </Pressable>
  );
}
