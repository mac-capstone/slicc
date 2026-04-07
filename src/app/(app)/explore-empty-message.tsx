import Octicons from '@expo/vector-icons/Octicons';
import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { colors } from '@/components/ui';

type Props = {
  hasApiKey: boolean;
  isApiKeyError: boolean;
  hasLocation: boolean;
  hasLikes: boolean;
  isSearching: boolean;
  showMap: boolean;
  locationStatus: string | null;
};

export function ExploreEmptyMessage({
  hasApiKey,
  isApiKeyError,
  hasLocation,
  hasLikes,
  isSearching,
  showMap,
  locationStatus,
}: Props): React.ReactElement {
  if (!hasApiKey) {
    return (
      <Text
        className="px-4 text-center text-base"
        style={{ color: colors.text[800] }}
      >
        Add EXPO_PUBLIC_GOOGLE_PLACES_API_KEY to your .env to discover places.
      </Text>
    );
  }
  if (isApiKeyError) {
    return (
      <Text
        className="px-4 text-center text-base"
        style={{ color: colors.text[800] }}
      >
        Your Google Places API key appears to be invalid. An API key is required
        to use the Places API.
      </Text>
    );
  }
  if (!hasLocation && !isSearching) {
    return (
      <View className="items-center gap-3 px-4">
        <Octicons name="location" size={32} color={colors.text[800]} />
        <Text
          className="text-center text-base"
          style={{ color: colors.text[800] }}
        >
          Location is required for recommendations and nearby places.
        </Text>
        {locationStatus === 'denied' && (
          <Pressable
            onPress={() => Linking.openSettings()}
            accessibilityRole="button"
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: colors.accent[100] }}
            >
              Open Settings
            </Text>
          </Pressable>
        )}
      </View>
    );
  }
  if (showMap && !hasLocation) {
    return (
      <View className="items-center gap-3 px-4">
        <Octicons name="location" size={32} color={colors.text[800]} />
        <Text
          className="text-center text-base"
          style={{ color: colors.text[800] }}
        >
          Enable location to view the nearby map.
        </Text>
        {locationStatus === 'denied' && (
          <Pressable
            onPress={() => Linking.openSettings()}
            accessibilityRole="button"
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: colors.accent[100] }}
            >
              Open Settings
            </Text>
          </Pressable>
        )}
      </View>
    );
  }
  if (isSearching) {
    return (
      <Text
        className="px-4 text-center text-base"
        style={{ color: colors.text[800] }}
      >
        No places found. Try a different search.
      </Text>
    );
  }
  if (!hasLikes) {
    return (
      <Text
        className="px-4 text-center text-base"
        style={{ color: colors.text[800] }}
      >
        Like some places to get personalized recommendations.
      </Text>
    );
  }
  return (
    <Text
      className="px-4 text-center text-base"
      style={{ color: colors.text[800] }}
    >
      No recommendations right now. Like more places to improve results.
    </Text>
  );
}
