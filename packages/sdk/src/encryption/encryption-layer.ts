import type {
  AESEncryptedData,
  EncryptAESOptions,
  EncryptionConfig,
  EncryptLitOptions,
  IEncryptionLayer,
  LitAccessCondition,
  LitEncryptedData,
} from "../types.js";
import { AESEngine } from "./aes.js";
import { LitEngine } from "./lit.js";

export function createEncryptionLayer(config: EncryptionConfig): IEncryptionLayer & {
  aes: AESEngine;
  lit: LitEngine | null;
} {
  const aes = new AESEngine({
    kdf: config.aes?.kdf ?? "hkdf-sha256",
    iterations: config.aes?.iterations,
  });
  const lit = config.lit
    ? new LitEngine({
        network:
          config.lit.network === "cayenne"
            ? "datil-dev"
            : config.lit.network === "manzano"
              ? "datil-test"
              : config.lit.network === "habanero"
                ? "datil"
                : (config.lit.network as any),
        debug: config.lit.debug,
      })
    : null;

  return {
    aes,
    lit,

    async encrypt(data, opts) {
      if (opts.engine === "aes") {
        const aesOpts = opts as EncryptAESOptions;
        const key = await aes.deriveKey(aesOpts.keySource);
        return aes.encrypt(data instanceof Uint8Array ? data : new TextEncoder().encode(data), key);
      }
      if (opts.engine === "lit") {
        if (!lit) throw new Error("Lit Protocol not configured");
        const litOpts = opts as EncryptLitOptions;
        const raw = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
        return lit.encrypt(raw, litOpts.accessConditions, litOpts.chain as string);
      }
      throw new Error(`Unknown engine: ${(opts as any).engine}`);
    },

    async decrypt(encrypted, opts) {
      if (encrypted.engine === "aes") {
        const aesData = encrypted as AESEncryptedData;
        if (!opts?.keySource) throw new Error("keySource required for AES decryption");
        const key = await aes.deriveKey(opts.keySource);
        return aes.decrypt(aesData, key);
      }
      if (encrypted.engine === "lit") {
        if (!lit) throw new Error("Lit Protocol not configured");
        if (!opts?.authSig) throw new Error("Lit decryption requires authSig in DecryptOptions");
        return lit.decrypt(encrypted as LitEncryptedData, opts.authSig);
      }
      throw new Error(`Unknown engine: ${(encrypted as any).engine}`);
    },

    async grantAccess(encrypted, agentAddress, opts) {
      if (!lit) throw new Error("Lit Protocol not configured");
      const newCondition = lit.createAddressCondition(
        agentAddress as string,
        (opts?.chain ?? "base") as any,
      );
      const updatedConditions: LitAccessCondition[] = [
        ...encrypted.accessControlConditions,
        { operator: "or" as const },
        newCondition,
      ];
      return { ...encrypted, accessControlConditions: updatedConditions };
    },

    async revokeAccess(encrypted, agentAddress) {
      const filtered = encrypted.accessControlConditions.filter(
        (c: any) => !("returnValueTest" in c && c.returnValueTest?.value === agentAddress),
      );
      return { ...encrypted, accessControlConditions: filtered };
    },

    async deriveAESKey(source) {
      return aes.deriveKey(source);
    },

    async canDecrypt(encrypted) {
      if (encrypted.engine === "aes") return true; // caller must have key
      if (encrypted.engine === "lit") return lit !== null;
      return false;
    },
  };
}
