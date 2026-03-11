// ════════════════════════════════════════════════════════════
//  OrbitMem SDK — Type Definitions & Interfaces
//  The Sovereign Data Layer for the Agentic Web
//  v0.3.0 — Multi-Chain (Porto + EVM + Solana) · Pluggable Encryption · ERC-8004 Bidirectional Trust
// ════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────
//  1. PRIMITIVE TYPES
// ────────────────────────────────────────────────────────────

/** EVM hex address */
export type EvmAddress = `0x${string}`;

/** Solana base58 public key */
export type SolanaPublicKey = string;

/** Unified address across chains */
export type WalletAddress = EvmAddress | SolanaPublicKey;

/** Content Identifier (IPFS / Filecoin) */
export type CID = string;

/** OrbitDB database address */
export type OrbitAddress = string;

/** Supported chain families */
export type ChainFamily = "passkey" | "evm" | "solana";

/** EVM chain identifiers */
export type EvmChain = "ethereum" | "polygon" | "optimism" | "arbitrum" | "base" | "base-sepolia";

/** Solana cluster identifiers */
export type SolanaCluster = "mainnet-beta" | "devnet" | "testnet";

/** Unified chain type */
export type Chain = EvmChain | SolanaCluster;

/** Encryption engine choice */
export type EncryptionEngine = "lit" | "aes";

/**
 * Data visibility level.
 *
 * - `public`:  Plaintext. Anyone with the vault address can read via Relay.
 *              Use for agent profiles, public preferences, discovery metadata.
 *
 * - `private`: Encrypted with owner-only key (AES, wallet-derived).
 *              Only the wallet that wrote it can decrypt.
 *
 * - `shared`:  Encrypted with access conditions (Lit or AES shared key).
 *              Specific agents / addresses can decrypt if conditions are met.
 */
export type Visibility = "public" | "private" | "shared";

/** Signature algorithm determined by chain family */
export type SignatureAlgorithm = "p256" | "ecdsa-secp256k1" | "ed25519";

// ────────────────────────────────────────────────────────────
//  2. IDENTITY LAYER — Multi-Chain Wallet Auth
// ────────────────────────────────────────────────────────────

/** Configuration for the Identity Layer */
export interface IdentityConfig {
  /** Supported chain families (default: ["evm"]) */
  chains?: ChainFamily[];
  /** EVM private key for CLI / server-side usage (hex string) */
  privateKey?: string;
  /** Porto Passkey config (optional if not using passkey auth) */
  passkey?: {
    /** WebAuthn Relying Party ID (e.g., "app.orbitmem.xyz") */
    rpId: string;
    /** Display name shown during biometric prompts */
    rpName: string;
    /**
     * EVM chain to delegate the smart account to (EIP-7702).
     * Porto creates a P256-backed EOA and can delegate to EVM chains.
     */
    delegationChain?: EvmChain;
    /** Whether to enable session keys via EIP-7715 */
    enableSessionKeys?: boolean;
  };
  /** EVM-specific config (optional if only Solana/Passkey) */
  evm?: {
    chains: EvmChain[];
    /** WalletConnect project ID for mobile wallet support */
    walletConnectProjectId?: string;
    /** Supported wallet adapters */
    adapters?: EvmWalletAdapter[];
  };
  /** Solana-specific config (optional if only EVM) */
  solana?: {
    cluster: SolanaCluster;
    /** Supported wallet adapters */
    adapters?: SolanaWalletAdapter[];
  };
  /** Session key TTL in seconds (default: 3600) */
  sessionTTL?: number;
}

export type EvmWalletAdapter = "metamask" | "walletconnect" | "coinbase" | "rabby" | "injected";

export type SolanaWalletAdapter = "phantom" | "solflare" | "backpack" | "glow" | "injected";

/** Result of a successful wallet connection */
export interface WalletConnection {
  /** Which chain family was connected */
  family: ChainFamily;
  /** The wallet address (EVM hex / Solana base58 / Porto-derived EVM address) */
  address: WalletAddress;
  /** Which specific chain / cluster (undefined for passkey until delegation) */
  chain?: Chain;
  /** Signature algorithm available */
  signatureAlgorithm: SignatureAlgorithm;
  /** Display name from wallet (if available) */
  displayName?: string;
  /** WebAuthn credential ID (only for passkey connections) */
  credentialId?: string;
  /** Connection timestamp */
  connectedAt: number;
}

/** Session key — ephemeral key derived from wallet signature */
export interface SessionKey {
  /** Ephemeral session identifier */
  id: string;
  /** The parent wallet address that created this session */
  parentAddress: WalletAddress;
  /** Chain family of the parent wallet */
  family: ChainFamily;
  /** Session-specific address (derived) */
  sessionAddress: WalletAddress;
  /** Permissions granted */
  permissions: SessionPermission[];
  /** Expiry timestamp (unix ms) */
  expiresAt: number;
  /** Whether the session is currently valid */
  isActive: boolean;
  /** Signature algorithm used for session signing */
  algorithm: SignatureAlgorithm;
}

export type SessionPermission =
  | { type: "vault:read"; keys?: string[] }
  | { type: "vault:write"; keys?: string[] }
  | { type: "vault:delete"; keys?: string[] }
  | { type: "relay:fetch" }
  | { type: "encrypt"; engines?: EncryptionEngine[] }
  | { type: "decrypt"; engines?: EncryptionEngine[] }
  | { type: "storacha:archive" }
  | { type: "storacha:retrieve" };

