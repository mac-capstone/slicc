import Octicons from '@expo/vector-icons/Octicons';
import { Redirect, router, SplashScreen, Tabs } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/components/ui';
import {
  useAuth,
  useIncomingFriendRequestsLiveSync,
  useIsFirstTime,
  usePlaceLikesFirestoreSync,
  useUserExistsInFirestore,
} from '@/lib';

const TAB_ICON_SLOT = 28;

/**
 * Fixed-size slot so vector icons and the expenses "$" glyph share the same
 * optical center (tab bar items otherwise misalign).
 */
function TabIconSlot({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        width: TAB_ICON_SLOT,
        height: TAB_ICON_SLOT,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarBottomPad = Math.max(
    insets.bottom,
    Platform.OS === 'android' ? 10 : 8
  );

  usePlaceLikesFirestoreSync();
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
          minHeight: 52 + tabBarBottomPad,
          paddingTop: 10,
          paddingBottom: tabBarBottomPad,
          backgroundColor: colors.background[900],
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 0,
        },
        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: 0,
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
            <TabIconSlot>
              <Octicons name="home" size={24} color={color} />
            </TabIconSlot>
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
            <TabIconSlot>
              <Text
                style={{
                  color,
                  fontSize: 22,
                  fontWeight: '700',
                  lineHeight: 22,
                  textAlign: 'center',
                  ...(Platform.OS === 'android' && {
                    includeFontPadding: false,
                    textAlignVertical: 'center',
                  }),
                }}
              >
                $
              </Text>
            </TabIconSlot>
          ),
          tabBarButtonTestID: 'expenses-tab',
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Social',
          tabBarIcon: ({ color }) => (
            <TabIconSlot>
              <Octicons name="people" size={24} color={color} />
            </TabIconSlot>
          ),
          tabBarButtonTestID: 'social-tab',
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => (
            <TabIconSlot>
              <Octicons name="search" size={24} color={color} />
            </TabIconSlot>
          ),
          tabBarButtonTestID: 'explore-tab',
        }}
      />
      <Tabs.Screen
        name="place/[place-id]"
        options={{
          href: null,
          title: 'Place Details',
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
          href: null,
          tabBarIcon: ({ color }) => (
            <TabIconSlot>
              <Octicons name="gear" size={24} color={color} />
            </TabIconSlot>
          ),
          tabBarButtonTestID: 'settings-tab',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <TabIconSlot>
              <Octicons name="person" size={24} color={color} />
            </TabIconSlot>
          ),
          tabBarButtonTestID: 'profile-tab',
        }}
      />
    </Tabs>
  );
}
