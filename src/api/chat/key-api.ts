/**
 * Manages E2E key bundles in Firestore.
 * Public keys stored at: users/{userId}/e2eKeys/identity
 * Encrypted group key bundles at: groups/{groupId}/keyBundles/{userId}
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
} from 'firebase/firestore';

import { db } from '@/api/common/firebase';
import {
  generateGroupKey,
  generateIdentityKeyPair,
  unwrapGroupKey,
  wrapGroupKey,
} from '@/lib/crypto/e2e-crypto';
import {
  getGroupKey,
  getIdentityPrivateKey,
  getIdentityPublicKey,
  hasIdentityKeyPair,
  storeGroupKey,
  storeIdentityKeyPair,
} from '@/lib/crypto/key-store';

/**
 * In-memory cache for user public keys fetched from Firestore.
 * Keys are immutable once registered, so this is safe for the app lifetime.
 */
const pubKeyCache = new Map<string, string>();

/** Ensure identity key pair exists locally and is registered in Firestore. */
export async function ensureIdentityKeyPair(userId: string): Promise<string> {
  if (hasIdentityKeyPair()) return getIdentityPublicKey()!;

  const { publicKeyB64, privateKeyB64 } = generateIdentityKeyPair();
  storeIdentityKeyPair(privateKeyB64, publicKeyB64);

  await setDoc(doc(db, 'users', userId, 'e2eKeys', 'identity'), {
    publicKey: publicKeyB64,
    updatedAt: Timestamp.now(),
  });

  pubKeyCache.set(userId, publicKeyB64);
  return publicKeyB64;
}

/** Fetch a user's public key from Firestore, cached in memory after first read. */
export async function fetchUserPublicKey(
  userId: string
): Promise<string | null> {
  const cached = pubKeyCache.get(userId);
  if (cached) return cached;

  const snap = await getDoc(doc(db, 'users', userId, 'e2eKeys', 'identity'));
  const key = snap.exists() ? (snap.data().publicKey as string) : null;
  if (key) pubKeyCache.set(userId, key);
  return key;
}

/**
 * Generate a new group key, wrap it for every member who has a registered
 * identity key, and return the plaintext group key so the caller can use it
 * immediately — avoiding a redundant resolveGroupKey read.
 */
export async function initGroupKey(
  groupId: string,
  memberIds: string[],
  initiatorUserId: string
): Promise<string> {
  const groupKey = generateGroupKey();
  const senderPriv = getIdentityPrivateKey();
  const senderPub = getIdentityPublicKey();
  if (!senderPriv || !senderPub)
    throw new Error('Identity key not initialized');

  const version = Date.now();

  await Promise.all(
    memberIds.map(async (memberId) => {
      const recipPub =
        memberId === initiatorUserId
          ? senderPub
          : await fetchUserPublicKey(memberId);
      if (!recipPub) return;

      const { ciphertext, nonce } = wrapGroupKey(
        groupKey,
        recipPub,
        senderPriv
      );
      await setDoc(doc(db, 'groups', groupId, 'keyBundles', memberId), {
        encryptedGroupKey: ciphertext,
        senderPublicKey: senderPub,
        nonce,
        keyVersion: version,
        updatedAt: Timestamp.now(),
      });
    })
  );

  storeGroupKey(groupId, version, groupKey);
  return groupKey;
}

/** Resolve the group key for the current user, decrypting from Firestore if needed. */
export async function resolveGroupKey(
  groupId: string,
  userId: string
): Promise<string | null> {
  const snap = await getDoc(doc(db, 'groups', groupId, 'keyBundles', userId));
  if (!snap.exists()) return null;

  const { encryptedGroupKey, senderPublicKey, nonce, keyVersion } =
    snap.data() as {
      encryptedGroupKey: string;
      senderPublicKey: string;
      nonce: string;
      keyVersion: number;
    };

  const cached = getGroupKey(groupId, keyVersion);
  if (cached) return cached;

  const privKey = getIdentityPrivateKey();
  if (!privKey) return null;

  const groupKey = unwrapGroupKey({
    ciphertextB64: encryptedGroupKey,
    nonceB64: nonce,
    senderPublicKeyB64: senderPublicKey,
    recipientPrivateKeyB64: privKey,
  });
  storeGroupKey(groupId, keyVersion, groupKey);
  return groupKey;
}

/** Check whether ALL members in a group have a key bundle entry. */
export async function allMembersHaveKeyBundles(
  groupId: string,
  memberIds: string[]
): Promise<boolean> {
  const bundleSnaps = await getDocs(
    collection(db, 'groups', groupId, 'keyBundles')
  );
  const covered = new Set(bundleSnaps.docs.map((d) => d.id));
  return memberIds.every((id) => covered.has(id));
}
