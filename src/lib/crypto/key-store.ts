/**
 * Local storage for E2E crypto key material.
 * MMKV is encrypted with a key held in platform secure storage (Keychain / Keystore).
 * Private keys NEVER leave the device — only public keys go to Firestore.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createMMKV, type MMKV } from 'react-native-mmkv';

import { getOrCreateMmkvEncryptionKey } from '@/lib/crypto/mmkv-encryption-key';

/** Legacy unencrypted store id (pre-encryption migration). */
const LEGACY_STORE_ID = 'slicc-crypto-v1';
/** Encrypted store id (current). */
const ENCRYPTED_STORE_ID = 'slicc-crypto-v2';

const K = {
  identityPriv: 'id_priv',
  identityPub: 'id_pub',
  groupKeyPrefix: 'gk_',
  groupVersionPrefix: 'gv_',
} as const;

let store: MMKV | null = null;

function getStore(): MMKV {
  if (!store)
    throw new Error(
      'Crypto key store not initialized. Await initCryptoKeyStore() first.'
    );
  return store;
}

function copyMmkvContents(from: MMKV, to: MMKV): void {
  for (const key of from.getAllKeys()) {
    const str = from.getString(key);
    if (str !== undefined) {
      to.set(key, str);
      continue;
    }
    const num = from.getNumber(key);
    if (num !== undefined) {
      to.set(key, num);
      continue;
    }
    const bool = from.getBoolean(key);
    if (bool !== undefined) to.set(key, bool);
  }
}

/**
 * One-time migration: plain `slicc-crypto-v1` → encrypted `slicc-crypto-v2`.
 */
function migrateFromLegacyIfNeeded(encrypted: MMKV): void {
  if (encrypted.getAllKeys().length > 0) return;

  const legacy = createMMKV({ id: LEGACY_STORE_ID });
  if (legacy.getAllKeys().length === 0) return;

  copyMmkvContents(legacy, encrypted);
  legacy.clearAll();
}

/**
 * Must be awaited once at app startup before any key-store reads/writes.
 * On web, uses an unencrypted MMKV instance (E2E chat is not the primary web target).
 */
export async function initCryptoKeyStore(): Promise<void> {
  if (store) return;

  if (Platform.OS === 'web') {
    store = createMMKV({ id: ENCRYPTED_STORE_ID });
    return;
  }

  try {
    const secureAvailable = await SecureStore.isAvailableAsync();
    if (!secureAvailable) {
      store = createMMKV({ id: ENCRYPTED_STORE_ID });
      return;
    }

    const encryptionKey = await getOrCreateMmkvEncryptionKey();
    store = createMMKV({
      id: ENCRYPTED_STORE_ID,
      encryptionKey,
    });
    migrateFromLegacyIfNeeded(store);
  } catch (e) {
    console.error(
      'initCryptoKeyStore: secure MMKV failed, using plain MMKV',
      e
    );
    store = createMMKV({ id: ENCRYPTED_STORE_ID });
  }
}

export function storeIdentityKeyPair(
  privateKeyJwk: string,
  publicKeyJwk: string
): void {
  const s = getStore();
  s.set(K.identityPriv, privateKeyJwk);
  s.set(K.identityPub, publicKeyJwk);
}

export function getIdentityPrivateKey(): string | undefined {
  return getStore().getString(K.identityPriv);
}

export function getIdentityPublicKey(): string | undefined {
  return getStore().getString(K.identityPub);
}

export function hasIdentityKeyPair(): boolean {
  const s = getStore();
  return s.contains(K.identityPriv) && s.contains(K.identityPub);
}

export function storeGroupKey(
  groupId: string,
  version: number,
  key: string
): void {
  const s = getStore();
  s.set(`${K.groupKeyPrefix}${groupId}_${version}`, key);
  const current = s.getNumber(`${K.groupVersionPrefix}${groupId}`) ?? -1;
  if (version > current) {
    s.set(`${K.groupVersionPrefix}${groupId}`, version);
  }
}

export function getGroupKey(
  groupId: string,
  version: number
): string | undefined {
  return getStore().getString(`${K.groupKeyPrefix}${groupId}_${version}`);
}

export function getLatestGroupKeyVersion(groupId: string): number {
  return getStore().getNumber(`${K.groupVersionPrefix}${groupId}`) ?? -1;
}

export function getLatestGroupKey(groupId: string): string | undefined {
  const version = getLatestGroupKeyVersion(groupId);
  if (version < 0) return undefined;
  return getGroupKey(groupId, version);
}