/** Identity Layer interface */
export interface IIdentityLayer {
  /**
   * Connect a wallet or create/use a Passkey.
   *
   * - `passkey`: Triggers biometric prompt (FaceID/TouchID/Windows Hello).
   *   Creates a P256-backed account via Porto. The derived address is EVM-
   *   compatible via EIP-7702 smart account delegation.
   *
   * - `evm`: Opens the selected EVM wallet adapter.
   *
   * - `solana`: Opens the selected Solana wallet adapter.
   */
  connect(opts: {
    method: ChainFamily;
    /** Preferred adapter (for evm/solana only — ignored for passkey) */
    adapter?: EvmWalletAdapter | SolanaWalletAdapter;
    /** Specific chain/cluster to target */
    targetChain?: Chain;
  }): Promise<WalletConnection>;

  /**
   * Create a new Porto Passkey credential.
   * Only available when method='passkey'. Triggers WebAuthn registration.
   */
  createPasskey(): Promise<{
    credentialId: string;
    publicKey: Uint8Array;
    address: EvmAddress;
  }>;

  /**
   * Disconnect the current wallet.
   */
  disconnect(): Promise<void>;

  /**
   * Sign a challenge message to prove wallet ownership.
   * Used internally during session creation.
   */
  signChallenge(message: string): Promise<{
    signature: Uint8Array;
    algorithm: SignatureAlgorithm;
  }>;

  /**
   * Create an ephemeral session key with scoped permissions.
   * The session key is derived from a wallet signature.
   */
  createSessionKey(permissions: SessionPermission[], opts?: { ttl?: number }): Promise<SessionKey>;

  /**
   * Resume an existing session (e.g., after page reload).
   * Returns null if expired or not found.
   */
  resumeSession(sessionId: string): Promise<SessionKey | null>;

  /**
   * Revoke a session key immediately.
   */
  revokeSession(sessionId: string): Promise<void>;

  /**
   * Get the current wallet connection (or null).
   */
  getConnection(): WalletConnection | null;

  /**
   * Get the active session (or null).
   */
  getActiveSession(): SessionKey | null;

  /**
   * Subscribe to connection state changes.
   */
  onConnectionChange(callback: (connection: WalletConnection | null) => void): () => void;
}

// ────────────────────────────────────────────────────────────
//  3. TRANSPORT LAYER — ERC-8128 Signed HTTP
// ────────────────────────────────────────────────────────────

/** Signed HTTP request envelope */
export interface SignedRequest {
  /** Original request URL */
  url: string;
  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "DELETE";
  /** Request headers (signature headers injected automatically) */
  headers: Record<string, string>;
  /** Request body (if any) */
  body?: unknown;
  /** ERC-8128 signature metadata */
  proof: {
    /** The session address that signed */
    signer: WalletAddress;
    /** Chain family of the signer */
    family: ChainFamily;
    /** Signature bytes */
    signature: Uint8Array;
    /** Signature algorithm */
    algorithm: SignatureAlgorithm;
    /** Timestamp of signing (unix ms) */
    timestamp: number;
    /** Nonce to prevent replay */
    nonce: string;
  };
}

/** Verification result */
export interface VerificationResult {
  /** Whether the signature is valid */
  valid: boolean;
  /** Recovered signer address */
  signer: WalletAddress;
  /** Chain family */
  family: ChainFamily;
  /** Whether the nonce has been seen before (replay detection) */
  isReplay: boolean;
}

/** Transport Layer interface */
export interface ITransportLayer {
  /**
   * Create and sign an HTTP request using ERC-8128.
   * Automatically uses the active session key.
   */
  createSignedRequest(request: {
    url: string;
    method: "GET" | "POST" | "PUT" | "DELETE";
    headers?: Record<string, string>;
    body?: unknown;
  }): Promise<SignedRequest>;

  /**
   * Verify an incoming signed request.
   * Used by Relay Nodes to authenticate agent requests.
   */
  verifyRequest(request: SignedRequest): Promise<VerificationResult>;

  /**
   * Send a signed request and return the response.
   * Convenience method that wraps createSignedRequest + fetch.
   */
  fetch(
    url: string,
    init?: {
      method?: "GET" | "POST" | "PUT" | "DELETE";
      headers?: Record<string, string>;
      body?: unknown;
    },
  ): Promise<Response>;
}

// ────────────────────────────────────────────────────────────
//  4. DATA LAYER — OrbitDB Nested P2P Vault
// ────────────────────────────────────────────────────────────

/**
 * Vault path — supports nested access via slash-separated strings
 * or string arrays. Examples:
 *   "travel/dietary"
 *   "travel/budget/max"
 *   ["travel", "passport", "number"]
 */
export type VaultPath = string | string[];

/** Vault configuration */
export interface VaultConfig {
  /** OrbitDB database name (default: derived from wallet address) */
  dbName?: string;
  /** Database type: "nested" uses @orbitdb/nested-db for JSON-like
   *  hierarchical storage with path-based access (default: "nested") */
  databaseType?: "nested" | "keyvalue";
  /** Relay node multiaddr for syncing */
  relayNode?: string;
  /** Auto-sync interval in ms (default: 30000) */
  syncInterval?: number;
  /** Enable offline-first mode (default: true) */
  offlineFirst?: boolean;
}

/** A single vault entry with metadata */
export interface VaultEntry<T = unknown> {
  /** The stored value (plaintext if public, encrypted blob if private/shared) */
  value: T;
  /** Visibility level */
  visibility: Visibility;
  /** Who wrote this entry (wallet address) */
  author: WalletAddress;
  /** Chain family of the author */
  authorChain: ChainFamily;
  /** When it was written (unix ms) */
  timestamp: number;
  /** Whether this entry is encrypted (false for public) */
  encrypted: boolean;
  /** Which encryption engine was used (undefined for public) */
  encryptionEngine?: EncryptionEngine;
  /** OrbitDB entry hash */
  hash: string;
}

/** Sync status */
export interface SyncStatus {
  /** Whether currently syncing */
  syncing: boolean;
  /** Number of local entries pending push */
  pendingPush: number;
  /** Number of remote entries pending pull */
  pendingPull: number;
  /** Last successful sync timestamp */
  lastSynced: number | null;
  /** Connected peers count */
  connectedPeers: number;
}

