import Octicons from '@expo/vector-icons/Octicons';
import { ActivityIndicator } from 'react-native';
import { Circle, Path, Svg } from 'react-native-svg';

import { useEventParticipant } from '@/api/events/use-events';
import { usePerson } from '@/api/people/use-people';
import { colors, Text, View } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  type EventIdT,
  type ExpenseIdT,
  type PersonIdT,
  type UserIdT,
} from '@/types';

type PersonAvatarPropsWithExpense = {
  size?: 'sm' | 'md' | 'lg';
  personId: PersonIdT;
  expenseId: ExpenseIdT;
  eventId?: never;
  userId?: never;
  inSplitView?: boolean;
  isSelected?: boolean;
};

type PersonAvatarPropsWithEvent = {
  size?: 'sm' | 'md' | 'lg';
  userId: UserIdT;
  eventId: EventIdT;
  personId?: never;
  expenseId?: never;
  inSplitView?: boolean;
  isSelected?: boolean;
};

type PersonAvatarProps =
  | PersonAvatarPropsWithExpense
  | PersonAvatarPropsWithEvent;

export const PersonAvatar = ({
  size = 'md',
  personId,
  expenseId,
  eventId,
  userId,
  isSelected = false,
  inSplitView = false,
}: PersonAvatarProps) => {
  // Use the appropriate hook based on whether we have expenseId or eventId
  const personQuery = usePerson({
    variables: expenseId && personId ? { expenseId, personId } : undefined,
    enabled: !!expenseId && !!personId,
  });

  const participantQuery = useEventParticipant({
    variables: eventId && userId ? { eventId, userId } : undefined,
    enabled: !!eventId && !!userId,
  });

  const { data, isPending, isError } = expenseId
    ? personQuery
    : participantQuery;

  if (isPending) {
    return <ActivityIndicator />;
  }
  if (isError) {
    return <Text>Error loading person</Text>;
  }
  const avatarColor =
    colors.avatar?.[data.color as keyof typeof colors.avatar] ??
    colors.avatar.white;

  const checkmarkSize = size === 'sm' ? 10 : size === 'md' ? 14 : 18;
  const checkmarkCircleRadius = checkmarkSize / 2;
  const checkmarkStrokeWidth = checkmarkSize * 0.1;

  return (
    <View
      className={cn(
        'flex items-center justify-center rounded-full relative',
        size === 'sm' ? 'size-6' : size === 'md' ? 'size-8' : 'size-12',
        inSplitView
          ? isSelected
            ? 'opacity-100'
            : 'opacity-65'
          : 'opacity-100'
      )}
      style={{ backgroundColor: avatarColor }}
    >
      <Octicons
        name="person"
        size={size === 'sm' ? 12 : size === 'md' ? 15 : 24}
        color="#D4D4D4"
      />
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
