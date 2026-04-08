import { Alert, Linking, Platform } from 'react-native';

type OpenExternalUrlOptions = {
  failureTitle: string;
  failureMessage: string;
};

/**
 * Opens a URL with user-facing errors. On Android, `canOpenURL` is skipped for
 * `tel:` / `geo:` / `maps:` because it often returns false without manifest
 * `<queries>`; we rely on try/catch instead.
 */
export async function openExternalUrl(
  url: string,
  options: OpenExternalUrlOptions
): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(options.failureTitle, options.failureMessage);
        return;
      }
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert(options.failureTitle, options.failureMessage);
  }
}
