import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactElement } from 'react';
import { Pressable } from 'react-native';

import colors from '@/components/ui/colors';
import { Text } from '@/components/ui/text';

type Props = {
  label: string;
  selected: boolean;
  onToggle: () => void;
  testID?: string;
};

export function DietaryPreferenceOptionRow({
  label,
  selected,
  onToggle,
  testID,
}: Props): ReactElement {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onToggle}
      className="flex-row items-center border-b border-neutral-300 px-4 py-3.5 dark:border-charcoal-700"
      testID={testID}
    >
      <Text className="flex-1 text-base text-text-50">{label}</Text>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={24}
        color={selected ? colors.accent[100] : colors.charcoal[500]}
      />
    </Pressable>
  );
}
