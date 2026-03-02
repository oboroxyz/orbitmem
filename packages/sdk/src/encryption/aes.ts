import type { AESEncryptedData, AESKeySource } from '../types.js';

export interface AESConfig {
  kdf: 'hkdf-sha256' | 'pbkdf2-sha256';
  iterations?: number;
}

export class AESEngine {
  private config: AESConfig;

  constructor(config: AESConfig) {
    this.config = config;
  }

  async deriveKey(source: AESKeySource, walletSignature?: Uint8Array): Promise<CryptoKey> {
    if (source.type === 'raw') {
      return crypto.subtle.importKey(
        'raw',
        source.key,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );
    }

    if (source.type === 'wallet-signature') {
      if (!walletSignature) throw new Error('walletSignature required for wallet-signature source');
      const ikm = await crypto.subtle.importKey(
        'raw',
        walletSignature,
        'HKDF',
        false,
        ['deriveKey']
      );
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const info = new TextEncoder().encode('orbitmem-aes-256-gcm');
      return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt, info },
        ikm,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    }

    if (source.type === 'password') {
      const enc = new TextEncoder().encode(source.password);
      const ikm = await crypto.subtle.importKey('raw', enc, 'PBKDF2', false, ['deriveKey']);
      const salt = crypto.getRandomValues(new Uint8Array(32));
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: this.config.iterations ?? 100000 },
        ikm,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    }

    throw new Error(`Unknown key source type: ${(source as any).type}`);
  }

  async encrypt(data: Uint8Array, key: CryptoKey): Promise<AESEncryptedData> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertextWithTag = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      data
    );
    // AES-GCM appends the 16-byte auth tag to the ciphertext
    const raw = new Uint8Array(ciphertextWithTag);
    const ciphertext = raw.slice(0, raw.length - 16);
    const authTag = raw.slice(raw.length - 16);

    return {
      engine: 'aes',
      ciphertext,
      iv,
      authTag,
      keyDerivation: {
        source: 'wallet-signature',
        salt: new Uint8Array(32), // placeholder — real salt from deriveKey
        kdf: this.config.kdf === 'hkdf-sha256' ? 'hkdf-sha256' : 'pbkdf2-sha256',
      },
    };
  }

  async decrypt(encrypted: AESEncryptedData, key: CryptoKey): Promise<Uint8Array> {
    // Reconstruct ciphertext + authTag
    const combined = new Uint8Array(encrypted.ciphertext.length + encrypted.authTag.length);
    combined.set(encrypted.ciphertext, 0);
    combined.set(encrypted.authTag, encrypted.ciphertext.length);

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: encrypted.iv, tagLength: 128 },
      key,
      combined
    );
    return new Uint8Array(plaintext);
  }
}
