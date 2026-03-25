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

export type EnsureKeyBundlesParams = {
  groupId: string;
  memberIds: string[];
  initiatorUserId: string;
  groupKeyPlaintext: string;
};

/**
 * When the current user already has the group key, write missing key bundles
 * for other members (same keyVersion) so they can unwrap without rotating.
 */
export async function ensureKeyBundlesForMissingMembers({
  groupId,
  memberIds,
  initiatorUserId,
  groupKeyPlaintext,
}: EnsureKeyBundlesParams): Promise<void> {
  const initiatorSnap = await getDoc(
    doc(db, 'groups', groupId, 'keyBundles', initiatorUserId)
  );
  if (!initiatorSnap.exists()) return;

  const { keyVersion } = initiatorSnap.data() as { keyVersion: number };
  const senderPriv = getIdentityPrivateKey();
  const senderPub = getIdentityPublicKey();
  if (!senderPriv || !senderPub) return;

  await Promise.all(
    memberIds.map(async (memberId) => {
      const snap = await getDoc(
        doc(db, 'groups', groupId, 'keyBundles', memberId)
      );
      if (snap.exists()) return;

      const recipPub =
        memberId === initiatorUserId
          ? senderPub
          : await fetchUserPublicKey(memberId);
      if (!recipPub) {
        console.warn(
          `ensureKeyBundlesForMissingMembers: skip ${memberId} (no public key)`
        );
        return;
      }

      const { ciphertext, nonce } = wrapGroupKey(
        groupKeyPlaintext,
        recipPub,
        senderPriv
      );
      await setDoc(doc(db, 'groups', groupId, 'keyBundles', memberId), {
        encryptedGroupKey: ciphertext,
        senderPublicKey: senderPub,
        nonce,
        keyVersion,
        updatedAt: Timestamp.now(),
      });
    })
  );
}

/**
 * Generate a new group key only when the group has no key bundles yet.
 * If bundles already exist, never rotate (that would make older ciphertext
 * undecryptable). Returns null when the initiator still has no bundle.
 */
export async function initGroupKey(
  groupId: string,
  memberIds: string[],
  initiatorUserId: string
): Promise<string | null> {
  const bundlesSnap = await getDocs(
    collection(db, 'groups', groupId, 'keyBundles')
  );
  if (!bundlesSnap.empty) {
    const resolved = await resolveGroupKey(groupId, initiatorUserId);
    if (resolved) return resolved;
    console.warn(
      'initGroupKey: bundles exist for this group but not for this user; refusing to rotate group key'
    );
    return null;
  }

  const groupKey = generateGroupKey();
  const senderPriv = getIdentityPrivateKey();
  const senderPub = getIdentityPublicKey();
  if (!senderPriv || !senderPub)
    throw new Error('Identity key not initialized');

  const version = Date.now();
  const skippedMembers: string[] = [];

  await Promise.all(
    memberIds.map(async (memberId) => {
      const recipPub =
        memberId === initiatorUserId
          ? senderPub
          : await fetchUserPublicKey(memberId);
      if (!recipPub) {
        console.warn(`Skipping member ${memberId}: no public key registered`);
        skippedMembers.push(memberId);
        return;
      }

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

  if (skippedMembers.length > 0) {
    console.warn(
      `initGroupKey: ${skippedMembers.length} members skipped (no public key)`
    );
  }

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
