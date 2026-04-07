import Octicons from '@expo/vector-icons/Octicons';
import { useQuery } from '@tanstack/react-query';
import { Circle, Path, Svg } from 'react-native-svg';

import { getProfilePictureUrl } from '@/api/people/user-api';
import { colors, Image, View } from '@/components/ui';
import { cn } from '@/lib/utils';
import { type UserIdT } from '@/types';

const SIZE_CLASSES = {
  sm: 'size-6',
  md: 'size-8',
  lg: 'size-12',
} as const;

const ICON_SIZES = { sm: 12, md: 15, lg: 24 } as const;

type NamedSize = 'sm' | 'md' | 'lg';

type PersonAvatarProps = {
  userId?: UserIdT;
  color?: keyof typeof colors.avatar;
  size?: NamedSize | number;
  isSelected?: boolean;
  inSplitView?: boolean;
};

export const PersonAvatar = ({
  userId,
  color,
  size = 'md',
  isSelected = false,
  inSplitView = false,
}: PersonAvatarProps) => {
  const isNumericSize = typeof size === 'number';
  const numericPx = isNumericSize ? size : undefined;
  const namedSize: NamedSize = isNumericSize ? 'md' : size;
  const { data: storagePhotoURL } = useQuery({
    queryKey: ['users', 'profile-picture', userId],
    queryFn: () => getProfilePictureUrl(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });

  const photoURL = storagePhotoURL ?? null;
  const avatarColor = colors.avatar?.[color ?? 'white'] ?? colors.avatar.white;

  const checkmarkSize = namedSize === 'sm' ? 10 : namedSize === 'md' ? 14 : 18;
  const checkmarkCircleRadius = checkmarkSize / 2;
  const checkmarkStrokeWidth = checkmarkSize * 0.1;

  return (
    <View
      className={cn(
        'relative',
        isNumericSize ? '' : SIZE_CLASSES[namedSize],
        inSplitView && !isSelected ? 'opacity-65' : 'opacity-100'
      )}
      style={
        isNumericSize ? { width: numericPx, height: numericPx } : undefined
      }
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
          <Octicons
            name="person"
            size={
              isNumericSize
                ? Math.round((numericPx ?? 32) * 0.5)
                : ICON_SIZES[namedSize]
            }
            color={colors.neutral[300]}
          />
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
