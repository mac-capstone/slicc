/**
 * Local secure storage for E2E crypto key material.
 * Private keys NEVER leave the device -- only public keys go to Firestore.
 */
import { createMMKV } from 'react-native-mmkv';

const store = createMMKV({ id: 'slicc-crypto-v1' });

const K = {
  identityPriv: 'id_priv',
  identityPub: 'id_pub',
  groupKeyPrefix: 'gk_',
  groupVersionPrefix: 'gv_',
} as const;

export function storeIdentityKeyPair(
  privateKeyJwk: string,
  publicKeyJwk: string
): void {
  store.set(K.identityPriv, privateKeyJwk);
  store.set(K.identityPub, publicKeyJwk);
}

export function getIdentityPrivateKey(): string | undefined {
  return store.getString(K.identityPriv);
}

export function getIdentityPublicKey(): string | undefined {
  return store.getString(K.identityPub);
}

export function hasIdentityKeyPair(): boolean {
  return store.contains(K.identityPriv) && store.contains(K.identityPub);
}

export function storeGroupKey(
  groupId: string,
  version: number,
  key: string
): void {
  store.set(`${K.groupKeyPrefix}${groupId}_${version}`, key);
  const current = store.getNumber(`${K.groupVersionPrefix}${groupId}`) ?? -1;
  if (version > current) {
    store.set(`${K.groupVersionPrefix}${groupId}`, version);
  }
}

export function getGroupKey(
  groupId: string,
  version: number
): string | undefined {
  return store.getString(`${K.groupKeyPrefix}${groupId}_${version}`);
}

export function getLatestGroupKeyVersion(groupId: string): number {
  return store.getNumber(`${K.groupVersionPrefix}${groupId}`) ?? -1;
}

export function getLatestGroupKey(groupId: string): string | undefined {
  const version = getLatestGroupKeyVersion(groupId);
  if (version < 0) return undefined;
  return getGroupKey(groupId, version);
}
