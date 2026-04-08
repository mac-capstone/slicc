import Octicons from '@expo/vector-icons/Octicons';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import { getProfilePictureUrl } from '@/api/people/user-api';
import { colors, Image, Text, View } from '@/components/ui';
import type { Point } from '@/lib/expenses/debt-graph-layout';
import type { NodeLabel } from '@/lib/expenses/fetch-debt-graph-labels';
import type { UserIdT } from '@/types';

type Props = {
  nodeIds: UserIdT[];
  positions: Map<UserIdT, Point>;
  labelById: Record<string, NodeLabel>;
  nodeRadius: number;
};

function firstName(label: NodeLabel): string {
  const parts = label.displayName.split(/\s+/);
  const name = parts[0];
  return name.length > 10 ? `${name.slice(0, 9)}…` : name;
}

function NodeAvatar({ userId, size }: { userId: UserIdT; size: number }) {
  const { data: photoURL } = useQuery({
    queryKey: ['users', 'profile-picture', userId],
    queryFn: () => getProfilePictureUrl(userId),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: colors.avatar.white,
      }}
      className="items-center justify-center"
    >
      {photoURL ? (
        <Image
          source={{ uri: photoURL }}
          style={{ width: size, height: size }}
          contentFit="cover"
        />
      ) : (
        <Octicons name="person" size={size * 0.5} color="#D4D4D4" />
      )}
    </View>
  );
}

export function DebtGraphOverlayNodes({
  nodeIds,
  positions,
  labelById,
  nodeRadius,
}: Props) {
  const diameter = nodeRadius * 2;

  return (
    <>
      {nodeIds.map((id) => {
        const p = positions.get(id);
        if (!p) return null;
        const label = labelById[id];
        return (
          <View
            key={id}
            className="absolute items-center"
            pointerEvents="none"
            style={{
              left: p.x - nodeRadius,
              top: p.y - nodeRadius,
              width: diameter,
            }}
          >
            <NodeAvatar userId={id} size={diameter} />
            {label ? (
              <Text
                className="mt-1 text-center text-xs text-charcoal-200"
                numberOfLines={1}
              >
                {firstName(label)}
              </Text>
            ) : null}
          </View>
        );
      })}
    </>
  );
}
