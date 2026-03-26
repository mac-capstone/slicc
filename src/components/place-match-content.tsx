import Octicons from '@expo/vector-icons/Octicons';
import React from 'react';
import { ActivityIndicator, View as RNView } from 'react-native';

import { colors, Text, View } from '@/components/ui';
import type { PlaceMatchBreakdown } from '@/lib/recommendation-utils';

function pct01(n: number): string {
  return `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`;
}

export function matchLabel(composite: number): string {
  if (composite >= 0.72) return 'Strong match';
  if (composite >= 0.55) return 'Good match';
  if (composite >= 0.38) return 'Fair match';
  return 'Limited match';
}

type RowProps = {
  icon: keyof typeof Octicons.glyphMap;
  label: string;
  value: string;
  detail: string;
  rightAccessory?: React.ReactNode;
};

function MatchRow({
  icon,
  label,
  value,
  detail,
  rightAccessory,
}: RowProps): React.ReactElement {
  return (
    <RNView className="flex-row items-start gap-3">
      <Octicons
        name={icon}
        size={18}
        color={colors.accent[100]}
        style={{ marginTop: 2 }}
      />
      <RNView className="min-w-0 flex-1">
        <Text
          className="text-xs uppercase tracking-wide"
          style={{ color: colors.text[800] }}
        >
          {label}
        </Text>
        <RNView className="mt-1 flex-row flex-wrap items-center gap-2">
          <Text className="text-base text-white">{value}</Text>
          {rightAccessory}
        </RNView>
        <Text
          className="mt-0.5 text-xs leading-4"
          style={{ color: colors.text[800] }}
        >
          {detail}
        </Text>
      </RNView>
    </RNView>
  );
}

export type PlaceMatchContentProps = {
  breakdown: PlaceMatchBreakdown;
  isCollabPending: boolean;
  isCollabEnabled: boolean;
  collabError: boolean;
};

export function PlaceMatchContent({
  breakdown: b,
  isCollabPending,
  isCollabEnabled,
  collabError,
}: PlaceMatchContentProps): React.ReactElement {
  const w = b.weights;
  const tasteRaw = b.content ?? 0;
  const collabRaw = b.collaborative;

  return (
    <View className="mb-6 rounded-2xl bg-neutral-850 p-5">
      <Text className="font-interSemiBold text-lg text-white">
        Match for you
      </Text>
      <Text className="mt-1 text-2xl text-accent-100">
        {pct01(b.composite)} · {matchLabel(b.composite)}
      </Text>
      <Text
        className="mt-2 text-xs leading-5"
        style={{ color: colors.text[800] }}
      >
        Total uses quality ({Math.round(w.quality * 100)}%), distance (
        {Math.round(w.distance * 100)}%), and personalization (
        {Math.round(w.personalization * 100)}%), matching Explore
        recommendations.
      </Text>

      <RNView className="mt-5 gap-4">
        <MatchRow
          icon="star-fill"
          label="Quality"
          value={pct01(b.quality)}
          detail={`Adds ${pct01(b.weightedQuality)} to the total (Bayesian rating)`}
        />
        <MatchRow
          icon="north-star"
          label="Distance"
          value={pct01(b.distance)}
          detail={`Adds ${pct01(b.weightedDistance)} to the total (closer is better)`}
        />
        <MatchRow
          icon="heart-fill"
          label="Taste match"
          value={pct01(tasteRaw)}
          detail="Type similarity vs places you liked (TF–IDF cosine)"
        />
        <MatchRow
          icon="people"
          label="Community"
          value={
            isCollabEnabled && isCollabPending
              ? '…'
              : collabError
                ? '—'
                : collabRaw != null && collabRaw > 0
                  ? pct01(collabRaw)
                  : '—'
          }
          detail={
            collabError
              ? 'Could not load overlap with similar users.'
              : isCollabEnabled && isCollabPending
                ? 'Loading…'
                : collabRaw != null && collabRaw > 0
                  ? 'Overlap between users who liked your picks and this place'
                  : isCollabEnabled
                    ? 'No community overlap found for this place yet.'
                    : 'Sign in to include community similarity with other users.'
          }
          rightAccessory={
            isCollabEnabled && isCollabPending ? (
              <ActivityIndicator size="small" color={colors.accent[100]} />
            ) : undefined
          }
        />
        <MatchRow
          icon="light-bulb"
          label="Personalization (combined)"
          value={pct01(b.personalization)}
          detail={`Adds ${pct01(b.weightedPersonal)} to the total (blends taste + community)`}
        />
      </RNView>
    </View>
  );
}
