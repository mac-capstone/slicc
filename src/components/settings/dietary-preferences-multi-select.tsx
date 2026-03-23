import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { FlashList } from '@shopify/flash-list';
import { useColorScheme } from 'nativewind';
import type { ReactElement } from 'react';
import * as React from 'react';
import { Platform, Pressable } from 'react-native';

import { DietaryPreferenceOptionRow } from '@/components/settings/dietary-preference-option-row';
import colors from '@/components/ui/colors';
import { Modal, useModal } from '@/components/ui/modal';
import { Text } from '@/components/ui/text';
import { DIETARY_LABEL_KEYS } from '@/lib/dietary-preference-label-keys';
import {
  DIETARY_PREFERENCE_IDS,
  type DietaryPreferenceId,
} from '@/lib/dietary-preference-options';
import { translate } from '@/lib/i18n';

const List = Platform.OS === 'web' ? FlashList : BottomSheetFlatList;

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
  const modal = useModal();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

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

  const renderItem = React.useCallback(
    ({ item }: { item: DietaryPreferenceId }) => (
      <DietaryPreferenceOptionRow
        label={translate(DIETARY_LABEL_KEYS[item])}
        selected={value.includes(item)}
        onToggle={() => toggle(item)}
        testID={testID ? `${testID}-option-${item}` : undefined}
      />
    ),
    [toggle, value, testID]
  );

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityHint={translate('settings.dietary_select_a11y_hint')}
        onPress={modal.present}
        className="mt-5 min-h-[52px] flex-row items-center rounded-xl bg-charcoal-900 px-4 py-3"
        testID={`${testID}-trigger`}
      >
        <Text
          className="flex-1 pr-2 text-base leading-6 text-text-50"
          numberOfLines={3}
        >
          {summary}
        </Text>
        <Ionicons name="chevron-down" size={22} color={colors.charcoal[400]} />
      </Pressable>

      <Modal
        ref={modal.ref}
        snapPoints={['70%']}
        title={translate('settings.dietary_preferences')}
        backgroundStyle={{
          backgroundColor: isDark ? colors.charcoal[900] : colors.white,
        }}
      >
        <List
          data={[...DIETARY_PREFERENCE_IDS]}
          keyExtractor={(item: DietaryPreferenceId) => item}
          renderItem={renderItem}
          estimatedItemSize={56}
        />
      </Modal>
    </>
  );
}
