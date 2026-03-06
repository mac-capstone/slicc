import React from 'react';

import { Button, colors } from '@/components/ui';

type Props = {
  label: string;
  onPress: () => void;
  className?: string;
  borderColor?: string;
  borderWidth?: number;
  heightClassName?: string;
};

export function AddButton({
  label,
  onPress,
  className = '',
  borderColor = colors.white,
  borderWidth = 1,
  heightClassName = 'h-10',
}: Props) {
  return (
    <Button
      variant="outline"
      onPress={onPress}
      className={`${heightClassName} ${className}`.trim()}
      style={{ borderColor, borderWidth }}
      label={label}
    />
  );
}
