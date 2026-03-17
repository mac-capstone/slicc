import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { GoogleIcon } from '@/components/icons/google-icon';
import {
  ActivityIndicator,
  FocusAwareStatusBar,
  Image,
  Pressable,
  SafeAreaView,
  Text,
  View,
} from '@/components/ui';
import { useAuth } from '@/lib';
import { getGoogleSignInErrorMessage } from '@/lib/auth/google-auth';

type AuthButtonProps = {
  label: string;
  onPress: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
};

function AuthButton({
  label,
  onPress,
  icon,
  disabled = false,
}: AuthButtonProps) {
  return (
    <Pressable
      className={`h-[51px] flex-row items-center rounded-[5px] bg-background-900 px-5 ${
        disabled ? 'opacity-70' : ''
      }`}
      onPress={onPress}
      disabled={disabled}
    >
      <View className="w-11 items-start justify-center">{icon}</View>
      <Text className="flex-1 text-center text-sm font-bold tracking-[-0.28px] text-white dark:text-white">
        {label}
      </Text>
      <View className="w-11" />
    </Pressable>
  );
}

export default function Login() {
  const router = useRouter();
  const signIn = useAuth.use.signIn();
  const googleSignIn = useAuth.use.googleSignIn();
  const status = useAuth.use.status();
  const userId = useAuth.use.userId();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    console.log('[login] auth state', {
      status,
      userId,
      isGoogleLoading,
    });
  }, [isGoogleLoading, status, userId]);

  if (status === 'signIn') {
    return <Redirect href="/" />;
  }

  const handleGoogleSignIn = async (): Promise<void> => {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);
    try {
      console.log('[login] starting google sign in');
      await googleSignIn();
      console.log('[login] google sign in completed, routing to app root');
      router.push('/');
    } catch (error) {
      console.log('[login] google sign in failed', { error });
      const message = getGoogleSignInErrorMessage(error);
      Alert.alert('Sign-in failed', message);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGuestSignIn = (): void => {
    console.log('[login] guest sign in');
    signIn({
      token: { access: 'guest-token', refresh: '' },
      userId: 'guest_user',
    });
    router.push('/');
  };

  return (
    <>
      <FocusAwareStatusBar />
      <SafeAreaView className="flex-1 bg-background-950">
        <View className="flex-1 px-[21px] pb-[34px] pt-28">
          <View className="items-center">
            <View className="items-center">
              <View className="size-[70px] items-center justify-center rounded-[5px] bg-accent-900">
                <Image
                  source={require('../../assets/icon.png')}
                  className="size-11"
                  contentFit="contain"
                />
              </View>
              <Text className="mt-1.5 text-[32px] font-bold tracking-[-0.64px] text-white dark:text-white">
                slicc
              </Text>
            </View>

            <View className="mt-24 w-full gap-[17px]">
              <AuthButton
                label="Log in with Google"
                onPress={handleGoogleSignIn}
                disabled={isGoogleLoading}
                icon={
                  isGoogleLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <GoogleIcon />
                  )
                }
              />

              <AuthButton
                label="Log in with Apple"
                onPress={() =>
                  Alert.alert(
                    'Coming soon',
                    'Apple sign-in is not yet available.'
                  )
                }
                icon={<Ionicons name="logo-apple" size={29} color="#D9D9D9" />}
              />

              <Pressable
                className="mt-[18px] items-center"
                onPress={handleGuestSignIn}
              >
                <Text className="text-sm font-semibold tracking-[-0.28px] text-accent-100 dark:text-accent-100">
                  Continue as guest
                </Text>
              </Pressable>
            </View>
          </View>

          <View className="mt-auto items-center">
            <Text className="text-center text-xs font-medium tracking-[-0.24px] text-text-800 dark:text-text-800">
              By continuing, I agree to the
            </Text>
            <View className="mt-0.5 flex-row flex-wrap items-center justify-center">
              <Text className="text-xs font-medium tracking-[-0.24px] text-accent-100 dark:text-accent-100">
                Terms & Conditions
              </Text>
              <Text className="mx-1 text-xs font-medium tracking-[-0.24px] text-text-800 dark:text-text-800">
                and
              </Text>
              <Text className="text-xs font-medium tracking-[-0.24px] text-accent-100 dark:text-accent-100">
                Privacy Policy
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}
