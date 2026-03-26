import React from 'react';
import { ActivityIndicator, View as RNView } from 'react-native';

import { useGroupIds } from '@/api/groups/use-groups';
import { hasPlacesApiKey, type Place } from '@/api/places/places-api';
import {
  type FriendPlaceMatchRow,
  type GroupPlaceMatchRow,
  usePlaceSocialMatch,
} from '@/api/places/use-place-social-match';
import { useFriendUserIds } from '@/api/social/friendships';
import { PlaceSocialMatchRow } from '@/components/place-social-match-row';
import { colors, Text, View } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useUserLocation } from '@/lib/hooks/use-user-location';

type Props = {
  place: Place;
};

export function PlaceSocialMatchSection({
  place,
}: Props): React.ReactElement | null {
  const userId = useAuth.use.userId();
  const { location: userLocation } = useUserLocation();

  const { data: friendUserIds = [] } = useFriendUserIds({
    variables: userId,
    enabled: Boolean(userId) && userId !== 'guest_user',
  });

  const { data: groupIds = [] } = useGroupIds({
    variables: userId,
    enabled: Boolean(userId) && userId !== 'guest_user',
  });

  const showChrome =
    Boolean(userId) &&
    userId !== 'guest_user' &&
    hasPlacesApiKey() &&
    (friendUserIds.length > 0 || groupIds.length > 0);

  const { friendRows, groupRows, isAnyPending } = usePlaceSocialMatch({
    place,
    viewerUserId: userId,
    friendUserIds,
    groupIds,
    userLocation,
    enabled: showChrome,
  });

  if (!showChrome) return null;

  const hasResults = friendRows.length > 0 || groupRows.length > 0;
  if (!isAnyPending && !hasResults) return null;

  return (
    <View className="mb-6 rounded-2xl bg-neutral-850 p-5">
      <Text className="font-interSemiBold text-lg text-white">
        Friends & groups
      </Text>
      <Text
        className="mt-1 text-xs leading-5"
        style={{ color: colors.text[800] }}
      >
        How well this spot matches your friends (full taste + community) and
        your groups (average taste across members with likes).
      </Text>

      {isAnyPending && !hasResults ? (
        <RNView className="mt-4 items-center py-6">
          <ActivityIndicator color={colors.accent[100]} />
        </RNView>
      ) : (
        <RNView className="mt-4 gap-4">
          {friendRows.length > 0 && (
            <RNView>
              <Text
                className="mb-2 text-xs uppercase tracking-wide"
                style={{ color: colors.text[800] }}
              >
                Friends
              </Text>
              {friendRows.map((r: FriendPlaceMatchRow) => (
                <PlaceSocialMatchRow
                  key={r.id}
                  icon="person"
                  title={r.displayName}
                  subtitle="Match vs their likes & community overlap"
                  composite={r.composite}
                />
              ))}
            </RNView>
          )}

          {groupRows.length > 0 && (
            <RNView>
              <Text
                className="mb-2 text-xs uppercase tracking-wide"
                style={{ color: colors.text[800] }}
              >
                Groups
              </Text>
              {groupRows.map((r: GroupPlaceMatchRow) => (
                <PlaceSocialMatchRow
                  key={r.id}
                  icon="people"
                  title={r.name}
                  subtitle="Average of members with place likes (taste + venue fit)"
                  composite={r.composite}
                />
              ))}
            </RNView>
          )}
        </RNView>
      )}
    </View>
  );
}
