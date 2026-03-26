import type { ConfigContext, ExpoConfig } from '@expo/config';
import { IOSConfig, withPodfile } from '@expo/config-plugins';
import type { AppIconBadgeConfig } from 'app-icon-badge/types';

import { Env } from './env.js';

/**
 * RN/Expo template leaves `target 'app'` in the Podfile while the Xcode native
 * target is named from `expo.name` (sanitized). CocoaPods then fails with
 * "Unable to find a target named `app`". Align Podfile with the real target.
 */
function withIosPodfileTargetName(config: ExpoConfig): ExpoConfig {
  return withPodfile(config, async (cfg) => {
    const iosTargetName = IOSConfig.XcodeUtils.sanitizedName(cfg.name ?? 'app');
    const podfile = cfg.modResults.contents;
    const next = podfile.replace(
      /^target 'app' do/m,
      `target '${iosTargetName}' do`
    );
    if (next !== podfile) {
      cfg.modResults.contents = next;
    }
    return cfg;
  });
}

const appIconBadgeConfig: AppIconBadgeConfig = {
  enabled: Env.APP_ENV !== 'production',
  badges: [
    {
      text: Env.APP_ENV,
      type: 'banner',
      color: 'white',
    },
    {
      text: Env.VERSION.toString(),
      type: 'ribbon',
      color: 'white',
    },
  ],
};

export default ({ config }: ConfigContext): ExpoConfig =>
  withIosPodfileTargetName({
    ...config,
    name: Env.NAME,
    description: `${Env.NAME} Mobile App`,
    owner: Env.EXPO_ACCOUNT_OWNER,
    scheme: Env.SCHEME,
    slug: 'obytesapp',
    version: Env.VERSION.toString(),
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    updates: {
      fallbackToCacheTimeout: 0,
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: Env.BUNDLE_ID,
      googleServicesFile: './GoogleService-Info.plist',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        LSApplicationQueriesSchemes: [
          'rbcmobile',
          'tdct',
          'scotiabank',
          'cibcmobilebanking',
          'bmomobile',
          'nbcmobile',
          'desjardins',
          'tangerine',
          'simplii',
          'wealthsimple',
          'koho',
        ],
      },
    },
    experiments: {
      typedRoutes: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#2E3C4B',
      },
      package: Env.PACKAGE,
      googleServicesFile: './google-services.json',
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    plugins: [
      [
        'expo-splash-screen',
        {
          backgroundColor: '#2E3C4B',
          image: './assets/splash-icon.png',
          imageWidth: 150,
        },
      ],
      [
        'expo-font',
        {
          fonts: [
            './assets/fonts/Inter.ttf',
            './assets/fonts/FuturaCyrillicBold.ttf',
            './assets/fonts/FuturaCyrillicBook.ttf',
            './assets/fonts/FuturaCyrillicDemi.ttf',
            './assets/fonts/FuturaCyrillicExtraBold.ttf',
            './assets/fonts/FuturaCyrillicHeavy.ttf',
            './assets/fonts/FuturaCyrillicLight.ttf',
            './assets/fonts/FuturaCyrillicMedium.ttf',
          ],
        },
      ],
      'expo-localization',
      'expo-router',
      '@react-native-community/datetimepicker',
      ['app-icon-badge', appIconBadgeConfig],
      ['react-native-edge-to-edge'],
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Allow this app to use your location to find nearby places.',
        },
      ],
      [
        'react-native-maps',
        {
          androidGoogleMapsApiKey: Env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '',
          iosGoogleMapsApiKey: Env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '',
        },
      ],
      [
        'expo-speech-recognition',
        {
          microphonePermission: 'Allow this app to use the microphone.',
          speechRecognitionPermission:
            'Allow this app to use speech recognition.',
          androidSpeechServicePackages: [
            'com.google.android.googlequicksearchbox',
          ],
        },
      ],
      '@react-native-google-signin/google-signin',
      [
        'expo-image-picker',
        {
          photosPermission:
            'Allow $(PRODUCT_NAME) to access your photos for your profile picture.',
        },
      ],
    ],
    extra: {
      ...Env,
      eas: {
        projectId: Env.EAS_PROJECT_ID,
      },
    },
  });
