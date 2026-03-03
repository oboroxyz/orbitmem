import type {
  EvmAddress,
  EvmChain,
  LitAccessCondition,
  LitAuthSig,
  LitEncryptedData,
  LitEvmCondition,
} from "../types.js";

export interface LitConfig {
  network: "datil-dev" | "datil-test" | "datil";
  debug?: boolean;
}

export class LitEngine {
  private config: LitConfig;
  private client: any | null = null;

  constructor(config: LitConfig) {
    this.config = config;
  }

  /** Lazy-initialize the Lit client (heavy import) */
  async getClient(): Promise<any> {
    if (this.client) return this.client;
    const { LitNodeClient } = await import("@lit-protocol/lit-node-client");
    const { LIT_NETWORK } = await import("@lit-protocol/constants");
    const networkMap: Record<string, string> = {
      "datil-dev": LIT_NETWORK.DatilDev,
      "datil-test": LIT_NETWORK.DatilTest,
      datil: LIT_NETWORK.Datil,
    };
    this.client = new LitNodeClient({
      litNetwork: networkMap[this.config.network] as any,
      debug: this.config.debug ?? false,
    });
    await this.client.connect();
    return this.client;
  }

  async getSessionSigs(authSig: LitAuthSig, chain: string): Promise<any> {
    const client = await this.getClient();
    const { LitAbility } = await import("@lit-protocol/constants");
    const { LitAccessControlConditionResource, createSiweMessageWithRecaps, generateAuthSig } =
      await import("@lit-protocol/auth-helpers");

    const litResource = new LitAccessControlConditionResource("*");

    return client.getSessionSigs({
      chain,
      resourceAbilityRequests: [
        { resource: litResource, ability: LitAbility.AccessControlConditionDecryption },
      ],
      authNeededCallback: async (params: {
        uri?: string;
        expiration?: string;
        resourceAbilityRequests?: any[];
      }) => {
        const toSign = await createSiweMessageWithRecaps({
          uri: params.uri!,
          expiration: params.expiration!,
          resources: params.resourceAbilityRequests!,
          walletAddress: authSig.address,
          nonce: await client.getLatestBlockhash(),
          litNodeClient: client,
        });
        return generateAuthSig({
          signer: {
            signMessage: async () => authSig.sig,
            getAddress: async () => authSig.address,
          } as any,
          toSign,
        });
      },
    });
  }

  async encrypt(
    data: Uint8Array,
    accessConditions: LitAccessCondition[],
    chain: string = "ethereum",
  ): Promise<LitEncryptedData> {
    const client = await this.getClient();
    const { encryptUint8Array } = await import("@lit-protocol/encryption");
    const { ciphertext, dataToEncryptHash } = await encryptUint8Array(
      { accessControlConditions: accessConditions as any, dataToEncrypt: data },
      client,
    );
    return {
      engine: "lit",
      ciphertext:
        typeof ciphertext === "string" ? new TextEncoder().encode(ciphertext) : ciphertext,
      dataToEncryptHash,
      accessControlConditions: accessConditions,
      chain: chain as any,
    };
  }

  async decrypt(encrypted: LitEncryptedData, sessionSigsOrAuthSig: any): Promise<Uint8Array> {
    let sessionSigs = sessionSigsOrAuthSig;

    // If an authSig object is passed, resolve it to sessionSigs
    if (sessionSigsOrAuthSig?.sig && sessionSigsOrAuthSig?.address) {
      sessionSigs = await this.getSessionSigs(
        sessionSigsOrAuthSig as LitAuthSig,
        encrypted.chain as string,
      );
    }

    const client = await this.getClient();
    const { decryptToUint8Array } = await import("@lit-protocol/encryption");
    return decryptToUint8Array(
      {
        accessControlConditions: encrypted.accessControlConditions as any,
        chain: encrypted.chain as string,
        ciphertext:
          typeof encrypted.ciphertext === "string"
            ? encrypted.ciphertext
            : new TextDecoder().decode(encrypted.ciphertext),
        dataToEncryptHash: encrypted.dataToEncryptHash,
        sessionSigs,
      },
      client,
    );
  }

  createAddressCondition(address: string, chain: EvmChain): LitEvmCondition {
    return {
      conditionType: "evmBasic",
      contractAddress: "" as EvmAddress,
      standardContractType: "",
      chain,
      method: "",
      parameters: [":userAddress"],
      returnValueTest: { comparator: "=", value: address },
    };
  }

  createReputationCondition(opts: {
    registryAddress: string;
    minScore: number;
    chain: EvmChain;
  }): LitEvmCondition {
    return {
      conditionType: "evmContract",
      contractAddress: opts.registryAddress as EvmAddress,
      standardContractType: "",
      chain: opts.chain,
      method: "getScore",
      parameters: [":userAddress"],
      returnValueTest: { comparator: ">=", value: String(opts.minScore) },
    };
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }
}
