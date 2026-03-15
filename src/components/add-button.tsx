import React from 'react';

import { Button, colors } from '@/components/ui';

const BORDER_WIDTH_CLASSES: Record<number, string> = {
  1: 'border',
  1.2: 'border-[1.2px]',
  2: 'border-2',
};

const BORDER_COLOR_CLASSES: Record<string, string> = {
  [colors.white]: 'border-white',
  [colors.danger[500]]: 'border-danger-500',
};

type Props = {
  label: string;
  onPress: () => void;
  className?: string;
  borderColor?: string;
  borderWidth?: number;
  heightClassName?: string;
};

function getBorderClassName(borderColor: string, borderWidth: number): string {
  const widthClass =
    BORDER_WIDTH_CLASSES[borderWidth] ?? `border-[${borderWidth}px]`;
  const colorClass =
    BORDER_COLOR_CLASSES[borderColor] ?? `border-[${borderColor}]`;
  return `${widthClass} ${colorClass}`;
}

export function AddButton({
  label,
  onPress,
  className = '',
  borderColor = colors.white,
  borderWidth = 1,
  heightClassName = 'h-10',
}: Props) {
  const borderClassName = getBorderClassName(borderColor, borderWidth);

  return (
    <Button
      variant="custom-outline"
      onPress={onPress}
      className={`${heightClassName} ${borderClassName} ${className}`.trim()}
      label={label}
    />
  );
}
