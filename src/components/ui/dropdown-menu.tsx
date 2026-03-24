/**
 * Styled wrappers for @rn-primitives/dropdown-menu (react-native-reusables pattern).
 * Requires <PortalHost /> in the app root — see `src/app/_layout.tsx`.
 */
import * as DropdownMenuPrimitive from '@rn-primitives/dropdown-menu';
import * as React from 'react';
import { Platform, StyleSheet } from 'react-native';

import { cn } from '@/lib/utils';

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

function DropdownMenuOverlay({
  className,
  ...props
}: React.ComponentProps<
  typeof DropdownMenuPrimitive.Overlay
>): React.ReactElement {
  return (
    <DropdownMenuPrimitive.Overlay
      style={Platform.OS === 'web' ? undefined : StyleSheet.absoluteFillObject}
      className={cn(
        Platform.OS === 'web'
          ? 'fixed inset-0 z-50 bg-black/40'
          : 'bg-black/40',
        className ?? ''
      )}
      {...props}
    />
  );
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<
  typeof DropdownMenuPrimitive.Content
>): React.ReactElement {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuOverlay />
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[6rem] overflow-hidden rounded-lg border border-charcoal-600 bg-charcoal-950 py-1 shadow-md',
          className ?? ''
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

const DropdownMenuItem = DropdownMenuPrimitive.Item;

const DropdownMenuCheckboxItem = DropdownMenuPrimitive.CheckboxItem;

const DropdownMenuItemIndicator = DropdownMenuPrimitive.ItemIndicator;

const DropdownMenuSeparator = DropdownMenuPrimitive.Separator;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuLabel = DropdownMenuPrimitive.Label;

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuOverlay,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
