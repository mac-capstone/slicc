import type { ConfigContext, ExpoConfig } from '@expo/config';
import type { ConfigPlugin } from '@expo/config-plugins';
import { withAppBuildGradle } from '@expo/config-plugins';

import { Env } from './env.js';

const WINDOWS_NINJA_CMAKE_BLOCK = [
  '',
  '        def isWindows = System.getProperty("os.name").toLowerCase().contains("windows")',
  '        if (isWindows) {',
  '            def ninjaPath = System.getenv("NINJA_HOME") ?: "C:\\\\ninja"',
  '            externalNativeBuild {',
  '                cmake {',
  '                    arguments "-DCMAKE_MAKE_PROGRAM=${ninjaPath}\\\\ninja.exe", "-DCMAKE_OBJECT_PATH_MAX=1024"',
  '                }',
  '            }',
  '        }',
].join('\n');

const withWindowsNinjaCMake: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (buildGradleConfig) => {
    const { contents } = buildGradleConfig.modResults;

    if (contents.includes('CMAKE_MAKE_PROGRAM')) {
      return buildGradleConfig;
    }

    const marker =
      '        buildConfigField "String", "REACT_NATIVE_RELEASE_LEVEL", "\\"${findProperty(\'reactNativeReleaseLevel\') ?: \'stable\'}\\""';

    if (!contents.includes(marker)) {
      throw new Error(
        'Unable to apply Windows Ninja CMake workaround: buildConfigField marker was not found.'
      );
    }

    buildGradleConfig.modResults.contents = contents.replace(
      marker,
      `${marker}${WINDOWS_NINJA_CMAKE_BLOCK}`
    );

    return buildGradleConfig;
  });

export default ({ config }: ConfigContext): ExpoConfig => ({
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
      backgroundColor: '#1A1A1A',
    },
    package: Env.PACKAGE,
    googleServicesFile: './google-services.json',
    softwareKeyboardLayoutMode: 'resize',
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    [
      'expo-splash-screen',
      {
        backgroundColor: '#1A1A1A',
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
    'expo-secure-store',
    'expo-router',
    '@react-native-community/datetimepicker',
    ['react-native-edge-to-edge'],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
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
    // Expo accepts function plugins at runtime, but ExpoConfig only models static declarations.
    withWindowsNinjaCMake as unknown as NonNullable<
      ExpoConfig['plugins']
    >[number],
  ],
  extra: {
    ...Env,
    eas: {
      projectId: Env.EAS_PROJECT_ID,
    },
  },
});
