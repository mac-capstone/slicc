import Ionicons from '@expo/vector-icons/Ionicons';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';

import {
  FocusAwareStatusBar,
  Image,
  Pressable,
  Text,
  View,
} from '@/components/ui';
import { useAuth } from '@/lib';
import { getGoogleSignInErrorMessage } from '@/lib/auth/google-auth';

export default function Login() {
  const router = useRouter();
  const signIn = useAuth.use.signIn();
  const googleSignIn = useAuth.use.googleSignIn();
  const status = useAuth.use.status();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  if (status === 'signIn') {
    return <Redirect href="/" />;
  }

  const handleGoogleSignIn = async (): Promise<void> => {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);
    try {
      await googleSignIn();
      router.push('/');
    } catch (error) {
      const message = getGoogleSignInErrorMessage(error);
      Alert.alert('Sign-in failed', message);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGuestSignIn = (): void => {
    signIn({
      token: { access: 'guest-token', refresh: '' },
      userId: 'guest_user',
    });
    router.push('/');
  };

  return (
    <>
      <FocusAwareStatusBar />
      <View className="flex-1 bg-background-950 px-6">
        <View className="flex-1 items-center justify-center">
          <View className="mb-4 size-20 items-center justify-center rounded-2xl bg-accent-900">
            <Image
              source={require('../../assets/icon.png')}
              style={{ width: 48, height: 48 }}
              contentFit="contain"
            />
          </View>
          <Text className="font-futuraBold text-4xl text-white">slicc</Text>
        </View>

        <View className="mb-8 gap-4">
          <GoogleSigninButton
            size={GoogleSigninButton.Size.Wide}
            color={GoogleSigninButton.Color.Dark}
            onPress={handleGoogleSignIn}
            disabled={isGoogleLoading}
          />

          <Pressable
            className="h-14 flex-row items-center rounded-xl bg-charcoal-800 px-4"
            onPress={() =>
              Alert.alert('Coming soon', 'Apple sign-in is not yet available.')
            }
          >
            <View className="w-12 items-center">
              <Ionicons name="logo-apple" size={24} color="#fff" />
            </View>
            <Text className="flex-1 text-center font-futuraMedium text-base text-white">
              Log in with Apple
            </Text>
            <View className="w-12" />
          </Pressable>

          <Pressable className="mt-2 items-center" onPress={handleGuestSignIn}>
            <Text className="text-base text-accent-100">Continue as guest</Text>
          </Pressable>
        </View>

        <View className="mb-12 items-center gap-1">
          <Text className="text-sm text-charcoal-400">
            By continuing, I agree to the
          </Text>
          <View className="flex-row">
            <Text className="text-sm text-accent-100">Terms & Conditions</Text>
            <Text className="text-sm text-charcoal-400"> and </Text>
            <Text className="text-sm text-accent-100">Privacy Policy</Text>
          </View>
        </View>
      </View>
    </>
  );
}
