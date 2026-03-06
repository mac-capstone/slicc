import * as React from 'react';
import type {
  Control,
  FieldValues,
  Path,
  RegisterOptions,
} from 'react-hook-form';
import { useController } from 'react-hook-form';
import type { TextInputProps } from 'react-native';
import {
  I18nManager,
  StyleSheet,
  TextInput as NTextInput,
  View,
} from 'react-native';
import { tv } from 'tailwind-variants';

import colors from './colors';
import { Text } from './text';

const inputTv = tv({
  slots: {
    container: 'mb-2',
    label: 'text-grey-100 mb-1 text-lg dark:text-neutral-100',
    input:
      'mt-0 rounded-xl border border-neutral-200 bg-neutral-100 px-4 py-3 font-inter text-base font-semibold leading-5 dark:border-charcoal-600 dark:bg-background-900 dark:text-white',
  },

  variants: {
    focused: {
      true: {
        input: 'border-[0.5px] border-neutral-400 dark:border-accent-100',
      },
    },
    error: {
      true: {
        input: 'border-danger-600',
        label: 'text-danger-600 dark:text-danger-600',
      },
    },
    disabled: {
      true: {
        input: 'bg-neutral-200',
      },
    },
    raw: {
      true: {
        input:
          'm-0 rounded-none bg-transparent p-0 text-center dark:bg-transparent',
      },
    },
    compact: {
      true: {
        container: 'mb-0',
        input: 'h-10 rounded-lg py-0',
      },
    },
  },
  defaultVariants: {
    focused: false,
    error: false,
    disabled: false,
    raw: false,
    compact: false,
  },
});

export interface NInputProps extends TextInputProps {
  label?: string;
  disabled?: boolean;
  error?: string;
  /** Use raw style - no background, borders, or padding */
  raw?: boolean;
  /** Restrict input to monetary values (digits and single decimal point, 2 decimal places max) */
  money?: boolean;
  /** Use compact sizing - no bottom margin, shorter height */
  compact?: boolean;
  /** Tailwind classes for the outer container (View) */
  containerClassName?: string;
  /** Tailwind classes for the TextInput itself */
  inputClassName?: string;
}

type TRule<T extends FieldValues> =
  | Omit<
      RegisterOptions<T>,
      'disabled' | 'valueAsNumber' | 'valueAsDate' | 'setValueAs'
    >
  | undefined;

export type RuleType<T extends FieldValues> = { [name in keyof T]: TRule<T> };
export type InputControllerType<T extends FieldValues> = {
  name: Path<T>;
  control: Control<T>;
  rules?: RuleType<T>;
};

interface ControlledInputProps<T extends FieldValues>
  extends NInputProps, InputControllerType<T> {}

export const Input = React.forwardRef<NTextInput, NInputProps>((props, ref) => {
  const {
    label,
    error,
    testID,
    containerClassName,
    inputClassName,
    raw,
    money,
    compact,
    onChangeText,
    keyboardType,
    inputMode,
    ...inputProps
  } = props;
  const [isFocussed, setIsFocussed] = React.useState(false);
  const onBlur = React.useCallback(() => setIsFocussed(false), []);
  const onFocus = React.useCallback(() => setIsFocussed(true), []);

  const handleChangeText = React.useCallback(
    (text: string) => {
      if (money) {
        console.log('Raw input:', text);
        // Allow only digits and a single decimal point, max 2 decimal places
        const sanitized = text.replace(/[^0-9.]/g, '');
        // Prevent multiple decimal points
        const parts = sanitized.split('.');
        let result = parts[0];
        if (parts.length > 1) {
          result += '.' + parts[1].slice(0, 2);
        }
        console.log('Sanitized input:', result);
        onChangeText?.(result);
      } else {
        onChangeText?.(text);
      }
    },
    [money, onChangeText]
  );

  const styles = React.useMemo(
    () =>
      inputTv({
        error: Boolean(error),
        focused: isFocussed,
        disabled: Boolean(props.disabled),
        raw: Boolean(raw),
        compact: Boolean(compact),
      }),
    [error, isFocussed, props.disabled, raw, compact]
  );

  return (
    <View className={`${styles.container()} ${containerClassName ?? ''}`}>
      {label && (
        <Text
          testID={testID ? `${testID}-label` : undefined}
          className={styles.label()}
        >
          {label}
        </Text>
      )}
      <NTextInput
        testID={testID}
        ref={ref}
        placeholderTextColor={colors.neutral[400]}
        className={`${styles.input()} ${inputClassName ?? ''}`}
        {...inputProps}
        onBlur={onBlur}
        onFocus={onFocus}
        onChangeText={handleChangeText}
        keyboardType={money ? 'decimal-pad' : keyboardType}
        inputMode={money ? 'decimal' : inputMode}
        style={StyleSheet.flatten([
          { writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr' },
          { textAlign: I18nManager.isRTL ? 'right' : 'left' },
          inputProps.style,
        ])}
      />
      {error && (
        <Text
          testID={testID ? `${testID}-error` : undefined}
          className="text-sm text-danger-400 dark:text-danger-600"
        >
          {error}
        </Text>
      )}
    </View>
  );
});

// only used with react-hook-form
export function ControlledInput<T extends FieldValues>(
  props: ControlledInputProps<T>
) {
  const { name, control, rules, ...inputProps } = props;

  const { field, fieldState } = useController({ control, name, rules });
  return (
    <Input
      ref={field.ref}
      autoCapitalize="none"
      onChangeText={field.onChange}
      value={(field.value as string) || ''}
      {...inputProps}
      error={fieldState.error?.message}
    />
  );
}
