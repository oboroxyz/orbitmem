import { createSignerClient } from "@slicekit/erc8128";
import type { EthHttpSigner } from "@slicekit/erc8128";

import type { ChainFamily, ITransportLayer, SignatureAlgorithm, WalletAddress } from "../types.js";

interface TransportConfig {
  signer: (
    payload: Uint8Array,
  ) => Promise<{ signature: Uint8Array; algorithm: SignatureAlgorithm }>;
  verifier?: (
    payload: Uint8Array,
    signature: Uint8Array,
    algorithm: SignatureAlgorithm,
  ) => Promise<boolean>;
  signerAddress: WalletAddress;
  family: ChainFamily;
  nonceTTL?: number; // ms, default 5 min
  /** ERC-8128 chain ID (default 84532 = Base Sepolia) */
  chainId?: number;
}

export function createTransportLayer(config: TransportConfig): ITransportLayer {
  const nonceCache = new Map<string, number>(); // nonce -> timestamp
  const NONCE_TTL = config.nonceTTL ?? 5 * 60 * 1000;
  const TIMESTAMP_TOLERANCE = 30 * 1000; // ±30s

  // Periodic cleanup
  function cleanNonces() {
    const now = Date.now();
    for (const [nonce, ts] of nonceCache) {
      if (now - ts > NONCE_TTL) nonceCache.delete(nonce);
    }
  }

  async function computePayload(
    method: string,
    url: string,
    timestamp: number,
    nonce: string,
    body?: unknown,
  ): Promise<Uint8Array> {
    const bodyHash = body
      ? new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(body))),
        )
      : new Uint8Array(0);
    const payload = new TextEncoder().encode(
      `${method}\n${url}\n${timestamp}\n${nonce}\n${Array.from(bodyHash)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")}`,
    );
    return payload;
  }

  return {
    async createSignedRequest(request) {
      const timestamp = Date.now();
      const nonce = crypto.randomUUID();
      const payload = await computePayload(
        request.method,
        request.url,
        timestamp,
        nonce,
        request.body,
      );
      const { signature, algorithm } = await config.signer(payload);

      const headers: Record<string, string> = {
        ...request.headers,
        "X-OrbitMem-Signer": config.signerAddress as string,
        "X-OrbitMem-Family": config.family,
        "X-OrbitMem-Algorithm": algorithm,
        "X-OrbitMem-Timestamp": String(timestamp),
        "X-OrbitMem-Nonce": nonce,
        "X-OrbitMem-Signature": Array.from(signature)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
      };

      return {
        url: request.url,
        method: request.method ?? "GET",
        headers,
        body: request.body,
        proof: {
          signer: config.signerAddress,
          family: config.family,
          signature,
          algorithm,
          timestamp,
          nonce,
        },
      };
    },

    async verifyRequest(request) {
      cleanNonces();

      const { proof } = request;

      // Timestamp check
      const now = Date.now();
      if (Math.abs(now - proof.timestamp) > TIMESTAMP_TOLERANCE) {
        return { valid: false, signer: proof.signer, family: proof.family, isReplay: false };
      }

      // Nonce replay check
      if (nonceCache.has(proof.nonce)) {
        return { valid: true, signer: proof.signer, family: proof.family, isReplay: true };
      }

      // Signature verification
      if (config.verifier) {
        const payload = await computePayload(
          request.method,
          request.url,
          proof.timestamp,
          proof.nonce,
          request.body,
        );
        const valid = await config.verifier(payload, proof.signature, proof.algorithm);
        if (valid) {
          nonceCache.set(proof.nonce, Date.now());
        }
        return { valid, signer: proof.signer, family: proof.family, isReplay: false };
      }

      // No verifier — trust the signature (for client-side use)
      nonceCache.set(proof.nonce, Date.now());
      return { valid: true, signer: proof.signer, family: proof.family, isReplay: false };
    },

    async fetch(url, init) {
      const signed = await this.createSignedRequest({
        url,
        method: (init?.method as any) ?? "GET",
        headers: init?.headers,
        body: init?.body,
      });

      return globalThis.fetch(signed.url, {
        method: signed.method,
        headers: signed.headers,
        body: signed.body ? JSON.stringify(signed.body) : undefined,
      });
    },
  };
}

/**
 * Create an RFC 9421 / ERC-8128 compliant transport layer using @slicekit/erc8128.
 * This is the recommended transport for new integrations.
 */
export function createErc8128TransportLayer(config: {
  signer: EthHttpSigner;
  /** Whether to prefer replayable signatures (default false) */
  preferReplayable?: boolean;
  /** Signature TTL in seconds (default 60) */
  ttlSeconds?: number;
}) {
  const client = createSignerClient(config.signer, {
    preferReplayable: config.preferReplayable ?? false,
    ttlSeconds: config.ttlSeconds ?? 60,
  });

  return {
    client,
    signRequest: (input: RequestInfo, init?: RequestInit) => client.signRequest(input, init),
    fetch: (input: RequestInfo, init?: RequestInit) => client.fetch(input, init),
  };
}
