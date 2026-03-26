import type { SignatureAlgorithm, WalletAddress } from "../types.js";

export interface OwsAdapter {
  getAddress(): Promise<WalletAddress>;
  signMessage(message: string): Promise<{ signature: Uint8Array; algorithm: SignatureAlgorithm }>;
  toViemAccount(): Promise<import("viem").Account>;
}

/**
 * @param walletName — OWS wallet name (e.g., "orbitmem")
 * @param chain — CAIP-2 chain ID (e.g., "eip155:84532" for Base Sepolia)
 */
export function createOwsAdapter(walletName: string, chain: string): OwsAdapter {
  // OWS NAPI-RS bindings are synchronous — wrap in lazy import for ESM compat.
  const ows = () => import("@open-wallet-standard/core");

  function hexToBytes(hex: string): Uint8Array {
    const clean = hex.replace(/^0x/, "");
    return new Uint8Array(clean.match(/.{2}/g)!.map((b) => Number.parseInt(b, 16)));
  }

  /**
   * Find the EVM address for the given CAIP-2 chain from WalletInfo.accounts.
   * Falls back to the first eip155 account if exact chain not found.
   */
  function resolveAddress(accounts: Array<{ chainId: string; address: string }>): string {
    const exact = accounts.find((a) => a.chainId === chain);
    if (exact) return exact.address;
    const evm = accounts.find((a) => a.chainId.startsWith("eip155:"));
    if (evm) return evm.address;
    throw new Error(`No EVM account found for chain ${chain} in wallet "${walletName}"`);
  }

  return {
    async getAddress(): Promise<WalletAddress> {
      const { getWallet } = await ows();
      const wallet = getWallet(walletName);
      return resolveAddress(wallet.accounts) as WalletAddress;
    },

    async signMessage(
      message: string,
    ): Promise<{ signature: Uint8Array; algorithm: SignatureAlgorithm }> {
      const { signMessage: owsSign } = await ows();
      const result = owsSign(walletName, chain, message);
      return { signature: hexToBytes(result.signature), algorithm: "ecdsa-secp256k1" };
    },

    async toViemAccount(): Promise<import("viem").Account> {
      const address = await this.getAddress();
      const { toAccount } = await import("viem/accounts");
      return toAccount({
        address: address as `0x${string}`,
        async signMessage({ message }) {
          const { signMessage: owsSign } = await ows();
          const msg =
            typeof message === "string"
              ? message
              : typeof message === "object" && "raw" in message
                ? typeof message.raw === "string"
                  ? message.raw
                  : new TextDecoder().decode(message.raw)
                : String(message);
          const result = owsSign(walletName, chain, msg);
          return result.signature as `0x${string}`;
        },
        async signTransaction(tx) {
          const { signTransaction: owsSignTx } = await ows();
          const result = owsSignTx(walletName, chain, JSON.stringify(tx));
          return result.signature as `0x${string}`;
        },
        async signTypedData(typedData) {
          const { signTypedData: owsSignTyped } = await ows();
          const result = owsSignTyped(walletName, chain, JSON.stringify(typedData));
          return result.signature as `0x${string}`;
        },
      });
    },
  };
}
