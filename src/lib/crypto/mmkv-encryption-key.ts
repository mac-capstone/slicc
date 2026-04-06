/**
 * MMKV encryption keys must live outside the MMKV file. We persist a random
 * 16-byte key in platform secure storage (iOS Keychain / Android Keystore via
 * expo-secure-store), then pass it to createMMKV({ encryptionKey }).
 *
 * @see https://github.com/mrousavy/react-native-mmkv#encryption
 */
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/** MMKV requires encryption key material ≤ 16 bytes (AES-128). */
const MMKV_KEY_BYTE_LENGTH = 16;

const SECURE_STORE_KEY = 'slicc.mmkv.encryption.v1';

function binaryKeyToBase64(key: string): string {
  let binary = '';
  for (let i = 0; i < key.length; i++)
    binary += String.fromCharCode(key.charCodeAt(i) & 0xff);
  return btoa(binary);
}

function base64ToBinaryKey(b64: string): string {
  const binary = atob(b64);
  let s = '';
  for (let i = 0; i < binary.length; i++)
    s += String.fromCharCode(binary.charCodeAt(i) & 0xff);
  return s;
}

/**
 * Returns a 16-character string suitable for MMKV `encryptionKey` (16 bytes).
 * Creates and stores a new key on first run.
 */
export async function getOrCreateMmkvEncryptionKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(SECURE_STORE_KEY, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  if (existing) return base64ToBinaryKey(existing);

  const bytes = await Crypto.getRandomBytesAsync(MMKV_KEY_BYTE_LENGTH);
  let key = '';
  for (let i = 0; i < bytes.length; i++) key += String.fromCharCode(bytes[i]);
  await SecureStore.setItemAsync(SECURE_STORE_KEY, binaryKeyToBase64(key), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return key;
}
