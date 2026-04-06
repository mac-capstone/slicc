/**
 * E2E keys: identity public keys stay in Firestore (`users/{userId}/e2eKeys/identity`).
 * Per-group encrypted key bundles live in Realtime Database: `groups/{groupId}/keyBundles/{userId}`.
 *
 * Stale-bundle recovery removes the current user's bundle when unwrap fails or when
 * `recipientPublicKey` no longer matches the local identity key. RTDB rules must allow
 * `remove` on `keyBundles/{request.auth.uid}` (and members with the group key must be
 * able to `set` other members' bundles for re-wrap).
 */
import {
  type DataSnapshot,
  get,
  ref as dbRef,
  remove,
  set,
} from 'firebase/database';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

import { db, rtdb } from '@/api/common/firebase';
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

const pubKeyCache = new Map<string, string>();
const identityPubKeyLastSyncAt = new Map<string, number>();
const IDENTITY_PUBKEY_SYNC_COOLDOWN_MS = 5 * 60 * 1000;

/** Bypass cache so bundle wrap/rewrap uses the latest registered identity key. */
export function invalidateUserPublicKeyCache(userId: string): void {
  pubKeyCache.delete(userId);
}

function keyBundlesPath(groupId: string): string {
  return `groups/${groupId}/keyBundles`;
}

export type ParsedKeyBundle = {
  encryptedGroupKey: string;
  senderPublicKey: string;
  nonce: string;
  keyVersion: number;
  /** X25519 public key (base64) this ciphertext was wrapped for; absent on legacy bundles. */
  recipientPublicKey?: string;
};

function parseKeyBundle(snap: DataSnapshot): ParsedKeyBundle | null {
  if (!snap.exists()) return null;
  const v = snap.val() as Record<string, unknown>;
  if (
    typeof v.encryptedGroupKey !== 'string' ||
    typeof v.senderPublicKey !== 'string' ||
    typeof v.nonce !== 'string' ||
    typeof v.keyVersion !== 'number'
  )
    return null;
  const recipientPublicKey =
    typeof v.recipientPublicKey === 'string' ? v.recipientPublicKey : undefined;
  return {
    encryptedGroupKey: v.encryptedGroupKey,
    senderPublicKey: v.senderPublicKey,
    nonce: v.nonce,
    keyVersion: v.keyVersion,
    recipientPublicKey,
  };
}

async function writeKeyBundle(
  groupId: string,
  memberId: string,
  payload: {
    encryptedGroupKey: string;
    senderPublicKey: string;
    nonce: string;
    keyVersion: number;
    recipientPublicKey: string;
  }
): Promise<void> {
  await set(dbRef(rtdb, `${keyBundlesPath(groupId)}/${memberId}`), {
    encryptedGroupKey: payload.encryptedGroupKey,
    senderPublicKey: payload.senderPublicKey,
    nonce: payload.nonce,
    keyVersion: payload.keyVersion,
    recipientPublicKey: payload.recipientPublicKey,
    updatedAt: Date.now(),
  });
}

/** Remove stale/corrupt bundle for the current user (RTDB rules must allow writes on own uid). */
async function removeKeyBundleSafe(
  groupId: string,
  userId: string
): Promise<void> {
  try {
    await remove(dbRef(rtdb, `${keyBundlesPath(groupId)}/${userId}`));
  } catch (e) {
    console.warn('removeKeyBundleSafe failed:', e);
  }
}

