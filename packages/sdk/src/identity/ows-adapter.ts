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
      // Export mnemonic from OWS and derive a full viem account that can
      // natively sign transactions (OWS signTransaction expects RLP hex,
      // but viem passes a JS object — so we use viem's own signer).
      const { exportWallet } = await ows();
      const mnemonic = exportWallet(walletName);
      const { mnemonicToAccount } = await import("viem/accounts");
      return mnemonicToAccount(mnemonic);
    },
  };
}
