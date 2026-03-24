import Ionicons from '@expo/vector-icons/Ionicons';
import Octicons from '@expo/vector-icons/Octicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import { useUser } from '@/api/people/use-users';
import {
  getProfilePictureUrl,
  uploadProfilePicture,
} from '@/api/people/user-api';
import {
  colors,
  FocusAwareStatusBar,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { useAuth } from '@/lib';
import { DIETARY_LABEL_KEYS } from '@/lib/dietary-preference-label-keys';
import { type DietaryPreferenceId } from '@/lib/dietary-preference-options';
import { translate } from '@/lib/i18n';
import { type UserIdT } from '@/types';

function ProfileSection({
  icon,
  title,
  children,
  showDivider = true,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  showDivider?: boolean;
}) {
  return (
    <View
      className={showDivider ? 'border-b border-charcoal-700 pb-7' : 'pb-7'}
    >
      <View className="mb-3 flex-row items-center gap-3">
        <View className="w-7 items-center">{icon}</View>
        <Text className="font-futuraBold text-[14px] uppercase tracking-[1.1px] text-charcoal-300">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

export default function Profile() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth.use.userId();
  const viewerUserId = userId ?? null;
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const { data: user } = useUser({
    variables: { userId: userId as UserIdT, viewerUserId },
    enabled: Boolean(userId),
  });

  const { data: profilePhotoUrl } = useQuery({
    queryKey: ['users', 'profile-picture', userId],
    queryFn: () => getProfilePictureUrl(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });

  const dietaryPreferenceLabels = useMemo(() => {
    const preferences = (user?.dietaryPreferences ??
      []) as DietaryPreferenceId[];
    return preferences.map((preferenceId) =>
      translate(DIETARY_LABEL_KEYS[preferenceId])
    );
  }, [user?.dietaryPreferences]);

  const handlePickProfilePhoto = useCallback(async () => {
    if (!userId || isUploadingPhoto) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Please grant photo library access to update your profile picture.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    try {
      setIsUploadingPhoto(true);
      await uploadProfilePicture(userId, result.assets[0].uri);
      await queryClient.invalidateQueries({
        queryKey: ['users', 'profile-picture', userId],
      });
    } catch (error) {
      console.error('[profile] failed to upload profile picture', error);
      Alert.alert(
        'Upload failed',
        'Unable to update your profile picture. Please try again.'
      );
    } finally {
      setIsUploadingPhoto(false);
    }
  }, [isUploadingPhoto, queryClient, userId]);

  return (
    <>
      <FocusAwareStatusBar />
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <SafeAreaView className="flex-1 bg-background-950" edges={['top']}>
        <ScrollView
          className="flex-1 bg-background-950"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6 pb-10 pt-4">
            <View className="mb-10 flex-row justify-end">
              <Pressable
                accessibilityLabel="Open settings"
                accessibilityRole="button"
                className="rounded-full p-2"
                onPress={() => router.push('/settings')}
              >
                <Octicons name="gear" size={24} color={colors.charcoal[300]} />
              </Pressable>
            </View>

            <View className="mb-14 items-center">
              <Pressable
                accessibilityLabel="Change profile picture"
                accessibilityRole="button"
                className="relative"
                disabled={isUploadingPhoto}
                onPress={handlePickProfilePhoto}
              >
                <View className="size-44 items-center justify-center overflow-hidden rounded-full border border-charcoal-700 bg-charcoal-800">
                  {profilePhotoUrl ? (
                    <Image
                      source={{ uri: profilePhotoUrl }}
                      className="size-full"
                      contentFit="cover"
                    />
                  ) : (
                    <Ionicons
                      name="person-outline"
                      size={108}
                      color={colors.charcoal[400]}
                    />
                  )}
                  {isUploadingPhoto ? (
                    <View className="absolute inset-0 items-center justify-center bg-black/35">
                      <ActivityIndicator color={colors.white} size="large" />
                    </View>
                  ) : null}
                </View>
                <View className="absolute bottom-2 right-0 size-16 items-center justify-center rounded-full bg-accent-100">
                  <Ionicons name="camera-outline" size={28} color="#000000" />
                </View>
              </Pressable>

              <Text className="mt-8 font-futuraHeavy text-4xl text-white">
                {user?.displayName ?? 'Profile'}
              </Text>
              <Text className="mt-2 font-inter text-[16px] text-text-800">
                {user?.username ? `@${user.username}` : '@username'}
              </Text>
            </View>

            <View className="gap-7">
              <ProfileSection
                icon={
                  <Octicons
                    name="mail"
                    size={22}
                    color={colors.charcoal[300]}
                  />
                }
                title={translate('profile.e_transfer')}
              >
                <Text className="font-futuraBook text-[16px] text-white">
                  {user?.eTransferEmail?.trim() || translate('profile.not_set')}
                </Text>
              </ProfileSection>

              <ProfileSection
                icon={
                  <Ionicons
                    name="restaurant-outline"
                    size={22}
                    color={colors.charcoal[300]}
                  />
                }
                title={translate('profile.dietary_preferences')}
                showDivider={false}
              >
                {dietaryPreferenceLabels.length > 0 ? (
                  <View className="flex-row flex-wrap gap-2.5">
                    {dietaryPreferenceLabels.map((label) => (
                      <View
                        key={label}
                        className="rounded-full bg-charcoal-850 px-4 py-2.5"
                      >
                        <Text className="font-futuraMedium text-[14px] text-white">
                          {label}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="font-futuraBook text-[16px] text-charcoal-300">
                    {translate('profile.none_set')}
                  </Text>
                )}
              </ProfileSection>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
