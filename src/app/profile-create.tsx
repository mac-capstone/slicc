import Ionicons from '@expo/vector-icons/Ionicons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native';
import { z } from 'zod';

import { auth } from '@/api/common/firebase';
import {
  checkUsernameExists,
  createUserInFirestore,
  uploadProfilePicture,
  UserAlreadyExistsError,
} from '@/api/people/user-api';
import {
  Button,
  FocusAwareStatusBar,
  Image,
  Text,
  View,
} from '@/components/ui';
import { ControlledInput } from '@/components/ui/input';
import { useAuth } from '@/lib';

const profileFormSchema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
  username: z
    .string()
    .min(2, 'Username must be at least 2 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9._]+$/, 'Letters, numbers, dots and underscores only.'),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

export default function ProfileCreate() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth.use.userId();
  const status = useAuth.use.status();
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, handleSubmit, setError, setFocus } =
    useForm<ProfileFormData>({
      resolver: zodResolver(profileFormSchema),
      defaultValues: {
        displayName: '',
        username: '',
      },
    });

  useEffect(() => {
    if (status === 'signOut') {
      router.replace('/login');
    }
  }, [status, router]);

  const pickImage = useCallback(async (): Promise<void> => {
    const { status: permStatus } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permStatus !== 'granted') {
      Alert.alert(
        'Permission required',
        'Please grant photo library access to add a profile picture.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setProfileImageUri(result.assets[0].uri);
    }
  }, []);

  const onSubmit = useCallback(
    async (data: ProfileFormData): Promise<void> => {
      if (!userId || status !== 'signIn') {
        router.replace('/login');
        return;
      }

      setIsSubmitting(true);

      try {
        const usernameTaken = await checkUsernameExists(data.username);

        if (usernameTaken) {
          setError('username', {
            message: 'This username is already taken',
          });
          setFocus('username');
          setIsSubmitting(false);
          return;
        }

        if (profileImageUri) {
          try {
            await uploadProfilePicture(userId, profileImageUri);
          } catch {}
        }

        const userEmail = auth.currentUser?.email;
        if (!userEmail) {
          Alert.alert(
            'Missing email',
            'Unable to read your account email. Please sign in again.'
          );
          return;
        }

        await createUserInFirestore(userId, {
          displayName: data.displayName,
          username: data.username,
        });

        queryClient.setQueryData(['userExists', userId], true);
        await queryClient.invalidateQueries({
          queryKey: ['userExists', userId],
        });

        router.replace('/(app)');
      } catch (error) {
        if (error instanceof UserAlreadyExistsError) {
          queryClient.setQueryData(['userExists', userId], true);
          await queryClient.invalidateQueries({
            queryKey: ['userExists', userId],
          });
          router.replace('/(app)');
          return;
        }

        Alert.alert('Error', 'Failed to create profile. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [userId, status, profileImageUri, router, setError, setFocus, queryClient]
  );

  if (status === 'idle' || !userId) {
    return (
      <View className="flex-1 items-center justify-center bg-background-950">
        <Text className="text-white">Loading profile setup...</Text>
      </View>
    );
  }

  if (status === 'signOut') {
    return (
      <View className="flex-1 items-center justify-center bg-background-950">
        <Text className="text-white">Redirecting...</Text>
      </View>
    );
  }

  return (
    <>
      <FocusAwareStatusBar />
      <Stack.Screen
        options={{
          title: 'Set Up Profile',
          headerShown: true,
          headerBackVisible: false,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#1A1A1A' },
          headerTitleStyle: {
            color: '#ffffff',
            fontFamily: 'FuturaCyrillicBold',
            fontSize: 18,
          },
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-background-950"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-6 pt-6">
            <View className="mb-8 items-center">
              <Pressable
                onPress={pickImage}
                accessibilityLabel="Add profile picture"
                accessibilityRole="button"
                className="relative"
              >
                {profileImageUri ? (
                  <Image
                    source={{ uri: profileImageUri }}
                    className="size-32 rounded-full"
                    contentFit="cover"
                  />
                ) : (
                  <View className="size-32 items-center justify-center rounded-full bg-charcoal-800">
                    <Ionicons name="person-outline" size={64} color="#969696" />
                  </View>
                )}
                <View className="absolute bottom-0 right-0 size-10 items-center justify-center rounded-full bg-accent-100">
                  <Ionicons name="camera-outline" size={20} color="#000000" />
                </View>
              </Pressable>
              <Text className="mt-2 text-sm text-charcoal-400">
                Tap to add a photo.
              </Text>
            </View>

            <View className="gap-4">
              <ControlledInput
                name="username"
                control={control}
                label="Username"
                placeholder="@yourname."
                hint="Letters, numbers, dots and underscores only."
                autoCapitalize="none"
                autoCorrect={false}
              />
              <ControlledInput
                name="displayName"
                control={control}
                label="Display Name"
                placeholder="How others will see you."
                autoCapitalize="words"
              />
            </View>

            <View className="mt-auto py-8">
              <Button
                label="Save Profile"
                onPress={handleSubmit(onSubmit)}
                loading={isSubmitting}
                disabled={isSubmitting}
                className="bg-accent-100"
                textClassName="text-white"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