/** Data Layer interface — backed by @orbitdb/nested-db */
export interface IDataLayer {
  /**
   * Store a value at a nested path.
   *
   * Paths use "/" separators or string arrays:
   *   vault.put("travel/dietary", "vegan")
   *   vault.put(["travel", "budget"], { min: 1000, max: 2000 })
   *
   * Each path can have its own visibility & encryption:
   *   vault.put("travel/dietary", "vegan", { visibility: "public" })
   *   vault.put("travel/passport", { ... }, { visibility: "private" })
   *   vault.put("travel/budget", { ... }, {
   *     visibility: "shared",
   *     engine: "lit",
   *     accessConditions: [reputationCondition({ minScore: 70 })],
   *   })
   *
   * Default visibility is `private` (encrypted, owner-only).
   */
  put<T = unknown>(
    path: VaultPath,
    value: T,
    opts?: {
      /** Visibility level (default: 'private') */
      visibility?: Visibility;
      /** Encryption engine override (for 'shared'; 'private' defaults to 'aes') */
      engine?: EncryptionEngine;
      /** Lit access conditions (required if visibility='shared' + engine='lit') */
      accessConditions?: LitAccessCondition[];
      /** AES shared key source (for visibility='shared' + engine='aes') */
      sharedKeySource?: AESKeySource;
    },
  ): Promise<VaultEntry<T>>;

  /**
   * Insert a nested object, merging with existing data.
   * Equivalent to calling put() for each leaf path.
   *
   *   vault.insert({ travel: { dietary: "vegan", budget: 2000 } })
   *   // same as:
   *   vault.put("travel/dietary", "vegan")
   *   vault.put("travel/budget", 2000)
   *
   * @param prefix - Optional root prefix for all paths
   * @param obj    - Nested object to merge
   * @param opts   - Visibility/encryption applied to all leaf entries
   */
  insert<T extends Record<string, unknown> = Record<string, unknown>>(
    obj: T,
    opts?: {
      prefix?: string;
      visibility?: Visibility;
      engine?: EncryptionEngine;
      accessConditions?: LitAccessCondition[];
    },
  ): Promise<void>;

  /**
   * Retrieve a value by path.
   *
   *   vault.get("travel")          → { dietary: "vegan", budget: 2000, passport: {...} }
   *   vault.get("travel/dietary")  → "vegan"
   *   vault.get("travel/budget")   → 2000
   *
   * Returns the subtree if the path points to a nested object.
   * Auto-decrypts if the caller has permission.
   * Returns null if the path or any ancestor does not exist.
   */
  get<T = unknown>(path: VaultPath): Promise<VaultEntry<T> | null>;

  /**
   * Delete a path and all its children from the vault.
   *
   *   vault.del("travel/passport")  → deletes only passport
   *   vault.del("travel")           → deletes entire travel subtree
   */
  del(path: VaultPath): Promise<void>;

  /**
   * List all leaf keys, optionally filtered by path prefix.
   *
   *   vault.keys()          → ["travel/dietary", "travel/budget", "travel/passport/number", ...]
   *   vault.keys("travel")  → ["travel/dietary", "travel/budget", ...]
   */
  keys(prefix?: string): Promise<string[]>;

  /**
   * Get the entire vault as a nested JSON object.
   *
   *   vault.all()  → { travel: { dietary: "vegan", budget: 2000, ... } }
   */
  all<T = Record<string, unknown>>(): Promise<T>;

  /**
   * Query entries by filter.
   */
  query<T = unknown>(filter: {
    prefix?: string;
    author?: WalletAddress;
    visibility?: Visibility;
    since?: number;
    limit?: number;
  }): Promise<VaultEntry<T>[]>;

  /**
   * Force sync with the relay node.
   */
  sync(): Promise<SyncStatus>;

  /**
   * Get current sync status.
   */
  getSyncStatus(): SyncStatus;

  /**
   * Subscribe to real-time changes.
   */
  onChange(
    callback: (event: { type: "put" | "delete"; path: string; entry?: VaultEntry }) => void,
  ): () => void;

  /**
   * Export the entire vault as an encrypted snapshot.
   */
  exportSnapshot(): Promise<{
    data: Uint8Array;
    entryCount: number;
    timestamp: number;
  }>;

  /**
   * Import a snapshot into the vault (merge with CRDT).
   */
  importSnapshot(data: Uint8Array): Promise<{ merged: number; conflicts: number }>;
}

// ────────────────────────────────────────────────────────────
//  5. ENCRYPTION LAYER — Lit Protocol + AES-256-GCM
// ────────────────────────────────────────────────────────────

// --- Lit Protocol Types ---

/** Lit Protocol access control condition (EVM) */
export interface LitEvmCondition {
  conditionType: "evmBasic" | "evmContract";
  contractAddress: EvmAddress | "";
  standardContractType: "" | "ERC20" | "ERC721" | "ERC1155";
  chain: EvmChain;
  method: string;
  parameters: string[];
  returnValueTest: {
    comparator: ">" | "<" | ">=" | "<=" | "=" | "!=";
    value: string;
  };
}

/** Lit Protocol access control condition (Solana) */
export interface LitSolanaCondition {
  conditionType: "solRpc";
  method: string;
  params: string[];
  chain: "solana";
  returnValueTest: {
    comparator: string;
    value: string;
  };
}

/** Boolean operator for combining conditions */
export interface LitBooleanOperator {
  operator: "and" | "or";
}

/** Unified Lit access condition */
export type LitAccessCondition = LitEvmCondition | LitSolanaCondition | LitBooleanOperator;

