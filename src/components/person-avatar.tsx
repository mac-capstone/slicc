import Octicons from '@expo/vector-icons/Octicons';
import { Circle, Path, Svg } from 'react-native-svg';

import { useUser } from '@/api/people/use-users';
import { colors, Image, View } from '@/components/ui';
import { cn } from '@/lib/utils';
import { type UserIdT } from '@/types';

const SIZE_CLASSES = {
  sm: 'size-6',
  md: 'size-8',
  lg: 'size-12',
} as const;

const ICON_SIZES = { sm: 12, md: 15, lg: 24 } as const;

type PersonAvatarProps = {
  userId?: UserIdT;
  color?: keyof typeof colors.avatar;
  size?: 'sm' | 'md' | 'lg';
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
  const { data: user } = useUser({
    variables: userId!,
    enabled: !!userId,
  });

  const photoURL = user?.photoURL;
  const avatarColor = colors.avatar?.[color ?? 'white'] ?? colors.avatar.white;

  const checkmarkSize = size === 'sm' ? 10 : size === 'md' ? 14 : 18;
  const checkmarkCircleRadius = checkmarkSize / 2;
  const checkmarkStrokeWidth = checkmarkSize * 0.1;

  return (
    <View
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-full',
        SIZE_CLASSES[size],
        inSplitView && !isSelected ? 'opacity-65' : 'opacity-100'
      )}
      style={photoURL ? undefined : { backgroundColor: avatarColor }}
    >
      {photoURL ? (
        <Image
          source={{ uri: photoURL }}
          className="size-full"
          contentFit="cover"
        />
      ) : (
        <Octicons name="person" size={ICON_SIZES[size]} color="#D4D4D4" />
      )}
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
