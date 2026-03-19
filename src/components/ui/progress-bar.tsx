import React, { forwardRef, useEffect, useImperativeHandle } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { twMerge } from 'tailwind-merge';

import colors from './colors';

type Props = {
  initialProgress?: number;
  className?: string;
};

export type ProgressBarRef = {
  setProgress: (value: number) => void;
};

export const ProgressBar = forwardRef<ProgressBarRef, Props>(
  ({ initialProgress = 0, className = '' }, ref) => {
    const progress = useSharedValue<number>(initialProgress ?? 0);

    useEffect(() => {
      progress.value = withTiming(initialProgress ?? 0, {
        duration: 250,
        easing: Easing.inOut(Easing.quad),
      });
    }, [initialProgress, progress]);

    useImperativeHandle(ref, () => {
      return {
        setProgress: (value: number) => {
          progress.value = withTiming(value, {
            duration: 250,
            easing: Easing.inOut(Easing.quad),
          });
        },
      };
    }, [progress]);

    const style = useAnimatedStyle(() => {
      return {
        width: `${progress.value}%`,
        backgroundColor: colors.accent[100],
        height: 7,
        borderRadius: 100,
      };
    });
    return (
      <View
        className={twMerge(` bg-background-950 rounded-full h-2`, className)}
      >
        <Animated.View style={style} />
      </View>
    );
  }
);
