import { type SignMessageReturnType, signMessage } from "@wagmi/core";
import { sha256 } from "viem";

import { wagmiConfig } from "./wagmi";

/**
 * Generate ERC-8128 auth headers by signing a challenge from the relay.
 *
 * Flow:
 * 1. POST /auth/challenge → { message, nonce, timestamp }
 * 2. Sign the message via connected wallet
 * 3. Return headers for authenticated requests
 */
export async function createErc8128Headers(
  method: string,
  url: string,
  body?: string,
): Promise<Record<string, string>> {
  const challengeRes = await fetch("/api/auth/challenge", { method: "POST" });
  const { nonce, timestamp } = (await challengeRes.json()) as {
    nonce: string;
    timestamp: number;
  };

  const bodyHash = body
    ? sha256(new TextEncoder().encode(body))
    : sha256(new TextEncoder().encode(""));

  const payload = `${method}\n${url}\n${timestamp}\n${nonce}\n${bodyHash}`;

  let signature: SignMessageReturnType;
  try {
    signature = await signMessage(wagmiConfig, { message: payload });
  } catch {
    throw new Error("Wallet signature rejected");
  }

  const account = wagmiConfig.state.connections.get(wagmiConfig.state.current ?? "")?.accounts[0];
  if (!account) throw new Error("No wallet connected");

  return {
    "X-OrbitMem-Signer": account,
    "X-OrbitMem-Family": "evm",
    "X-OrbitMem-Algorithm": "ecdsa-secp256k1",
    "X-OrbitMem-Timestamp": String(timestamp),
    "X-OrbitMem-Nonce": nonce,
    "X-OrbitMem-Signature": signature,
  };
}
