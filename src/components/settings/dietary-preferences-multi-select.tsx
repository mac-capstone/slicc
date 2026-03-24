import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactElement } from 'react';
import * as React from 'react';
import { Pressable, ScrollView, useWindowDimensions } from 'react-native';

import colors from '@/components/ui/colors';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Text } from '@/components/ui/text';
import { DIETARY_LABEL_KEYS } from '@/lib/dietary-preference-label-keys';
import {
  DIETARY_PREFERENCE_IDS,
  type DietaryPreferenceId,
} from '@/lib/dietary-preference-options';
import { translate } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = {
  value: readonly string[];
  onChange: (next: string[]) => void;
  testID?: string;
};

export function DietaryPreferencesMultiSelect({
  value,
  onChange,
  testID = 'settings-dietary',
}: Props): ReactElement {
  const { width: windowWidth } = useWindowDimensions();
  /** Match settings horizontal padding (`px-6` × 2). */
  const menuWidth = Math.min(windowWidth - 48, windowWidth * 0.92);

  const summary = React.useMemo(() => {
    if (value.length === 0) {
      return translate('settings.dietary_select_placeholder');
    }
    return value
      .map((id) => translate(DIETARY_LABEL_KEYS[id as DietaryPreferenceId]))
      .join(', ');
  }, [value]);

  const toggle = React.useCallback(
    (id: DietaryPreferenceId) => {
      const next = value.includes(id)
        ? value.filter((x) => x !== id)
        : [...value, id];
      onChange(next);
    },
    [value, onChange]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityHint={translate('settings.dietary_select_a11y_hint')}
          className="mt-5 min-h-[52px] w-full flex-row items-center rounded-xl border border-charcoal-600 bg-charcoal-900 px-4 py-3"
          testID={`${testID}-trigger`}
        >
          <Text
            className="flex-1 pr-2 text-base leading-6 text-text-50"
            numberOfLines={3}
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
          {DIETARY_PREFERENCE_IDS.map((item) => (
            <DropdownMenuCheckboxItem
              key={item}
              checked={value.includes(item)}
              closeOnPress={false}
              onCheckedChange={() => toggle(item)}
              textValue={translate(DIETARY_LABEL_KEYS[item])}
              className={cn(
                'flex-row items-center px-4 py-3.5 active:bg-charcoal-800'
              )}
              testID={testID ? `${testID}-option-${item}` : undefined}
            >
              <Text className="flex-1 text-base text-text-50">
                {translate(DIETARY_LABEL_KEYS[item])}
              </Text>
              <DropdownMenuItemIndicator>
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={colors.accent[100]}
                />
              </DropdownMenuItemIndicator>
            </DropdownMenuCheckboxItem>
          ))}
        </ScrollView>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
