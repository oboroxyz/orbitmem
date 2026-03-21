/**
 * Vault key derivation with optional caching.
 *
 * Derives a deterministic AES-256 key from a wallet signature
 * and caches the signature in storage to avoid re-prompting.
 */

import { AESEngine } from "./aes.js";

const CACHE_PREFIX = "orbitmem:vk";
const aes = new AESEngine({ kdf: "hkdf-sha256" });

export interface VaultKeyConfig {
  /** Wallet address (used as cache key discriminator) */
  address: string;
  /** Wallet signMessage function — returns hex signature */
  signMessage: (message: string) => Promise<string>;
  /** Storage adapter for caching (default: sessionStorage if available) */
  storage?: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  };
}

/**
 * Derive a vault encryption key, caching the signature to avoid
 * re-prompting the wallet on page reload.
 *
 * Usage:
 * ```ts
 * const { key, clear } = await deriveVaultKeyWithCache({
 *   address: "0x...",
 *   signMessage: (msg) => wagmiSignMessage({ message: msg }),
 * });
 * // Use `key` for encryption/decryption
 * // Call `clear()` on disconnect
 * ```
 */
export async function deriveVaultKeyWithCache(
  config: VaultKeyConfig,
): Promise<{ key: CryptoKey; clear: () => void }> {
  const { address, signMessage } = config;
  const storage = config.storage ?? (typeof sessionStorage !== "undefined" ? sessionStorage : null);
  const cacheKey = `${CACHE_PREFIX}:${address}`;

  let sig = storage?.getItem(cacheKey) ?? null;
  if (!sig) {
    sig = await signMessage("OrbitMem Vault Key v1");
    storage?.setItem(cacheKey, sig);
  }

  const sigBytes = new Uint8Array((sig.slice(2).match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)));
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", sigBytes as BufferSource));
  const key = await aes.deriveKey({ type: "raw", key: hash });

  return {
    key,
    clear() {
      storage?.removeItem(cacheKey);
    },
  };
}