/** Ensure identity key pair exists locally and is registered in Firestore. */
export async function ensureIdentityKeyPair(userId: string): Promise<string> {
  let publicKeyB64: string | undefined;
  let privateKeyB64: string | undefined;

  if (hasIdentityKeyPair()) {
    publicKeyB64 = getIdentityPublicKey();
    privateKeyB64 = getIdentityPrivateKey();
  }

  if (!publicKeyB64 || !privateKeyB64) {
    const generated = generateIdentityKeyPair();
    publicKeyB64 = generated.publicKeyB64;
    privateKeyB64 = generated.privateKeyB64;
    storeIdentityKeyPair(privateKeyB64, publicKeyB64);
  }

  const now = Date.now();
  const lastSyncAt = identityPubKeyLastSyncAt.get(userId) ?? 0;
  if (now - lastSyncAt >= IDENTITY_PUBKEY_SYNC_COOLDOWN_MS) {
    try {
      await setDoc(
        doc(db, 'users', userId, 'e2eKeys', 'identity'),
        {
          publicKey: publicKeyB64,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );
      identityPubKeyLastSyncAt.set(userId, now);
    } catch (e) {
      console.warn(
        'ensureIdentityKeyPair: failed to sync public key, will retry later',
        e
      );
    }
  }

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
  const initiatorSnap = await get(
    dbRef(rtdb, `${keyBundlesPath(groupId)}/${initiatorUserId}`)
  );
  const initiatorData = parseKeyBundle(initiatorSnap);
  if (!initiatorData) return;

  const { keyVersion } = initiatorData;
  const senderPriv = getIdentityPrivateKey();
  const senderPub = getIdentityPublicKey();
  if (!senderPriv || !senderPub) return;

  await Promise.all(
    memberIds.map(async (memberId) => {
      let recipPub: string | null;
      if (memberId === initiatorUserId) {
        recipPub = senderPub;
      } else {
        invalidateUserPublicKeyCache(memberId);
        recipPub = await fetchUserPublicKey(memberId);
      }
      if (!recipPub) {
        console.warn(
          `ensureKeyBundlesForMissingMembers: skip ${memberId} (no public key)`
        );
        return;
      }

      const existing = await get(
        dbRef(rtdb, `${keyBundlesPath(groupId)}/${memberId}`)
      );
      if (existing.exists()) {
        const parsed = parseKeyBundle(existing);
        if (
          parsed?.recipientPublicKey &&
          parsed.recipientPublicKey === recipPub
        ) {
          return;
        }
        if (parsed && !parsed.recipientPublicKey) {
          return;
        }
      }

      const { ciphertext, nonce } = wrapGroupKey(
        groupKeyPlaintext,
        recipPub,
        senderPriv
      );
      await writeKeyBundle(groupId, memberId, {
        encryptedGroupKey: ciphertext,
        senderPublicKey: senderPub,
        nonce,
        keyVersion,
        recipientPublicKey: recipPub,
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
  const bundlesSnap = await get(dbRef(rtdb, keyBundlesPath(groupId)));
  const val = bundlesSnap.val() as Record<string, unknown> | null;
  const hasAny = val && typeof val === 'object' && Object.keys(val).length > 0;

  if (hasAny) {
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
      await writeKeyBundle(groupId, memberId, {
        encryptedGroupKey: ciphertext,
        senderPublicKey: senderPub,
        nonce,
        keyVersion: version,
        recipientPublicKey: recipPub,
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

/** Resolve the group key for the current user, decrypting from RTDB if needed. */
export async function resolveGroupKey(
  groupId: string,
  userId: string
): Promise<string | null> {
  const snap = await get(dbRef(rtdb, `${keyBundlesPath(groupId)}/${userId}`));
  const data = parseKeyBundle(snap);
  if (!data) return null;

  const {
    encryptedGroupKey,
    senderPublicKey,
    nonce,
    keyVersion,
    recipientPublicKey,
  } = data;

  const myPub = getIdentityPublicKey();
  if (recipientPublicKey && myPub && recipientPublicKey !== myPub) {
    await removeKeyBundleSafe(groupId, userId);
    return null;
  }

  const cached = getGroupKey(groupId, keyVersion);
  if (cached) return cached;

  const privKey = getIdentityPrivateKey();
  if (!privKey) return null;

  try {
    const groupKey = unwrapGroupKey({
      ciphertextB64: encryptedGroupKey,
      nonceB64: nonce,
      senderPublicKeyB64: senderPublicKey,
      recipientPrivateKeyB64: privKey,
    });
    storeGroupKey(groupId, keyVersion, groupKey);
    return groupKey;
  } catch {
    await removeKeyBundleSafe(groupId, userId);
    return null;
  }
}

/** Check whether ALL members in a group have a key bundle entry. */
export async function allMembersHaveKeyBundles(
  groupId: string,
  memberIds: string[]
): Promise<boolean> {
  const bundlesSnap = await get(dbRef(rtdb, keyBundlesPath(groupId)));
  if (!bundlesSnap.exists()) return memberIds.length === 0;
  const val = bundlesSnap.val() as Record<string, unknown>;
  const covered = new Set(Object.keys(val));
  return memberIds.every((id) => covered.has(id));
}
