import Octicons from '@expo/vector-icons/Octicons';

import { colors, Pressable, Text, View } from '@/components/ui';
import { type Href, useRouter } from '@/lib/guarded-router';
import { useThemeConfig } from '@/lib/use-theme-config';

export const DottedAddButton = ({
  text,
  path,
}: {
  text: string;
  path: Href;
}) => {
  const theme = useThemeConfig();
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(path)}>
      <View className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-8 dark:border-text-800">
        <Octicons
          name="feed-plus"
          size={24}
          color={theme.dark ? colors.text[800] : 'black'}
        />
        <Text className="font-futuraMedium text-lg dark:text-text-800">
          {text}
        </Text>
      </View>
    </Pressable>
  );
};
