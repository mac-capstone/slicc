import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useCallback } from 'react';
import { Pressable, View as RNView } from 'react-native';

import type { Place } from '@/api/places/places-api';
import { colors, Text } from '@/components/ui';
import { openExternalUrl } from '@/lib/open-external-url';

type Props = {
  place: Place;
};

export function PlaceDetailPhoneBlock({
  place,
}: Props): React.ReactElement | null {
  const handleCallPhone = useCallback(async (): Promise<void> => {
    if (!place.nationalPhoneNumber) return;
    const tel = `tel:${place.nationalPhoneNumber.replace(/\s/g, '')}`;
    await openExternalUrl(tel, {
      failureTitle: 'Cannot place call',
      failureMessage:
        'We could not start a phone call from this device. Check your phone app or permissions.',
    });
  }, [place.nationalPhoneNumber]);

  if (!place.nationalPhoneNumber) {
    return null;
  }

  return (
    <RNView className="mt-4 flex-row items-start gap-3">
      <MaterialCommunityIcons
        name="phone-outline"
        size={18}
        color={colors.accent[100]}
        style={{ marginTop: 2 }}
      />
      <RNView className="min-w-0 flex-1">
        <Text className="text-base leading-6 text-white">
          {place.nationalPhoneNumber}
        </Text>
        <Pressable
          onPress={handleCallPhone}
          className="mt-1 flex-row items-center"
        >
          <Text
            className="text-sm font-semibold"
            style={{ color: colors.accent[100] }}
          >
            Call
          </Text>
          <MaterialCommunityIcons
            name="phone-in-talk-outline"
            size={14}
            color={colors.accent[100]}
            style={{ marginLeft: 4 }}
          />
        </Pressable>
      </RNView>
    </RNView>
  );
}
