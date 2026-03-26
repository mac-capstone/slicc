import { useQuery } from '@tanstack/react-query';
import { Circle, Path, Svg } from 'react-native-svg';

import { useUser } from '@/api/people/use-users';
import { getProfilePictureUrl } from '@/api/people/user-api';
import { colors, Image, Text, View } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { type UserIdT } from '@/types';

/** Use `personAvatarColorForIndex(i)` in lists so avatars cycle through the palette. */
export const PERSON_AVATAR_COLOR_KEYS = Object.keys(
  colors.avatar ?? {}
) as (keyof typeof colors.avatar)[];

export function personAvatarColorForIndex(
  index: number
): keyof typeof colors.avatar {
  const keys = PERSON_AVATAR_COLOR_KEYS;
  if (keys.length === 0) return 'white';
  return keys[index % keys.length]!;
}

const SIZE_CLASSES = {
  sm: 'size-6',
  md: 'size-8',
  lg: 'size-12',
} as const;

const PRESET_PX = { sm: 24, md: 32, lg: 48 } as const;

export type PersonAvatarSize = keyof typeof SIZE_CLASSES | number;

function pixelSize(size: PersonAvatarSize): number {
  return typeof size === 'number' ? size : PRESET_PX[size];
}

function labelFontSize(px: number): number {
  return Math.max(10, Math.round(px * 0.42));
}

/** First meaningful character for display name, else username, else placeholder. */
export function userInitialsLabel(
  displayName?: string,
  username?: string
): string {
  const raw = displayName?.trim() || username?.trim();
  if (!raw) return '?';
  return raw.charAt(0).toUpperCase();
}

type PersonAvatarProps = {
  userId?: UserIdT;
  /** When set, used as the fallback letter if profile is still loading or missing name. */
  fallbackLabel?: string;
  color?: keyof typeof colors.avatar;
  size?: PersonAvatarSize;
  isSelected?: boolean;
  inSplitView?: boolean;
};

export const PersonAvatar = ({
  userId,
  fallbackLabel,
  color,
  size = 'md',
  isSelected = false,
  inSplitView = false,
}: PersonAvatarProps) => {
  const viewerUserId = useAuth.use.userId() ?? null;
  const px = pixelSize(size);
  const isNumericSize = typeof size === 'number';

  const { data: storagePhotoURL } = useQuery({
    queryKey: ['users', 'profile-picture', userId],
    queryFn: () => getProfilePictureUrl(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: user } = useUser({
    variables: { userId: userId!, viewerUserId },
    enabled: Boolean(userId),
  });

  const photoURL = storagePhotoURL ?? null;
  const avatarColor = colors.avatar?.[color ?? 'white'] ?? colors.avatar.white;

  const fromProfile = userInitialsLabel(user?.displayName, user?.username);
  const letter =
    fromProfile !== '?'
      ? fromProfile
      : fallbackLabel?.trim()
        ? fallbackLabel.trim().charAt(0).toUpperCase()
        : '?';

  const checkmarkSize = px < 28 ? 10 : px < 40 ? 14 : 18;
  const checkmarkCircleRadius = checkmarkSize / 2;
  const checkmarkStrokeWidth = checkmarkSize * 0.1;

  const outerStyle = isNumericSize
    ? { width: px, height: px, borderRadius: px / 2 }
    : undefined;

  return (
    <View
      className={cn(
        'relative',
        !isNumericSize ? SIZE_CLASSES[size as keyof typeof SIZE_CLASSES] : '',
        inSplitView && !isSelected ? 'opacity-65' : 'opacity-100'
      )}
      style={outerStyle}
    >
      <View
        className="size-full items-center justify-center overflow-hidden rounded-full"
        style={photoURL ? undefined : { backgroundColor: avatarColor }}
      >
        {photoURL ? (
          <Image
            source={{ uri: photoURL }}
            className="size-full"
            contentFit="cover"
          />
        ) : (
          <Text
            className="font-bold text-text-50"
            style={{
              fontSize: labelFontSize(px),
              lineHeight: labelFontSize(px) + 2,
            }}
          >
            {letter}
          </Text>
        )}
      </View>
      {isSelected && (
        <View className="absolute -right-1 -top-1">
          <Svg
            width={checkmarkSize}
            height={checkmarkSize}
            viewBox={`0 0 ${checkmarkSize} ${checkmarkSize}`}
          >
            <Circle
              cx={checkmarkCircleRadius}
              cy={checkmarkCircleRadius}
              r={checkmarkCircleRadius}
              fill="green"
            />
            <Path
              d={`M${checkmarkSize * 0.3} ${checkmarkSize * 0.5} L${checkmarkSize * 0.45} ${checkmarkSize * 0.65} L${checkmarkSize * 0.7} ${checkmarkSize * 0.4}`}
              stroke="#D4D4D4"
              strokeWidth={checkmarkStrokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </View>
      )}
    </View>
  );
};
