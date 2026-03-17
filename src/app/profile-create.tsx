import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { z } from 'zod';

import {
  checkUsernameExists,
  createUserInFirestore,
  uploadProfilePicture,
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
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Username can only contain letters, numbers, and underscores'
    ),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

export default function ProfileCreate() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth.use.userId();
  const status = useAuth.use.status();
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, handleSubmit, setError } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: '',
      username: '',
    },
  });

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
          setError('username', { message: 'This username is already taken' });
          setIsSubmitting(false);
          return;
        }

        let photoURL: string | null = null;
        if (profileImageUri) {
          try {
            photoURL = await uploadProfilePicture(userId, profileImageUri);
          } catch (uploadError) {
            console.warn(
              'Profile picture upload failed, continuing without:',
              uploadError
            );
          }
        }

        await createUserInFirestore(userId, {
          displayName: data.displayName,
          username: data.username,
          photoURL,
        });

        await queryClient.invalidateQueries({
          queryKey: ['userExists', userId],
        });
        router.replace('/(app)');
      } catch (error) {
        console.error('Profile creation failed:', error);
        Alert.alert('Error', 'Failed to create profile. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [userId, status, profileImageUri, router, setError, queryClient]
  );

  if (status === 'signOut') {
    router.replace('/login');
    return null;
  }

  if (status === 'idle' || !userId) {
    return null;
  }

  return (
    <>
      <FocusAwareStatusBar />
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
          <View className="flex-1 px-6 pt-12">
            <Text className="mb-2 font-futuraBold text-3xl text-white">
              Create your profile
            </Text>
            <Text className="mb-8 text-charcoal-400">
              Add a photo and choose how you will appear to others
            </Text>

            <View className="mb-8 items-center">
              <Button
                variant="ghost"
                onPress={pickImage}
                className="mb-2"
                accessibilityLabel="Add profile picture"
                accessibilityRole="button"
              >
                {profileImageUri ? (
                  <Image
                    source={{ uri: profileImageUri }}
                    className="size-24 rounded-full"
                    contentFit="cover"
                  />
                ) : (
                  <View className="size-24 items-center justify-center rounded-full bg-charcoal-800">
                    <Text className="text-4xl text-charcoal-400">+</Text>
                  </View>
                )}
              </Button>
              <Text className="text-sm text-charcoal-400">
                {profileImageUri
                  ? 'Change photo'
                  : 'Add profile picture (optional)'}
              </Text>
            </View>

            <View className="gap-4">
              <ControlledInput
                name="displayName"
                control={control}
                label="Display name"
                placeholder="How should we call you?"
                autoCapitalize="words"
              />
              <ControlledInput
                name="username"
                control={control}
                label="Username"
                placeholder="Choose a unique username"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View className="mt-auto py-8">
              <Button
                label="Continue"
                onPress={handleSubmit(onSubmit)}
                loading={isSubmitting}
                disabled={isSubmitting}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
