import Octicons from '@expo/vector-icons/Octicons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View as RNView } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  FadeOutUp,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, Text, View } from '@/components/ui';
import type { PlaceRating } from '@/lib/place-preferences';
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

const RATING_META: Record<
  PlaceRating,
  { label: string; effect: string; color: string }
> = {
  up: { label: 'Like', effect: '+10%', color: colors.success[500] },
  neutral: { label: 'Okay', effect: '-5%', color: colors.warning[500] },
  down: { label: 'Nah', effect: '-20%', color: colors.danger[500] },
};

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
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: colors.accent[100] }}
        >
          {label}
        </Text>
        <RNView className="mt-1 flex-row flex-wrap items-center gap-2">
          <Text className="text-lg font-bold text-white">{value}</Text>
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
  isRecalculating?: boolean;
};

function AnimatedCounter({ target }: { target: number }): React.ReactElement {
  const shared = useSharedValue(target);
  const [display, setDisplay] = useState(target);
  const prevTarget = useRef(target);

  useEffect(() => {
    if (prevTarget.current !== target) {
      prevTarget.current = target;
      shared.value = withTiming(target, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [target, shared]);

  useAnimatedReaction(
    () => Math.round(shared.value),
    (cur, prev) => {
      if (cur !== prev) runOnJS(setDisplay)(cur);
    }
  );

  return (
    <Text className="font-interSemiBold text-3xl text-white">{display}%</Text>
  );
}

function AnimatedScore({
  composite,
}: {
  composite: number;
}): React.ReactElement {
  const pct = Math.round(Math.max(0, Math.min(1, composite)) * 100);
  const label = matchLabel(composite);

  return (
    <RNView className="mt-1 flex-row items-center">
      <AnimatedCounter target={pct} />
      <Text className="font-interSemiBold text-3xl text-white"> · </Text>
      <Animated.View
        key={label}
        entering={FadeInUp.duration(300)}
        exiting={FadeOutUp.duration(200)}
      >
        <Text className="font-interSemiBold text-3xl text-white">{label}</Text>
      </Animated.View>
    </RNView>
  );
}

function SelfRatingRow({
  rating,
}: {
  rating: PlaceRating | undefined;
}): React.ReactElement | null {
  const meta = rating ? RATING_META[rating] : null;

  return (
    <RNView className="flex-row items-start gap-3">
      <Octicons
        name="thumbsup"
        size={18}
        color={colors.accent[100]}
        style={{ marginTop: 2 }}
      />
      <RNView className="min-w-0 flex-1">
        <Text
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: colors.accent[100] }}
        >
          Your rating
        </Text>
        <Animated.View
          key={rating ?? 'none'}
          entering={FadeInUp.duration(300)}
          exiting={FadeOutUp.duration(200)}
        >
          <RNView className="mt-1 flex-row flex-wrap items-center gap-2">
            <Text className="text-lg font-bold text-white">
              {meta ? meta.label : '—'}
            </Text>
            {meta ? (
              <Text
                className="text-sm font-semibold"
                style={{ color: meta.color }}
              >
                {meta.effect}
              </Text>
            ) : null}
          </RNView>
          <Text
            className="mt-0.5 text-xs leading-4"
            style={{ color: colors.text[800] }}
          >
            {meta
              ? `Your rating adjusts the score by ${meta.effect}`
              : 'Rate this place to adjust your match score'}
          </Text>
        </Animated.View>
      </RNView>
    </RNView>
  );
}

export function PlaceMatchContent({
  breakdown: b,
  isCollabPending,
  isCollabEnabled,
  collabError,
  isRecalculating = false,
}: PlaceMatchContentProps): React.ReactElement {
  const w = b.weights;
  const tasteRaw = b.content ?? 0;
  const collabRaw = b.collaborative;
  const dietaryWeight = w.dietary;
  const hasDietaryWeight = dietaryWeight !== undefined;

  const factorSummary = hasDietaryWeight
    ? `quality (${Math.round(w.quality * 100)}%), distance (${Math.round(w.distance * 100)}%), personalization (${Math.round(w.personalization * 100)}%), and dietary fit (${Math.round(dietaryWeight * 100)}%)`
    : `quality (${Math.round(w.quality * 100)}%), distance (${Math.round(w.distance * 100)}%), and personalization (${Math.round(w.personalization * 100)}%)`;

  return (
    <RNView className="mb-6">
      <View className="rounded-2xl bg-neutral-850 p-5">
        <RNView style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text className="text-sm" style={{ color: colors.text[800] }}>
            Match for you
          </Text>
          {isRecalculating ? (
            <ActivityIndicator
              size="small"
              color={colors.accent[100]}
              style={{ position: 'absolute', right: 0 }}
            />
          ) : null}
        </RNView>
        <AnimatedScore composite={b.composite} />
        <Text
          className="mt-2 text-xs leading-5"
          style={{ color: colors.text[800] }}
        >
          Based on {factorSummary}.
        </Text>

        <RNView className="mt-5 gap-4">
          <MatchRow
            icon="star-fill"
            label="Quality"
            value={pct01(b.quality)}
            detail={`Adds ${pct01(b.weightedQuality)} — based on ratings and reviews`}
          />
          <MatchRow
            icon="location"
            label="Distance"
            value={pct01(b.distance)}
            detail={`Adds ${pct01(b.weightedDistance)} — closer places score higher`}
          />
          <MatchRow
            icon="heart-fill"
            label="Taste match"
            value={pct01(tasteRaw)}
            detail="How similar this place is to the types of places you like"
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
                ? 'Could not load community data right now.'
                : isCollabEnabled && isCollabPending
                  ? 'Finding people with similar taste…'
                  : collabRaw != null && collabRaw > 0
                    ? 'People who like similar places also enjoy this one'
                    : isCollabEnabled
                      ? 'Not enough community data for this place yet.'
                      : 'Finding people with similar taste…'
            }
            rightAccessory={
              isCollabEnabled && isCollabPending ? (
                <ActivityIndicator size="small" color={colors.accent[100]} />
              ) : undefined
            }
          />
          <MatchRow
            icon="light-bulb"
            label="Personalization"
            value={pct01(b.personalization)}
            detail={`Adds ${pct01(b.weightedPersonal)} — combines your taste and community signals`}
          />
          <MatchRow
            icon="person"
            label="Dietary fit"
            value={
              b.dietaryIncludedInComposite && b.dietary !== null
                ? pct01(b.dietary)
                : '—'
            }
            detail={
              b.dietaryIncludedInComposite && b.dietary !== null
                ? `Adds ${pct01(b.weightedDietary ?? 0)} — matches your dietary preferences`
                : 'No dietary info available for this place.'
            }
          />
          <SelfRatingRow rating={b.selfRating} />
        </RNView>
      </View>
    </RNView>
  );
}
