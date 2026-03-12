import { Octicons } from '@expo/vector-icons';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  type CameraType,
  CameraView,
  type FlashMode,
  type PermissionResponse,
  useCameraPermissions,
} from 'expo-camera';
import { router, Stack } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text as RText,
  View as RView,
} from 'react-native';
import { v4 as uuidv4 } from 'uuid';

import { extractReceiptInfo } from '@/api/camera-receipt/extract-receipt-info';
import {
  Button,
  Pressable,
  Text as CustomText,
  View as CustomView,
} from '@/components/ui';
import { white } from '@/components/ui/colors';
import { useExpenseCreation } from '@/lib/store';
import { useThemeConfig } from '@/lib/use-theme-config';
import { parseReceiptInfo } from '@/lib/utils';
import { type ItemIdT, type ItemWithId } from '@/types';

// TODO: add ability to pick reciept pic from galery
export default function ReceiptCameraScreen() {
  const theme = useThemeConfig();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('auto');
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const { addItem, clearTempExpenseItems } = useExpenseCreation();

  if (!permission) {
    return (
      <CustomView className="bg-background-50 flex-1 items-center justify-center px-6 pb-24 dark:bg-background-950">
        <ActivityIndicator size="large" color="white" />
      </CustomView>
    );
  }

  if (!permission.granted) {
    return <RequestCameraPermission requestPermission={requestPermission} />;
  }

  function toggleCameraFacing() {
    setFacing(facing === 'back' ? 'front' : 'back');
  }
  function toggleFlash() {
    setFlash(flash === 'off' ? 'on' : 'off');
  }

  function getFlashIconProps() {
    if (flash === 'off') {
      return 'flash-off-outline';
    } else {
      return 'flash-outline';
    }
  }
  // Get icon properties for current flash mode
  const flashIcon = getFlashIconProps();

  async function handleCapture() {
    if (!cameraRef.current) return;
    try {
      setLoading(true);
      // 1. Take a photo and get base64 data for upload
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.4,
      });

      const base64Image = photo.base64;
      // 2. Send POST to Gemini
      const result = await extractReceiptInfo(base64Image ?? '');
      console.log(result);
      if (!result) {
        Alert.alert('Failed to process image', 'No response from AI service');
        setLoading(false);
        return;
      }
      const parsedResult = parseReceiptInfo(result);
      if (!parsedResult) {
        Alert.alert('Failed to process image', 'No response from AI service');
        setLoading(false);
        return;
      }
      if (parsedResult.error) {
        console.log(parsedResult.error);
        Alert.alert('Failed to process image: ' + parsedResult.error.message);
        setLoading(false);
        return;
      }
      console.log(parsedResult.data);
      // set temp items to this
      const items: ItemWithId[] = parsedResult.data.map((item) => ({
        id: uuidv4() as ItemIdT,
        name: item.dish,
        amount: item.price,
        split: {
          mode: 'equal',
          shares: {},
        },
        assignedPersonIds: [],
      }));
      // empty the temp items
      clearTempExpenseItems();
      // add the new items
      items.forEach((item) => {
        addItem(item);
      });
      setLoading(false);
      router.back();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      Alert.alert('Failed to process image: ' + errorMessage);
      setLoading(false);
    }
  }

  return (
    <RView className="flex-1">
      {loading && <LoadingModal loading={loading} />}
      <CustomView className="flex-row items-center justify-between">
        <Stack.Screen
          options={{
            title: '',
            headerShadowVisible: false,
            headerTitleStyle: {
              fontSize: 24,
              fontWeight: 'bold',
            },
            headerLeft: () => (
              <Pressable onPress={() => router.back()}>
                <Octicons
                  className="mr-2"
                  name="x"
                  color={theme.dark ? 'white' : 'black'}
                  size={24}
                />
              </Pressable>
            ),
          }}
        />
        <CustomView className="flex-row items-center justify-between px-4 py-2">
          <CustomText className="flex-1 text-center font-futuraBold text-4xl dark:text-text-50">
            Receipt Camera
          </CustomText>
        </CustomView>
      </CustomView>
      <CustomView className="w-11/12 flex-row items-center justify-between self-center rounded-2xl bg-background-900 px-6 py-5">
        <Pressable
          className="items-center justify-center"
          onPress={toggleCameraFacing}
        >
          <Ionicons name="camera-reverse-outline" size={24} color="white" />
        </Pressable>
        <Pressable
          className="items-center justify-center"
          onPress={toggleFlash}
        >
          <Ionicons name={flashIcon} size={24} color="white" />
        </Pressable>
      </CustomView>
      <CustomView className="flex-1 items-center justify-center p-2">
        <CustomView className="aspect-[3/4] w-11/12">
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
            flash={flash}
          />
        </CustomView>
      </CustomView>
      <CustomView className="justify-center px-5 py-10 pt-2">
        <Button
          className="min-h-12"
          label="Capture Reciept"
          icon={<Ionicons name="camera-reverse-outline" size={20} />}
          onPress={() => {
            handleCapture();
          }}
        />
        <Button
          className="min-h-12"
          label="Enter Manually"
          icon={<Ionicons name="pencil-outline" size={20} color={white} />}
          onPress={() => {
            router.back();
          }}
          variant="outline"
        />
      </CustomView>
    </RView>
  );
}

type RequestCameraPermissionProps = {
  requestPermission: () => Promise<PermissionResponse>;
};

function RequestCameraPermission({
  requestPermission,
}: RequestCameraPermissionProps) {
  const theme = useThemeConfig();
  return (
    <CustomView className="bg-background-50 flex-1 items-center justify-center px-6 pb-24 dark:bg-background-950">
      <Stack.Screen
        options={{
          title: '',
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <Octicons
                className="mr-2"
                name="x"
                color={theme.dark ? 'white' : 'black'}
                size={24}
              />
            </Pressable>
          ),
        }}
      />
      <CustomView className="items-center justify-center">
        <CustomView className="bg-background-200 dark:bg-background-800 mb-8 items-center justify-center rounded-full p-8">
          <Ionicons
            name="camera-outline"
            size={64}
            color={theme.dark ? 'white' : 'black'}
          />
        </CustomView>
        <CustomText className="mb-4 text-center font-futuraBold text-3xl text-black dark:text-text-50">
          Camera Access Required
        </CustomText>
        <CustomText className="mb-8 text-center font-inter text-base leading-6 text-neutral-600 dark:text-neutral-400">
          We need access to your camera to capture receipt photos. This helps us
          automatically extract expense information for you.
        </CustomText>
        <Button
          label="Allow Camera Access"
          icon={<Ionicons name="camera-outline" size={20} color="black" />}
          onPress={requestPermission}
          size="lg"
        />
      </CustomView>
    </CustomView>
  );
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
});

function LoadingModal({ loading }: { loading: boolean }) {
  return (
    <Modal visible={loading} transparent animationType="fade">
      <RView className="absolute inset-0 z-[99] flex-1 items-center justify-center bg-black/50">
        <RView className="min-w-[220px] items-center rounded-2xl bg-background-950 p-6">
          <ActivityIndicator size="large" color="white" />
          <RText className="mt-3 text-base font-bold text-white">
            Uploading and processing...
          </RText>
        </RView>
      </RView>
    </Modal>
  );
}
