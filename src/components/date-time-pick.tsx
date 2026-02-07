import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Modal, Platform } from 'react-native';

import { Button, colors, Pressable, Text, View } from '@/components/ui';

interface DateTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  mode?: 'date' | 'time';
  label?: string;
  disabled?: boolean;
}

export const DateTimePick: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  mode = 'date',
  label,
  disabled = false,
}) => {
  const [show, setShow] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  // Sync tempValue when value prop changes externally
  React.useEffect(() => {
    if (!show) {
      setTempValue(value);
    }
  }, [value, show]);

  const handleChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
    }
    if (selectedDate) {
      setTempValue(selectedDate);
      if (Platform.OS === 'android') {
        onChange(selectedDate);
      }
    }
  };

  const handleConfirm = () => {
    onChange(tempValue);
    setShow(false);
  };

  const handleCancel = () => {
    setTempValue(value);
    setShow(false);
  };

  const formatValue = () => {
    if (mode === 'date') {
      return value.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } else {
      return value.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  };

  return (
    <>
      <Pressable onPress={() => !disabled && setShow(true)}>
        {label && <Text className="text-text-500 mb-1 text-sm">{label}</Text>}
        <Text className="text-base font-semibold dark:text-text-50">
          {formatValue()}
        </Text>
      </Pressable>

      {show && Platform.OS === 'ios' && (
        <Modal
          transparent
          animationType="slide"
          visible={show}
          onRequestClose={handleCancel}
        >
          <View className="flex-1 justify-end bg-black/50">
            <View className="bg-white dark:bg-background-900">
              <View className="flex-row justify-between border-b border-text-900 p-4">
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={handleCancel}
                  className="px-0"
                />
                <Button
                  label="Done"
                  variant="ghost"
                  onPress={handleConfirm}
                  className="px-0"
                />
              </View>
              <DateTimePicker
                value={tempValue}
                mode={mode}
                display="spinner"
                onChange={handleChange}
                textColor={colors.text[800]}
              />
            </View>
          </View>
        </Modal>
      )}

      {show && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempValue}
          mode={mode}
          display="default"
          onChange={handleChange}
        />
      )}
    </>
  );
};
