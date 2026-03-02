import { describe, test, expect } from 'bun:test';
import { AESEngine } from '../aes.js';

describe('AESEngine', () => {
  const engine = new AESEngine({ kdf: 'hkdf-sha256' });

  test('deriveKey returns a CryptoKey from wallet signature', async () => {
    const fakeSignature = new Uint8Array(64).fill(1);
    const key = await engine.deriveKey({
      type: 'wallet-signature',
    }, fakeSignature);
    expect(key).toBeDefined();
    expect(key.type).toBe('secret');
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM' });
  });

  test('encrypt then decrypt returns original data', async () => {
    const fakeSignature = new Uint8Array(64).fill(1);
    const key = await engine.deriveKey({
      type: 'wallet-signature',
    }, fakeSignature);

    const plaintext = new TextEncoder().encode('Hello OrbitMem');
    const encrypted = await engine.encrypt(plaintext, key);

    expect(encrypted.engine).toBe('aes');
    expect(encrypted.ciphertext).toBeInstanceOf(Uint8Array);
    expect(encrypted.iv).toBeInstanceOf(Uint8Array);
    expect(encrypted.iv.length).toBe(12);
    expect(encrypted.authTag).toBeInstanceOf(Uint8Array);

    const decrypted = await engine.decrypt(encrypted, key);
    expect(new TextDecoder().decode(decrypted)).toBe('Hello OrbitMem');
  });

  test('decrypt with wrong key fails', async () => {
    const sig1 = new Uint8Array(64).fill(1);
    const sig2 = new Uint8Array(64).fill(2);
    const key1 = await engine.deriveKey({ type: 'wallet-signature' }, sig1);
    const key2 = await engine.deriveKey({ type: 'wallet-signature' }, sig2);

    const plaintext = new TextEncoder().encode('secret');
    const encrypted = await engine.encrypt(plaintext, key1);

    expect(engine.decrypt(encrypted, key2)).rejects.toThrow();
  });

  test('encrypt with raw key source', async () => {
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    const key = await engine.deriveKey({ type: 'raw', key: rawKey });

    const plaintext = new TextEncoder().encode('raw key test');
    const encrypted = await engine.encrypt(plaintext, key);
    const decrypted = await engine.decrypt(encrypted, key);
    expect(new TextDecoder().decode(decrypted)).toBe('raw key test');
  });
});