/** Lit-encrypted blob */
export interface LitEncryptedData {
  engine: "lit";
  /** Encrypted data bytes */
  ciphertext: Uint8Array;
  /** Encrypted symmetric key (held by Lit MPC network) */
  dataToEncryptHash: string;
  /** The access conditions required for decryption */
  accessControlConditions: LitAccessCondition[];
  /** Chain used for condition evaluation */
  chain: Chain;
}

// --- AES Types ---

/** AES key derivation source */
export type AESKeySource =
  | { type: "wallet-signature"; message?: string }
  | { type: "password"; password: string }
  | { type: "raw"; key: Uint8Array };

/** AES-encrypted blob */
export interface AESEncryptedData {
  engine: "aes";
  /** AES-256-GCM ciphertext */
  ciphertext: Uint8Array;
  /** Initialization vector */
  iv: Uint8Array;
  /** Authentication tag */
  authTag: Uint8Array;
  /** Key derivation metadata (no secret material) */
  keyDerivation: {
    source: "wallet-signature" | "password" | "raw";
    /** Salt used for HKDF/PBKDF2 */
    salt: Uint8Array;
    /** Algorithm used for key derivation */
    kdf: "hkdf-sha256" | "pbkdf2-sha256";
    /** Iterations (if PBKDF2) */
    iterations?: number;
  };
}

/** Union of encrypted data types */
export type EncryptedData = LitEncryptedData | AESEncryptedData;

/** Encryption Layer configuration */
export interface EncryptionConfig {
  /** Default encryption engine */
  defaultEngine: EncryptionEngine;
  /** Lit Protocol configuration (required if using 'lit') */
  lit?: {
    /** Lit network: 'cayenne' | 'manzano' | 'habanero' */
    network: "cayenne" | "manzano" | "habanero";
    /** Debug mode */
    debug?: boolean;
  };
  /** AES configuration */
  aes?: {
    /** Default key derivation function */
    kdf: "hkdf-sha256" | "pbkdf2-sha256";
    /** PBKDF2 iterations (default: 100000) */
    iterations?: number;
  };
}

/** Encryption Layer interface */
export interface IEncryptionLayer {
  /**
   * Encrypt data using the specified engine.
   *
   * - `lit`: Requires `accessConditions`. Data is encrypted with a symmetric
   *   key that is then split across the Lit MPC network. Decryption requires
   *   meeting the on-chain conditions.
   *
   * - `aes`: Requires `keySource`. Data is encrypted locally with
   *   AES-256-GCM. The key is derived from the wallet signature, a password,
   *   or provided directly. No network calls needed.
   */
  encrypt(
    data: Uint8Array | string,
    opts: EncryptLitOptions | EncryptAESOptions,
  ): Promise<EncryptedData>;

  /**
   * Decrypt data. Automatically detects engine from the blob metadata.
   *
   * - `lit`: Requests decryption from the Lit MPC network. The caller must
   *   meet the access conditions (wallet signed auth).
   *
   * - `aes`: Derives the key locally and decrypts. The caller must provide
   *   the same key source used during encryption.
   */
  decrypt(encrypted: EncryptedData, opts?: DecryptOptions): Promise<Uint8Array>;

  /**
   * Grant an agent address access to Lit-encrypted data.
   * Only applicable for engine='lit'. Adds the address to the access
   * control conditions and re-encrypts the symmetric key.
   */
  grantAccess(
    encrypted: LitEncryptedData,
    agentAddress: WalletAddress,
    opts?: {
      /** Chain to evaluate the condition on */
      chain?: Chain;
      /** Time-limited access (unix timestamp) */
      expiresAt?: number;
    },
  ): Promise<LitEncryptedData>;

  /**
   * Revoke an agent's access to Lit-encrypted data.
   */
  revokeAccess(encrypted: LitEncryptedData, agentAddress: WalletAddress): Promise<LitEncryptedData>;

  /**
   * Derive an AES-256 key from a wallet signature.
   * Useful for pre-generating keys for batch operations.
   */
  deriveAESKey(source: AESKeySource): Promise<CryptoKey>;

  /**
   * Check if the current session can decrypt the given blob.
   * For Lit: simulates condition evaluation.
   * For AES: checks if the key source is available.
   */
  canDecrypt(encrypted: EncryptedData): Promise<boolean>;
}

/** Options for Lit encryption */
export interface EncryptLitOptions {
  engine: "lit";
  /** Access control conditions (who can decrypt) */
  accessConditions: LitAccessCondition[];
  /** Chain for condition evaluation */
  chain?: Chain;
}

/** Options for AES encryption */
export interface EncryptAESOptions {
  engine: "aes";
  /** How to derive/obtain the AES key */
  keySource: AESKeySource;
}

/** Lit Protocol auth signature — proves wallet ownership to Lit nodes */
export interface LitAuthSig {
  sig: string;
  derivedVia: string;
  signedMessage: string;
  address: string;
}

/** Options for decryption (engine auto-detected from blob) */
export interface DecryptOptions {
  /** For AES: provide key source if not cached */
  keySource?: AESKeySource;
  /** For Lit: wallet auth signature used to obtain sessionSigs */
  authSig?: LitAuthSig;
}

// ────────────────────────────────────────────────────────────
//  6. PERSISTENCE LAYER — Storacha (Filecoin / IPFS)
// ────────────────────────────────────────────────────────────

/** Configuration for the persistence layer — determines mode from shape */
export interface StorachaConfig {
  /** Mock mode for testing (in-memory) */
  mock?: boolean;
  /** Relay URL for managed persistence (free/paid tiers) */
  relayUrl?: string;
  /** Serialized UCAN delegation proof for direct Storacha uploads (BYOS) */
  proof?: string;
  /** Optional IPFS gateway URL (default: https://w3s.link) */
  gatewayUrl?: string;
  /** Auto-archive interval in ms (0 = manual only) */
  autoArchiveInterval?: number;
  /** Maximum snapshot size in bytes (default: 10MB) */
  maxSnapshotSize?: number;
}

