import Octicons from '@expo/vector-icons/Octicons';
import { Redirect, router, SplashScreen, Tabs } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { Text, TouchableOpacity } from 'react-native';

import { colors } from '@/components/ui';
import {
  useAuth,
  useIncomingFriendRequestsLiveSync,
  useIsFirstTime,
  useUserExistsInFirestore,
} from '@/lib';

export default function TabLayout() {
  const status = useAuth.use.status();
  const userId = useAuth.use.userId();
  const [isFirstTime] = useIsFirstTime();
  const {
    exists: userExistsInFirestore,
    isChecking: isUserCheckRunning,
    hasError: hasUserCheckError,
  } = useUserExistsInFirestore(userId);

  const liveSyncUserId = status === 'signIn' ? userId : null;
  useIncomingFriendRequestsLiveSync(liveSyncUserId);

  const hideSplash = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    if (status !== 'idle') {
      setTimeout(() => {
        hideSplash();
      }, 1000);
    }
  }, [hideSplash, status]);

  if (isFirstTime) {
    return <Redirect href="/onboarding" />;
  }
  if (status === 'signOut') {
    return <Redirect href="/login" />;
  }
  if (status === 'signIn' && userId !== 'guest_user' && isUserCheckRunning) {
    return null;
  }
  if (
    status === 'signIn' &&
    userId !== 'guest_user' &&
    !isUserCheckRunning &&
    userExistsInFirestore === false &&
    !hasUserCheckError
  ) {
    return <Redirect href="/profile-create" />;
  }
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitleStyle: {
          fontSize: 24,
          fontWeight: 'bold',
        },
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: colors.background[950],
        },
        tabBarStyle: {
          minHeight: 80,
          paddingTop: 10,
          backgroundColor: colors.background[900],
        },
        sceneStyle: {
          backgroundColor: colors.background[950],
        },
        tabBarActiveTintColor: colors.text[800],
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Octicons name="home" size={24} color={color} />
          ),
          tabBarButtonTestID: 'home-tab',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              style={{ marginRight: 16 }}
              accessibilityLabel="Notifications"
              accessibilityRole="button"
            >
              <Octicons name="bell" size={24} color={colors.text[800]} />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Expenses',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 24, fontWeight: 'bold', color }}>$</Text>
          ),
          tabBarButtonTestID: 'expenses-tab',
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Social',
          tabBarIcon: ({ color }) => (
            <Octicons name="people" size={24} color={color} />
          ),
          tabBarButtonTestID: 'social-tab',
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => (
            <Octicons name="search" size={24} color={color} />
          ),
          tabBarButtonTestID: 'explore-tab',
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <Octicons name="gear" size={24} color={color} />
          ),
          tabBarButtonTestID: 'settings-tab',
        }}
      />
    </Tabs>
  );
}
