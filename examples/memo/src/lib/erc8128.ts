import { type Config, getAccount, signMessage } from "@wagmi/core";
import { toHex } from "viem";
import { config } from "./wagmi";

const RELAY = import.meta.env.VITE_RELAY_URL ?? "http://localhost:3000";

export async function createErc8128Headers(
  method: string,
  url: string,
  body?: string,
): Promise<Record<string, string>> {
  const challengeRes = await fetch(`${RELAY}/v1/auth/challenge`, { method: "POST" });
  const { nonce, timestamp } = (await challengeRes.json()) as {
    nonce: string;
    timestamp: number;
  };

  const bodyBytes = new TextEncoder().encode(body ?? "");
  const bodyHashBuf = await crypto.subtle.digest("SHA-256", bodyBytes);
  const bodyHash = toHex(new Uint8Array(bodyHashBuf));

  const payload = `${method}\n${url}\n${timestamp}\n${nonce}\n${bodyHash}`;

  const signature = await signMessage(config as Config, { message: payload });

  const account = getAccount(config as Config);
  const signer = account.address!;

  return {
    "X-OrbitMem-Signer": signer,
    "X-OrbitMem-Family": "evm",
    "X-OrbitMem-Algorithm": "ecdsa-secp256k1",
    "X-OrbitMem-Timestamp": String(timestamp),
    "X-OrbitMem-Nonce": nonce,
    "X-OrbitMem-Signature": signature,
  };
}
