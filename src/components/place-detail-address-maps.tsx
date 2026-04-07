import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Octicons from '@expo/vector-icons/Octicons';
import React, { useCallback } from 'react';
import { Pressable, View as RNView } from 'react-native';

import type { Place } from '@/api/places/places-api';
import { colors, Text } from '@/components/ui';
import { buildGoogleMapsPlaceUrl } from '@/lib/google-maps-url';
import { openExternalUrl } from '@/lib/open-external-url';

type Props = {
  place: Place;
};

export function PlaceDetailAddressMaps({
  place,
}: Props): React.ReactElement | null {
  const handleOpenMaps = useCallback(async (): Promise<void> => {
    const url = buildGoogleMapsPlaceUrl(place);
    await openExternalUrl(url, {
      failureTitle: 'Maps not available',
      failureMessage:
        'We could not open this location in Maps. Check that a maps app is installed.',
    });
  }, [place]);

  if (!place.formattedAddress) {
    return null;
  }

  return (
    <RNView className="flex-row items-start gap-3">
      <Octicons
        name="location"
        size={18}
        color={colors.accent[100]}
        style={{ marginTop: 2 }}
      />
      <RNView className="min-w-0 flex-1">
        <Text className="text-base leading-6 text-white">
          {place.formattedAddress}
        </Text>
        <Pressable
          onPress={handleOpenMaps}
          className="mt-1 flex-row items-center"
        >
          <Text
            className="text-sm font-semibold"
            style={{ color: colors.accent[100] }}
          >
            Open in Maps
          </Text>
          <MaterialCommunityIcons
            name="open-in-new"
            size={14}
            color={colors.accent[100]}
            style={{ marginLeft: 4 }}
          />
        </Pressable>
      </RNView>
    </RNView>
  );
}
