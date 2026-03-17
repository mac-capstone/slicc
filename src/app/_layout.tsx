// Import  global CSS file
import '../../global.css';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { APIProvider } from '@/api';
import { hydrateAuth, hydrateGroupPreferences, loadSelectedTheme } from '@/lib';
import { configureGoogleSignIn } from '@/lib/auth/google-auth';
import { useThemeConfig } from '@/lib/use-theme-config';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'login',
};

configureGoogleSignIn();
hydrateAuth();
hydrateGroupPreferences();
loadSelectedTheme();
// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();
// Set the animation options. This is optional.
SplashScreen.setOptions({
  duration: 500,
  fade: true,
});

export default function RootLayout() {
  const [loadedFonts] = useFonts({
    Inter: require('../../assets/fonts/Inter.ttf'),
    FuturaCyrillic: require('../../assets/fonts/FuturaCyrillicMedium.ttf'),
    FuturaCyrillicBold: require('../../assets/fonts/FuturaCyrillicBold.ttf'),
    FuturaCyrillicBook: require('../../assets/fonts/FuturaCyrillicBook.ttf'),
    FuturaCyrillicDemi: require('../../assets/fonts/FuturaCyrillicDemi.ttf'),
    FuturaCyrillicExtraBold: require('../../assets/fonts/FuturaCyrillicExtraBold.ttf'),
    FuturaCyrillicHeavy: require('../../assets/fonts/FuturaCyrillicHeavy.ttf'),
    FuturaCyrillicLight: require('../../assets/fonts/FuturaCyrillicLight.ttf'),
    FuturaCyrillicMedium: require('../../assets/fonts/FuturaCyrillicMedium.ttf'),
  });
  useEffect(() => {
    if (loadedFonts) SplashScreen.hideAsync();
  }, [loadedFonts]);

  if (!loadedFonts) return null;
  return (
    <Providers>
      <Stack>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="group" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="profile-create" options={{ headerShown: false }} />
      </Stack>
    </Providers>
  );
}

function Providers({ children }: { children: React.ReactNode }) {
  const theme = useThemeConfig();
  return (
    <GestureHandlerRootView
      style={styles.container}
      className={theme.dark ? `dark` : undefined}
    >
      <KeyboardProvider>
        <ThemeProvider value={theme}>
          <APIProvider>
            <BottomSheetModalProvider>
              {children}
              <FlashMessage position="top" />
            </BottomSheetModalProvider>
          </APIProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