/** A stored snapshot on Filecoin/IPFS */
export interface Snapshot {
  /** Content identifier */
  cid: CID;
  /** Size in bytes */
  size: number;
  /** When it was archived */
  archivedAt: number;
  /** Who created this snapshot */
  author: WalletAddress;
  /** Number of vault entries in this snapshot */
  entryCount: number;
  /** Whether the snapshot data is encrypted */
  encrypted: boolean;
  /** Filecoin deal status */
  filecoinStatus: "pending" | "active" | "expired";
}

/** Persistence Layer interface */
export interface IPersistenceLayer {
  /**
   * Archive the current vault state to Filecoin/IPFS.
   * The snapshot is always encrypted (using the vault's encryption).
   */
  archive(opts?: {
    /** Optional label for this snapshot */
    label?: string;
    /** Whether to also pin to Filecoin (default: true) */
    pinToFilecoin?: boolean;
  }): Promise<Snapshot>;

  /**
   * Retrieve a snapshot by CID.
   */
  retrieve(cid: CID): Promise<Uint8Array>;

  /**
   * Restore the vault from a snapshot.
   * Merges with existing data using CRDT resolution.
   */
  restore(cid: CID): Promise<{ merged: number; conflicts: number }>;

  /**
   * List all snapshots for the current wallet.
   */
  listSnapshots(opts?: { limit?: number; offset?: number }): Promise<Snapshot[]>;

  /**
   * Delete a snapshot (removes IPFS pin, Filecoin deal remains).
   */
  deleteSnapshot(cid: CID): Promise<void>;

  /**
   * Get Filecoin deal status for a snapshot.
   */
  getDealStatus(cid: CID): Promise<{
    status: "pending" | "active" | "expired";
    dealId?: string;
    provider?: string;
    expiresAt?: number;
  }>;
}

// ────────────────────────────────────────────────────────────
//  7. DISCOVERY LAYER — ERC-8004 for Data
// ────────────────────────────────────────────────────────────

/** Individual feedback entry */
export interface FeedbackEntry {
  /** Feedback giver address */
  clientAddress: WalletAddress;
  /** Feedback value (fixed-point) */
  value: number;
  /** Decimal precision */
  valueDecimals: number;
  /** Primary tag (e.g., "starred", "successRate", "responseTime") */
  tag1?: string;
  /** Secondary tag */
  tag2?: string;
  /** Service endpoint the feedback is about */
  endpoint?: string;
  /** URI to off-chain feedback details */
  feedbackURI?: string;
  /** Keccak256 hash of feedbackURI content */
  feedbackHash?: string;
  /** Whether this feedback has been revoked */
  isRevoked: boolean;
}

/** Validation request */
export interface ValidationRequest {
  /** Agent that performed the task */
  agentId: number;
  /** Task identifier */
  taskId: string;
  /** Validation method requested */
  method: "stake-reexecution" | "zkml" | "tee" | "trusted-judge";
  /** Validation status */
  status: "pending" | "validated" | "rejected" | "expired";
  /** Validator address */
  validator?: EvmAddress;
  /** Validation result data (method-specific) */
  resultData?: Uint8Array;
}

/** Discovery Layer configuration */
export interface DiscoveryConfig {
  /** Data Identity Registry contract address */
  dataRegistry: EvmAddress;
  /** Shared Reputation Registry contract address */
  reputationRegistry: EvmAddress;
  /** Validation Registry contract address (optional) */
  validationRegistry?: EvmAddress;
  /** Chain where registries are deployed */
  registryChain: EvmChain;
  /** Minimum data quality score for agent consumption (0-100, optional) */
  minDataScore?: number;
  /** viem public client for on-chain reads (enables on-chain mode when provided) */
  publicClient?: import("viem").PublicClient;
  /** viem wallet client for on-chain writes (register, rate, revoke) */
  walletClient?: import("viem").WalletClient;
}

// ── Data Registry Types (ERC-8004 applied to data sources) ──

/**
 * ERC-8004 Data Registration — a user's vault entry registered as
 * an on-chain discoverable asset with quality metadata.
 *
 * This is the key innovation: treating data as a first-class entity
 * in ERC-8004, not just agents. Agents can discover, evaluate, and
 * choose which data sources to consume based on verifiable scores.
 */
export interface DataRegistration {
  /** ERC-721 token ID in the Data Registry */
  dataId: number;
  /** Registry reference: "{namespace}:{chainId}:{registryAddress}" */
  dataRegistry: string;
  /** Owner's vault address (OrbitDB) */
  vaultAddress: OrbitAddress;
  /** Vault key this registration refers to */
  vaultKey: string;
  /** Human-readable name */
  name: string;
  /** Description of the data (what it contains, intended use) */
  description: string;
  /** Visibility of the underlying data */
  visibility: Visibility;
  /** Data schema identifier (e.g., "orbitmem:dietary:v1") */
  schema?: string;
  /** Data category tags */
  tags: DataTag[];
  /** Whether the data is currently available */
  active: boolean;
  /** Owner wallet address */
  owner: WalletAddress;
  /** Owner chain family */
  ownerChain: ChainFamily;
  /** When the data was last updated (unix ms) */
  lastUpdated: number;
  /** When this registration was created */
  registeredAt: number;
}

/** Standard data quality/verification tags */
export type DataTag =
  | "verified" // Data has been independently verified
  | "kyc-backed" // Owner has completed KYC
  | "self-attested" // Owner claims accuracy (no independent check)
  | "machine-generated" // Data was produced by an automated process
  | "human-curated" // Data was manually entered/reviewed
  | "time-sensitive" // Data has a short validity window
  | "immutable" // Data does not change after creation
  | string; // Custom tags allowed

