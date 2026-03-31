import Feather from '@expo/vector-icons/Feather';
import Octicons from '@expo/vector-icons/Octicons';
import * as React from 'react';
import { useState } from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';

import { colors } from '@/components/ui';

type Props = {
  onSend: (text: string) => void;
  isSending: boolean;
  disabled?: boolean;
};

export function ChatInput({ onSend, isSending, disabled }: Props) {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isSending || disabled) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <View
      className="flex-row items-end gap-2 border-t border-charcoal-800 bg-charcoal-900 p-2"
      style={{ paddingBottom: 16, backgroundColor: colors.charcoal[900] }}
    >
      <TouchableOpacity
        className="mb-1.5 size-10 items-center justify-center"
        accessibilityLabel="Attach image"
        accessibilityRole="button"
        disabled={disabled}
        style={{ opacity: disabled ? 0.35 : 1 }}
      >
        <Feather name="image" size={22} color={colors.accent[100]} />
      </TouchableOpacity>

      <View className="min-h-[44px] flex-1 justify-center rounded-full border border-charcoal-700 bg-charcoal-850 px-4 py-1">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message..."
          placeholderTextColor={colors.charcoal[400]}
          style={{ color: colors.white, fontSize: 15, maxHeight: 120 }}
          multiline
          returnKeyType="default"
          editable={!disabled}
        />
      </View>

      <TouchableOpacity
        onPress={handleSend}
        disabled={!text.trim() || isSending || disabled}
        className="mb-1 size-11 items-center justify-center rounded-full"
        style={{ opacity: !text.trim() || isSending || disabled ? 0.35 : 1 }}
        accessibilityLabel="Send message"
        accessibilityRole="button"
      >
        <Octicons name="paper-airplane" size={22} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}
