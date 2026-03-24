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
      className="m-1 flex-row items-end gap-2 border-t border-neutral-800 bg-background-950 px-3 py-2"
      style={{ paddingBottom: 8 }}
    >
      <View className="m-1 min-h-[40px] flex-1 justify-center rounded-2xl bg-background-900 px-4 py-2">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message…"
          placeholderTextColor={colors.text[800]}
          style={{ color: colors.text[50], fontSize: 15, maxHeight: 120 }}
          multiline
          returnKeyType="default"
          editable={!disabled}
        />
      </View>

      <TouchableOpacity
        onPress={handleSend}
        disabled={!text.trim() || isSending || disabled}
        className="mb-4 size-10 items-center justify-center rounded-full bg-primary-600"
        style={{ opacity: !text.trim() || isSending || disabled ? 0.4 : 1 }}
        accessibilityLabel="Send message"
        accessibilityRole="button"
      >
        <Octicons name="paper-airplane" size={18} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}