/** Data Registration File (resolves from dataURI, similar to agent registration) */
export interface DataRegistrationFile {
  type: "https://eips.ethereum.org/EIPS/eip-8004#data-registration-v1";
  name: string;
  description: string;
  /** Data schema/format */
  schema?: {
    /** Schema identifier (e.g., "orbitmem:dietary:v1") */
    id: string;
    /** Schema version */
    version: string;
    /** Link to schema definition */
    definitionUrl?: string;
  };
  /** Access information */
  access: {
    /** OrbitMem vault address */
    vaultAddress: string;
    /** Vault path (nested) */
    path: string;
    /** Visibility level */
    visibility: Visibility;
    /** Required encryption engine for decryption */
    encryptionEngine?: EncryptionEngine;
    /** Relay node endpoint */
    relayEndpoint: string;
  };
  /** Quality metadata */
  quality: {
    /** How often the data is updated */
    updateFrequency?: "realtime" | "hourly" | "daily" | "weekly" | "monthly" | "static";
    /** Data provenance / source */
    provenance?: string;
    /** Verification method */
    verificationMethod?: "kyc" | "tee-attestation" | "zkml" | "oracle" | "self-attested";
  };
  tags: DataTag[];
  active: boolean;
  registrations: Array<{
    dataId: number;
    dataRegistry: string;
  }>;
}

/**
 * Aggregated data quality score.
 *
 * Agents use this to decide whether to consume a data source.
 * Scores are derived from on-chain feedback submitted by agents
 * who have previously consumed this data.
 */
export interface DataScore {
  /** Data Registration ID */
  dataId: number;
  /** Vault address of the data owner */
  vaultAddress: OrbitAddress;
  /** Vault key */
  vaultKey: string;
  /** Overall quality score (0-100) */
  quality: number;
  /** Freshness — how recently the data was updated */
  freshness: {
    lastUpdated: number;
    /** Freshness score (0-100, decays over time) */
    score: number;
  };
  /** Accuracy — based on agent feedback after consumption */
  accuracy: {
    score: number;
    feedbackCount: number;
  };
  /** Completeness — whether data has all expected fields */
  completeness: {
    score: number;
    feedbackCount: number;
  };
  /** Whether the data has been independently verified */
  verified: boolean;
  /** Verification method used */
  verificationMethod?: string;
  /** Total number of times agents have consumed this data */
  consumptionCount: number;
  /** Total feedback entries */
  totalFeedback: number;
  /** Breakdown by tag */
  tagScores: Record<string, { value: number; count: number }>;
}

/** Feedback specifically about data quality (agent → data) */
export interface DataFeedbackEntry extends FeedbackEntry {
  /** The vault key the feedback is about */
  vaultKey: string;
  /** Specific quality dimension */
  qualityDimension?: "accuracy" | "completeness" | "freshness" | "schema-compliance" | "usefulness";
}

// ── Discovery Layer Interface (Bidirectional) ──

/** Discovery Layer interface — bidirectional trust protocol */
export interface IDiscoveryLayer {
  // ── Data Discovery (data as a scored asset) ──

  /**
   * Register a vault entry as an on-chain discoverable data asset.
   * Mints an ERC-721 token in the Data Registry.
   *
   * This allows agents to discover and evaluate the data before
   * requesting access. The registration includes quality metadata,
   * schema info, and access instructions.
   */
  registerData(opts: {
    /** Vault path to register (e.g. "travel/dietary") */
    key: string;
    /** Human-readable name */
    name: string;
    /** Description */
    description: string;
    /** Schema identifier */
    schema?: string;
    /** Quality/verification tags */
    tags: DataTag[];
    /** Data registration file URI (IPFS, HTTPS, or data: URI) */
    registrationURI?: string;
  }): Promise<DataRegistration>;

  /**
   * Update an existing data registration (e.g., after data changes).
   */
  updateDataRegistration(
    dataId: number,
    updates: Partial<Pick<DataRegistration, "name" | "description" | "tags" | "active">>,
  ): Promise<DataRegistration>;

  /**
   * Search for data assets by query.
   * Agents use this to discover available data sources.
   */
  findData(query: {
    /** Search by keyword in name/description */
    keyword?: string;
    /** Filter by schema */
    schema?: string;
    /** Filter by tags */
    tags?: DataTag[];
    /** Filter by visibility */
    visibility?: Visibility;
    /** Minimum quality score */
    minQuality?: number;
    /** Only verified data */
    verifiedOnly?: boolean;
    /** Only data updated within this many milliseconds */
    maxAge?: number;
    limit?: number;
  }): Promise<DataRegistration[]>;

  /**
   * Get the aggregated quality score for a data source.
   * Agents call this to evaluate data before consuming.
   */
  getDataScore(vaultAddress: OrbitAddress, path: string): Promise<DataScore>;

  /**
   * Get the quality score by data registration ID.
   */
  getDataScoreById(dataId: number): Promise<DataScore>;

  /**
   * Submit feedback about data quality (agent → data).
   * Called by agents after consuming data.
   */
  rateData(feedback: {
    /** Data Registration ID */
    dataId: number;
    /** Score value */
    value: number;
    valueDecimals?: number;
    /** Quality dimension being rated */
    qualityDimension?:
      | "accuracy"
      | "completeness"
      | "freshness"
      | "schema-compliance"
      | "usefulness";
    /** Primary tag */
    tag1?: string;
    /** Secondary tag */
    tag2?: string;
    feedbackURI?: string;
  }): Promise<{ txHash: string; feedbackIndex: number }>;

  // ── Validation ──

  /**
   * Request task validation via the Validation Registry.
   */
  requestValidation(request: {
    agentId: number;
    taskId: string;
    method: "stake-reexecution" | "zkml" | "tee" | "trusted-judge";
    taskData?: Uint8Array;
  }): Promise<ValidationRequest>;

