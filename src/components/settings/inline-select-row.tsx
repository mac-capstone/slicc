import Ionicons from '@expo/vector-icons/Ionicons';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import colors from '@/components/ui/colors';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Text } from '@/components/ui/text';
import { type translate } from '@/lib';
import { cn } from '@/lib/utils';

export type InlineSelectOption = { label: string; value: string | number };

type Props = {
  /** i18n key (settings). */
  labelTx?: Parameters<typeof translate>[0];
  /** Plain label (e.g. legacy tax row). */
  label?: string;
  value: string | number;
  options: InlineSelectOption[];
  onSelect: (value: string | number) => void;
  testID?: string;
};

export function InlineSelectRow({
  labelTx,
  label,
  value,
  options,
  onSelect,
  testID,
}: Props): React.ReactElement {
  const selectedLabel = React.useMemo(
    () => options.find((o) => o.value === value)?.label ?? String(value),
    [options, value]
  );

  return (
    <DropdownMenu>
      <View className="flex-row items-center justify-between gap-4">
        {labelTx ? (
          <Text tx={labelTx} className="shrink text-base text-text-50" />
        ) : (
          <Text className="shrink text-base text-text-50">{label ?? ''}</Text>
        )}
        <DropdownMenuTrigger asChild>
          <Pressable
            testID={testID ? `${testID}-trigger` : undefined}
            className="h-10 w-24 shrink-0 flex-row items-center justify-end gap-0.5 rounded-lg border border-charcoal-500 bg-charcoal-900 pl-1 pr-1.5"
          >
            <Text
              numberOfLines={1}
              className="min-w-0 flex-1 text-right font-futuraDemi text-lg text-text-50"
            >
              {selectedLabel}
            </Text>
            <Ionicons
              name="chevron-down"
              size={18}
              color={colors.charcoal[400]}
            />
          </Pressable>
        </DropdownMenuTrigger>
      </View>
      <DropdownMenuContent align="end" side="bottom">
        {options.map((opt) => (
          <DropdownMenuItem
            key={String(opt.value)}
            textValue={String(opt.label)}
            onPress={() => onSelect(opt.value)}
            className={cn(
              'flex-row items-center justify-end px-3 py-2.5 active:bg-charcoal-800'
            )}
            testID={testID ? `${testID}-option-${opt.value}` : undefined}
          >
            <Text className="text-right font-futuraDemi text-base text-text-50">
              {opt.label}
            </Text>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
