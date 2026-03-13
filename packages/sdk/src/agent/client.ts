import { createDiscoveryLayer } from "../discovery/index.js";
import { createEncryptionLayer } from "../encryption/index.js";
import { createTransportLayer } from "../transport/index.js";
import type { ClientConfig, EncryptedData, IOrbitMemClient } from "../types.js";

export function createOrbitMemClient(config: ClientConfig): IOrbitMemClient {
  const transport = createTransportLayer({
    signer: async (payload) => ({
      signature: await config.wallet.signMessage(payload),
      algorithm:
        config.wallet.family === "evm"
          ? "ecdsa-secp256k1"
          : config.wallet.family === "solana"
            ? "ed25519"
            : "p256",
    }),
    signerAddress: config.wallet.address,
    family: config.wallet.family,
  });

  const encryption = createEncryptionLayer({
    defaultEngine: config.lit ? "lit" : "aes",
    lit: config.lit,
    aes: { kdf: "hkdf-sha256" },
  });

  const discovery = config.discovery
    ? createDiscoveryLayer({
        dataRegistry: config.discovery.dataRegistry,
        reputationRegistry: config.discovery.reputationRegistry,
        registryChain: config.discovery.registryChain,
      })
    : null;

  return {
    async discoverData(query) {
      if (!discovery) return [];
      return discovery.findData(query);
    },

    async getDataScore(vaultAddress, path) {
      if (!discovery) {
        return {
          dataId: 0,
          vaultAddress,
          vaultKey: path,
          quality: 0,
          freshness: { lastUpdated: 0, score: 0 },
          accuracy: { score: 0, feedbackCount: 0 },
          completeness: { score: 0, feedbackCount: 0 },
          verified: false,
          consumptionCount: 0,
          totalFeedback: 0,
          tagScores: {},
        };
      }
      return discovery.getDataScore(vaultAddress, path);
    },

    async rateData(feedback) {
      if (!discovery) throw new Error("Discovery layer not configured");
      return discovery.rateData(feedback);
    },

    async readPublicData(request) {
      try {
        const url = `${request.relayUrl}/v1/vault/public/${encodeURIComponent(request.vaultAddress)}/${encodeURIComponent(request.path)}`;
        const res = await transport.fetch(url, { method: "GET" });
        if (!res.ok) return null;
        const body = (await res.json()) as any;
        return body.value ?? null;
      } catch {
        return null;
      }
    },

    async listPublicKeys(request) {
      try {
        const url = `${request.relayUrl}/v1/vault/public/${encodeURIComponent(request.vaultAddress)}/keys`;
        const params = request.prefix ? `?prefix=${encodeURIComponent(request.prefix)}` : "";
        const res = await transport.fetch(`${url}${params}`, { method: "GET" });
        if (!res.ok) return [];
        const body = (await res.json()) as any;
        return body.keys ?? [];
      } catch {
        return [];
      }
    },

    async fetchUserData(request) {
      const url = `${request.relayUrl}/v1/vault/read`;
      const res = await transport.fetch(url, {
        method: "POST",
        body: { vaultAddress: request.vaultAddress, path: request.path },
      });
      if (!res.ok) throw new Error(`Failed to fetch data: ${res.status}`);
      return res.json() as Promise<EncryptedData>;
    },

    async decrypt(encrypted, opts) {
      if (encrypted.engine === "aes" && opts?.sharedKey) {
        return encryption.decrypt(encrypted, {
          keySource: { type: "raw", key: opts.sharedKey },
        });
      }
      return encryption.decrypt(encrypted);
    },

    async withUserData(request, callback, opts) {
      // 1. Check data score
      const score = await this.getDataScore(request.vaultAddress, request.path);
      const minQuality = request.minQuality ?? config.discovery?.minDataQuality ?? 0;
      if (minQuality > 0 && score.quality < minQuality) {
        throw new Error(`Data quality ${score.quality} below threshold ${minQuality}`);
      }

      // 2. Fetch encrypted data
      const encrypted = await this.fetchUserData({
        vaultAddress: request.vaultAddress,
        path: request.path,
        relayUrl: request.relayUrl,
      });

      // 3. Decrypt
      const plaintext = await this.decrypt(encrypted, {
        sharedKey: opts?.sharedKey,
      });

      // 4. Execute callback
      let result: Awaited<ReturnType<typeof callback>>;
      try {
        result = await callback(plaintext, score);
      } finally {
        // 5. Zero plaintext buffer
        plaintext.fill(0);
      }

      // 6. Auto-rate if configured
      if (opts?.autoRate && discovery) {
        const dataReg = (await discovery.findData({})).find(
          (d) => d.vaultAddress === request.vaultAddress && d.vaultKey === request.path,
        );
        if (dataReg) {
          await discovery.rateData({
            dataId: dataReg.dataId,
            value: opts.autoRate.value,
            qualityDimension: opts.autoRate.qualityDimension,
          });
        }
      }

      return result;
    },
  };
}

/** @deprecated Use createOrbitMemClient instead */
export const createOrbitMemAgentAdapter = createOrbitMemClient;
