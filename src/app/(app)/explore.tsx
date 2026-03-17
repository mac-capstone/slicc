import React from 'react';

import { Text, View } from '@/components/ui';

export default function Explore() {
  return (
    <View className="flex-1 px-4">
      <View className="py-6">
        <Text className="text-2xl font-bold">Explore</Text>
        <Text className="mt-2 text-base opacity-80">Search and discover.</Text>
      </View>
    </View>
  );
}