  /**
   * Check validation status.
   */
  getValidationStatus(agentId: number, taskId: string): Promise<ValidationRequest | null>;

  // ── Lit Protocol Integration ──

  /**
   * Create a Lit access condition gated on data quality score.
   * Agents can require minimum data quality before processing.
   * (Used in agent-side logic, not encryption.)
   */
  createDataQualityCondition(opts: {
    minQuality: number;
    verifiedOnly?: boolean;
    maxAge?: number;
  }): LitEvmCondition;
}

// ────────────────────────────────────────────────────────────
//  8. ORBITMEM CLIENT — Top-Level SDK
// ────────────────────────────────────────────────────────────

/** Full OrbitMem SDK configuration */
export interface OrbitMemConfig {
  /** Network preset — "base-sepolia" (default) or "base" (mainnet).
   *  Sets contract addresses and relay URL. Overridden by explicit
   *  discovery/persistence config. */
  network?: import("./contracts.js").NetworkId;
  /** Identity layer config */
  identity: IdentityConfig;
  /** Vault (data layer) config */
  vault?: VaultConfig;
  /** Encryption layer config */
  encryption?: EncryptionConfig;
  /** Persistence layer config */
  persistence?: StorachaConfig;
  /** Discovery layer config (ERC-8004 bidirectional trust) */
  discovery?: DiscoveryConfig;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * The OrbitMem SDK client.
 *
 * Usage:
 * ```ts
 * import { createOrbitMem } from '@orbitmem/sdk';
 *
 * const orbitmem = await createOrbitMem({
 *   identity: {
 *     chains: ['passkey', 'evm', 'solana'],
 *     passkey: {
 *       rpId: 'app.orbitmem.xyz',
 *       rpName: 'OrbitMem',
 *       delegationChain: 'base',
 *     },
 *     evm: { chains: ['base', 'ethereum'], adapters: ['metamask'] },
 *     solana: { cluster: 'mainnet-beta', adapters: ['phantom'] },
 *   },
 *   encryption: { defaultEngine: 'lit' },
 *   persistence: { mock: true },
 * });
 *
 * // Connect via Passkey (biometric — zero extensions)
 * const conn = await orbitmem.connect({ method: 'passkey' });
 *
 * // Or connect via traditional wallet
 * // const conn = await orbitmem.connect({ method: 'evm' });
 *
 * // Store shared data — per-path visibility with nested-db
 * await orbitmem.vault.put('travel/dietary', 'vegan', {
 *   visibility: 'public',  // agents can read freely
 * });
 *
 * await orbitmem.vault.put('travel/budget', { min: 1000, max: 2000 }, {
 *   visibility: 'shared',
 *   engine: 'lit',
 *   accessConditions: [reputationCondition({ minScore: 70 })],
 * });
 *
 * await orbitmem.vault.put('travel/passport', { number: 'XX123' }, {
 *   visibility: 'private',  // owner-only, AES encrypted
 * });
 *
 * // Or bulk insert a nested object
 * await orbitmem.vault.insert({
 *   profile: { name: 'Alice', bio: 'Traveler' },
 * }, { visibility: 'public' });
 *
 * // Read subtree
 * await orbitmem.vault.get('travel');
 * // → { dietary: 'vegan', budget: { min: 1000, max: 2000 }, passport: { number: 'XX123' } }
 *
 * // Register for agent discovery (ERC-8004)
 * await orbitmem.discovery.registerData({
 *   key: 'travel/dietary',
 *   name: 'Dietary Preferences',
 *   description: 'Dietary restrictions for booking agents',
 *   tags: ['verified', 'human-curated'],
 * });
 * ```
 */
export interface IOrbitMem {
  /** Identity layer — wallet connection & session management */
  readonly identity: IIdentityLayer;

  /** Data layer — local-first P2P vault */
  readonly vault: IDataLayer;

  /** Encryption layer — Lit Protocol & AES-256-GCM */
  readonly encryption: IEncryptionLayer;

  /** Transport layer — ERC-8128 signed HTTP */
  readonly transport: ITransportLayer;

  /** Persistence layer — Storacha / Filecoin archival */
  readonly persistence: IPersistenceLayer;

  /** Discovery layer — ERC-8004 agent trust & reputation */
  readonly discovery: IDiscoveryLayer;

  // ── Convenience methods (delegate to sub-layers) ──

  /**
   * Connect a wallet or passkey (shortcut for identity.connect).
   */
  connect(opts: {
    method: ChainFamily;
    adapter?: EvmWalletAdapter | SolanaWalletAdapter;
  }): Promise<WalletConnection>;

  /**
   * Disconnect and clean up all layers.
   */
  disconnect(): Promise<void>;

  /**
   * Encrypt data with the configured default engine.
   */
  encrypt(
    data: Uint8Array | string,
    opts: EncryptLitOptions | EncryptAESOptions,
  ): Promise<EncryptedData>;

  /**
   * Decrypt data (auto-detects engine).
   */
  decrypt(encrypted: EncryptedData, opts?: DecryptOptions): Promise<Uint8Array>;

  /**
   * Destroy the client and release all resources.
   */
  destroy(): Promise<void>;
}

/** Factory function signature */
export declare function createOrbitMem(config: OrbitMemConfig): Promise<IOrbitMem>;

// ────────────────────────────────────────────────────────────
//  9. AGENT-SIDE TYPES — For OpenClaw / Framework Integration
// ────────────────────────────────────────────────────────────

/**
 * Agent-side adapter for reading OrbitMem-encrypted data.
 * This is what an OpenClaw agent (or any framework) would use
 * to fetch and decrypt user data from the Relay Node.
 */
export interface IOrbitMemAgentAdapter {
  // ── Data Discovery & Evaluation ──

