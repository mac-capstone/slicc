import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactElement } from 'react';
import * as React from 'react';
import { Pressable, ScrollView, useWindowDimensions } from 'react-native';

import colors from '@/components/ui/colors';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Text } from '@/components/ui/text';
import { translate } from '@/lib/i18n';
import { BANK_OPTIONS } from '@/lib/payment-utils';
import { cn } from '@/lib/utils';
import { type BankPreference } from '@/types';

type Props = {
  value: BankPreference;
  onSelect: (value: string) => void;
  testID?: string;
};

export function BankPreferenceSelect({
  value,
  onSelect,
  testID = 'settings-bank',
}: Props): ReactElement {
  const { width: windowWidth } = useWindowDimensions();
  /** Match settings horizontal padding (`px-6` × 2). */
  const menuWidth = Math.min(windowWidth - 48, windowWidth * 0.92);

  const summary = React.useMemo(() => {
    if (value === 'none') {
      return translate('settings.preferred_bank_placeholder');
    }
    return BANK_OPTIONS.find((o) => o.value === value)?.label ?? value;
  }, [value]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate('settings.preferred_bank')}
          accessibilityHint={translate('settings.bank_select_a11y_hint')}
          className="mt-4 min-h-[52px] w-full flex-row items-center rounded-xl border border-charcoal-600 bg-charcoal-900 px-4 py-3"
          testID={`${testID}-trigger`}
        >
          <Text
            className="flex-1 pr-2 text-base leading-6 text-text-50"
            numberOfLines={2}
          >
            {summary}
          </Text>
          <Ionicons
            name="chevron-down"
            size={22}
            color={colors.charcoal[400]}
          />
        </Pressable>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        style={{ width: menuWidth }}
        className="max-h-80 p-0"
      >
        <ScrollView
          className="max-h-80 w-full"
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {BANK_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              textValue={opt.label}
              onPress={() => onSelect(opt.value)}
              className={cn(
                'flex-row items-center px-4 py-3.5 active:bg-charcoal-800'
              )}
              testID={`${testID}-option-${opt.value}`}
            >
              <Text className="flex-1 text-base text-text-50">{opt.label}</Text>
            </DropdownMenuItem>
          ))}
        </ScrollView>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
