import Octicons from '@expo/vector-icons/Octicons';
import { Redirect, router, SplashScreen, Tabs } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { TouchableOpacity } from 'react-native';

import { colors } from '@/components/ui';
import { useAuth, useIsFirstTime } from '@/lib';

export default function TabLayout() {
  const status = useAuth.use.status();
  const [isFirstTime] = useIsFirstTime();
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
          title: 'Expenses',
          tabBarIcon: ({ color }) => (
            <Octicons name="home" size={24} color={color} />
          ),
          tabBarButtonTestID: 'home-tab',
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          tabBarIcon: ({ color }) => (
            <Octicons name="people" size={24} color={color} />
          ),
          tabBarButtonTestID: 'groups-tab',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/group/edit')}
              style={{ marginRight: 16 }}
              accessibilityLabel="Add group"
              accessibilityRole="button"
            >
              <Octicons name="plus" size={24} color={colors.text[800]} />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color }) => (
            <Octicons name="bell" size={24} color={color} />
          ),
          tabBarButtonTestID: 'style-tab',
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
