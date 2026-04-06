import type { ConfigContext, ExpoConfig } from '@expo/config';
import type { AppIconBadgeConfig } from 'app-icon-badge/types';

const APP_ENV = process.env.APP_ENV ?? 'development';
const VERSION = '0.0.1';
const NAME = 'slicc';
const SCHEME = 'app';
const BUNDLE_ID = 'com.slicc.app';
const PACKAGE = 'com.slicc.app';
const OWNER = 'slicc-capstone';
const EAS_PROJECT_ID = 'a9455287-faee-496b-ab4d-b9a6fc1ef834';

const appIconBadgeConfig: AppIconBadgeConfig = {
  enabled: APP_ENV !== 'production',
  badges: [
    {
      text: APP_ENV,
      type: 'banner',
      color: 'white',
    },
    {
      text: VERSION,
      type: 'ribbon',
      color: 'white',
    },
  ],
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: NAME,
  description: `${NAME} Mobile App`,
  owner: OWNER,
  scheme: SCHEME,
  slug: 'obytesapp',
  version: VERSION,
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  updates: {
    enabled: false,
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: BUNDLE_ID,
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
    package: PACKAGE,
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
    APP_ENV,
    NAME,
    SCHEME,
    BUNDLE_ID,
    PACKAGE,
    VERSION,
    EXPO_ACCOUNT_OWNER: OWNER,
    EAS_PROJECT_ID,
    EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    EXPO_PUBLIC_FIREBASE_PROJECT_ID:
      process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET:
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID:
      process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID:
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    eas: {
      projectId: EAS_PROJECT_ID,
    },
  },
});
