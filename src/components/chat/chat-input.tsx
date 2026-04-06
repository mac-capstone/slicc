import Feather from '@expo/vector-icons/Feather';
import Octicons from '@expo/vector-icons/Octicons';
import * as ImagePicker from 'expo-image-picker';
import * as React from 'react';
import { useState } from 'react';
import { Alert, TextInput, TouchableOpacity, View } from 'react-native';

import { colors, Image, Text } from '@/components/ui';

type PendingImage = {
  uri: string;
  mimeType: string;
  fileName: string;
};

type Props = {
  onSend: (text: string) => void;
  onSendImage: (args: {
    uri: string;
    mimeType: string;
    fileName: string;
    caption: string;
  }) => void;
  isSending: boolean;
  disabled?: boolean;
};

export function ChatInput({ onSend, onSendImage, isSending, disabled }: Props) {
  const [text, setText] = useState('');
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);

  const canSend = (!!text.trim() || !!pendingImage) && !isSending && !disabled;

  const handleSend = () => {
    if (!canSend) return;
    if (pendingImage) {
      onSendImage({
        uri: pendingImage.uri,
        mimeType: pendingImage.mimeType,
        fileName: pendingImage.fileName,
        caption: text.trim(),
      });
      setText('');
      setPendingImage(null);
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  const handlePickImage = async () => {
    if (disabled || isSending) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Please allow photo library access to send images.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const fileName =
      asset.fileName ??
      `image_${Date.now()}.${mimeType.includes('png') ? 'png' : 'jpg'}`;
    setPendingImage({ uri: asset.uri, mimeType, fileName });
  };

  return (
    <View
      className="border-t border-charcoal-800 bg-charcoal-900 p-2"
      style={{ paddingBottom: 16, backgroundColor: colors.charcoal[900] }}
    >
      {pendingImage ? (
        <View className="mb-2 flex-row items-center gap-2 px-1">
          <Image
            source={{ uri: pendingImage.uri }}
            style={{
              width: 56,
              height: 56,
              borderRadius: 10,
            }}
            contentFit="cover"
          />
          <Text
            className="flex-1 text-xs"
            style={{ color: colors.charcoal[400] }}
            numberOfLines={2}
          >
            Add a caption, then tap send
          </Text>
          <TouchableOpacity
            onPress={() => setPendingImage(null)}
            className="size-9 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.charcoal[850] }}
            accessibilityLabel="Remove attached image"
            accessibilityRole="button"
          >
            <Feather name="x" size={20} color={colors.charcoal[200]} />
          </TouchableOpacity>
        </View>
      ) : null}

      <View className="flex-row items-end gap-2">
        <TouchableOpacity
          onPress={handlePickImage}
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
          disabled={!canSend}
          className="mb-1 size-11 items-center justify-center rounded-full"
          style={{ opacity: canSend ? 1 : 0.35 }}
          accessibilityLabel="Send message"
          accessibilityRole="button"
        >
          <Octicons name="paper-airplane" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