  /**
   * Discover registered data sources by query.
   * Agents use this to find available data from users.
   */
  discoverData(query: {
    keyword?: string;
    schema?: string;
    tags?: DataTag[];
    minQuality?: number;
    verifiedOnly?: boolean;
    maxAge?: number;
    limit?: number;
  }): Promise<DataRegistration[]>;

  /**
   * Get the quality score for a specific data source.
   * Agents should check this BEFORE consuming data.
   */
  getDataScore(vaultAddress: OrbitAddress, path: string): Promise<DataScore>;

  /**
   * Submit feedback about consumed data quality (agent → data).
   * Called after the agent has used the data for a task.
   */
  rateData(feedback: {
    dataId: number;
    value: number;
    valueDecimals?: number;
    qualityDimension?:
      | "accuracy"
      | "completeness"
      | "freshness"
      | "schema-compliance"
      | "usefulness";
    tag1?: string;
    tag2?: string;
    feedbackURI?: string;
  }): Promise<{ txHash: string; feedbackIndex: number }>;

  // ── Public Data Access ──

  /**
   * Read public (unencrypted) data from a user's vault.
   * No decryption or access conditions needed — public data is plaintext.
   * Uses ERC-8128 signed request for transport authentication only.
   */
  readPublicData<T = unknown>(request: {
    /** The user's vault address (OrbitDB) */
    vaultAddress: OrbitAddress;
    /** The nested path to read */
    path: string;
    /** Relay node URL */
    relayUrl: string;
  }): Promise<T | null>;

  /**
   * List all public keys in a user's vault.
   * Useful for agent discovery — see what data a user has made available.
   */
  listPublicKeys(request: {
    vaultAddress: OrbitAddress;
    relayUrl: string;
    prefix?: string;
  }): Promise<string[]>;

  // ── Encrypted Data Access ──

  /**
   * Fetch encrypted (private/shared) data from a OrbitMem Relay Node.
   * Uses ERC-8128 signed request for authentication.
   */
  fetchUserData(request: {
    /** The user's vault address (OrbitDB) */
    vaultAddress: OrbitAddress;
    /** The nested path to read */
    path: string;
    /** Relay node URL */
    relayUrl: string;
  }): Promise<EncryptedData>;

  /**
   * Decrypt fetched data.
   * For Lit: The agent must meet the access conditions.
   * For AES: The agent must have the shared key.
   */
  decrypt(
    encrypted: EncryptedData,
    opts?: {
      /** For AES: shared key provided by the user out-of-band */
      sharedKey?: Uint8Array;
    },
  ): Promise<Uint8Array>;

  /**
   * Full lifecycle: discover → evaluate → fetch → decrypt → execute → rate.
   *
   * 1. Checks data score (rejects if below minQuality threshold)
   * 2. Fetches encrypted data
   * 3. Decrypts and passes plaintext to callback
   * 4. Zeroes plaintext buffer after callback
   * 5. Optionally submits quality feedback
   */
  withUserData<R>(
    request: {
      vaultAddress: OrbitAddress;
      path: string;
      relayUrl: string;
      /** Reject data below this quality score (default: from config) */
      minQuality?: number;
    },
    callback: (plaintext: Uint8Array, dataScore: DataScore) => Promise<R>,
    opts?: {
      sharedKey?: Uint8Array;
      /** Auto-submit quality feedback after execution */
      autoRate?: {
        value: number;
        qualityDimension?:
          | "accuracy"
          | "completeness"
          | "freshness"
          | "schema-compliance"
          | "usefulness";
      };
    },
  ): Promise<R>;
}

/** Agent adapter configuration */
export interface AgentAdapterConfig {
  /** The agent's wallet connection (for signing requests & Lit auth) */
  wallet: {
    family: ChainFamily;
    address: WalletAddress;
    signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  };
  /** Lit Protocol config (if agent needs Lit decryption) */
  lit?: EncryptionConfig["lit"];
  /** Discovery config (for data evaluation) */
  discovery?: {
    /** Data Registry contract address */
    dataRegistry: EvmAddress;
    /** Reputation Registry contract address */
    reputationRegistry: EvmAddress;
    /** Registry chain */
    registryChain: EvmChain;
    /** Minimum data quality score to accept (default: 0 = accept all) */
    minDataQuality?: number;
  };
}

/** Factory for agent adapter */
export declare function createOrbitMemAgentAdapter(
  config: AgentAdapterConfig,
): IOrbitMemAgentAdapter;

// ────────────────────────────────────────────────────────────
//  10. EVENT TYPES — Observable Patterns
// ────────────────────────────────────────────────────────────

export type OrbitMemEvent =
  | { type: "connection:changed"; connection: WalletConnection | null }
  | { type: "session:created"; session: SessionKey }
  | { type: "session:expired"; sessionId: string }
  | { type: "vault:updated"; path: string; entry: VaultEntry }
  | { type: "vault:deleted"; path: string }
  | { type: "vault:synced"; status: SyncStatus }
  | { type: "snapshot:archived"; snapshot: Snapshot }
  | { type: "snapshot:restored"; cid: CID; merged: number }
  | { type: "discovery:dataRegistered"; data: DataRegistration }
  | { type: "discovery:dataRated"; dataId: number; txHash: string }
  | { type: "discovery:validationComplete"; agentId: number; taskId: string; status: string }
  | { type: "error"; layer: string; error: Error };

export interface IOrbitMemEventEmitter {
  on<E extends OrbitMemEvent["type"]>(
    event: E,
    handler: (payload: Extract<OrbitMemEvent, { type: E }>) => void,
  ): () => void;

  once<E extends OrbitMemEvent["type"]>(
    event: E,
    handler: (payload: Extract<OrbitMemEvent, { type: E }>) => void,
  ): () => void;
}
