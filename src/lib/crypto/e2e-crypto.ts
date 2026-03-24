/**
 * Signal-like E2E encryption using TweetNaCl (pure JS, works in Hermes/RN).
 *
 * Primitives:
 *   Key exchange : X25519 (nacl.box.keyPair)
 *   Group key wrap: X25519 ECDH + XSalsa20-Poly1305 (nacl.box)
 *   Message enc  : XSalsa20-Poly1305 (nacl.secretbox)
 *   Ratchet      : SHA-512 truncated to 32 bytes (nacl.hash)
 *
 * All keys/ciphertexts are stored as base64 strings.
 * Private keys never leave the device (stored in MMKV only).
 */

// Must be imported before tweetnacl so crypto.getRandomValues is polyfilled in Hermes.
import 'react-native-get-random-values';

import nacl from 'tweetnacl';

// ── base64 helpers ─────────────────────────────────────────────────────────

function toB64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromB64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── Identity key pair (X25519) ─────────────────────────────────────────────

export type KeyPairB64 = { publicKeyB64: string; privateKeyB64: string };

export function generateIdentityKeyPair(): KeyPairB64 {
  const kp = nacl.box.keyPair();
  return {
    publicKeyB64: toB64(kp.publicKey),
    privateKeyB64: toB64(kp.secretKey),
  };
}

// ── Group symmetric key ────────────────────────────────────────────────────

export function generateGroupKey(): string {
  return toB64(nacl.randomBytes(nacl.secretbox.keyLength)); // 32 bytes
}

// ── Key wrapping (ECDH + XSalsa20-Poly1305) ───────────────────────────────

/**
 * Encrypt the group key for a specific recipient.
 * Uses nacl.box: ECDH(senderPriv, recipientPub) -> shared secret -> XSalsa20-Poly1305.
 */
export function wrapGroupKey(
  groupKeyB64: string,
  recipientPublicKeyB64: string,
  senderPrivateKeyB64: string
): { ciphertext: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.box.nonceLength); // 24 bytes
  const box = nacl.box(
    fromB64(groupKeyB64),
    nonce,
    fromB64(recipientPublicKeyB64),
    fromB64(senderPrivateKeyB64)
  );
  if (!box) throw new Error('wrapGroupKey: encryption failed');
  return { ciphertext: toB64(box), nonce: toB64(nonce) };
}

/**
 * Decrypt the group key wrapped for this recipient.
 * Uses nacl.box.open: ECDH(recipientPriv, senderPub) -> same shared secret -> decrypt.
 */
export function unwrapGroupKey({
  ciphertextB64,
  nonceB64,
  senderPublicKeyB64,
  recipientPrivateKeyB64,
}: {
  ciphertextB64: string;
  nonceB64: string;
  senderPublicKeyB64: string;
  recipientPrivateKeyB64: string;
}): string {
  const plain = nacl.box.open(
    fromB64(ciphertextB64),
    fromB64(nonceB64),
    fromB64(senderPublicKeyB64),
    fromB64(recipientPrivateKeyB64)
  );
  if (!plain)
    throw new Error(
      'unwrapGroupKey: decryption failed (wrong key or tampered)'
    );
  return toB64(plain);
}

// ── Message encryption (XSalsa20-Poly1305) ────────────────────────────────

export function encryptMessage(
  plaintext: string,
  groupKeyB64: string
): { ciphertext: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength); // 24 bytes
  const box = nacl.secretbox(
    new TextEncoder().encode(plaintext),
    nonce,
    fromB64(groupKeyB64)
  );
  return { ciphertext: toB64(box), nonce: toB64(nonce) };
}

export function decryptMessage(
  ciphertextB64: string,
  nonceB64: string,
  groupKeyB64: string
): string {
  const plain = nacl.secretbox.open(
    fromB64(ciphertextB64),
    fromB64(nonceB64),
    fromB64(groupKeyB64)
  );
  if (!plain) throw new Error('decryptMessage: decryption failed');
  return new TextDecoder().decode(plain);
}

// ── KDF ratchet (forward secrecy) ─────────────────────────────────────────

/**
 * Derive the next chain key from the current one via SHA-512 truncated to 32 bytes.
 * Advancing the ratchet makes past message keys unrecoverable from the new key.
 */
export function ratchetKey(currentKeyB64: string): string {
  const next = nacl
    .hash(fromB64(currentKeyB64))
    .slice(0, nacl.secretbox.keyLength);
  return toB64(next);
}
