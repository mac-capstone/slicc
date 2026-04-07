import 'react-native-get-random-values';

import {
  b64ToBytes,
  bytesToB64,
  decryptBytes,
  decryptMessage,
  encryptBytes,
  encryptMessage,
  generateGroupKey,
  generateIdentityKeyPair,
  ratchetKey,
  unwrapGroupKey,
  wrapGroupKey,
} from '@/lib/crypto/e2e-crypto';

describe('e2e-crypto (group chat encryption primitives)', () => {
  it('round-trips arbitrary bytes through base64 helpers', () => {
    const original = new Uint8Array([0, 127, 255, 10, 20]);
    const b64 = bytesToB64(original);
    expect(b64ToBytes(b64)).toEqual(original);
  });

  it('generateIdentityKeyPair returns distinct public and private material', () => {
    const a = generateIdentityKeyPair();
    const b = generateIdentityKeyPair();
    expect(a.publicKeyB64).not.toBe(a.privateKeyB64);
    expect(a.publicKeyB64).not.toBe(b.publicKeyB64);
  });

  it('encryptMessage / decryptMessage round-trip with the same group key', () => {
    const groupKey = generateGroupKey();
    const { ciphertext, nonce } = encryptMessage('hello group', groupKey);
    expect(decryptMessage(ciphertext, nonce, groupKey)).toBe('hello group');
  });

  it('encryptBytes / decryptBytes round-trip', () => {
    const groupKey = generateGroupKey();
    const plain = new Uint8Array([1, 2, 3, 4]);
    const { ciphertext, nonce } = encryptBytes(plain, groupKey);
    expect(decryptBytes(ciphertext, nonce, groupKey)).toEqual(plain);
  });

  it('wrapGroupKey / unwrapGroupKey deliver the same group key to the recipient', () => {
    const alice = generateIdentityKeyPair();
    const bob = generateIdentityKeyPair();
    const groupKey = generateGroupKey();

    const wrapped = wrapGroupKey(
      groupKey,
      bob.publicKeyB64,
      alice.privateKeyB64
    );

    const opened = unwrapGroupKey({
      ciphertextB64: wrapped.ciphertext,
      nonceB64: wrapped.nonce,
      senderPublicKeyB64: alice.publicKeyB64,
      recipientPrivateKeyB64: bob.privateKeyB64,
    });

    expect(opened).toBe(groupKey);
  });

  it('ratchetKey changes the key material deterministically for the same input', () => {
    const k = generateGroupKey();
    const r1 = ratchetKey(k);
    const r2 = ratchetKey(k);
    expect(r1).toBe(r2);
    expect(r1).not.toBe(k);
  });
});
