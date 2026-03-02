import type {
  IdentityConfig,
  IIdentityLayer,
  SessionKey,
  SignatureAlgorithm,
  WalletConnection,
} from "../types.js";
import { deriveSessionKey } from "./session.js";

export function createIdentityLayer(config: IdentityConfig): IIdentityLayer {
  let connection: WalletConnection | null = null;
  let activeSession: SessionKey | null = null;
  const sessions = new Map<string, SessionKey>();
  const listeners: Set<(conn: WalletConnection | null) => void> = new Set();

  // Store signer function set by external wallet adapters
  let signFn:
    | ((message: string) => Promise<{ signature: Uint8Array; algorithm: SignatureAlgorithm }>)
    | null = null;

  return {
    async connect(opts) {
      // In a real implementation, this would open the wallet adapter
      // For now, this is a hook point — external code sets the connection
      throw new Error(
        `connect(${opts.method}) requires a wallet adapter. ` +
          "Use setConnection() for testing or integrate a wallet provider.",
      );
    },

    async createPasskey() {
      throw new Error("Passkey creation requires browser WebAuthn API");
    },

    async disconnect() {
      connection = null;
      activeSession = null;
      signFn = null;
      for (const cb of listeners) cb(null);
    },

    async signChallenge(message) {
      if (!signFn) throw new Error("No signer available — connect a wallet first");
      return signFn(message);
    },

    async createSessionKey(permissions, opts) {
      if (!connection) throw new Error("No wallet connected");
      if (!signFn) throw new Error("No signer available");

      const challenge = `OrbitMem Authentication\nTimestamp: ${Date.now()}\nNonce: ${crypto.randomUUID()}`;
      const { signature } = await signFn(challenge);

      const session = await deriveSessionKey({
        family: connection.family,
        signature,
        parentAddress: connection.address,
        permissions,
        ttl: opts?.ttl ?? config.sessionTTL ?? 3600,
      });

      sessions.set(session.id, session);
      activeSession = session;
      return session;
    },

    async resumeSession(sessionId) {
      const session = sessions.get(sessionId);
      if (!session) return null;
      if (session.expiresAt <= Date.now()) {
        sessions.delete(sessionId);
        return null;
      }
      activeSession = session;
      return session;
    },

    async revokeSession(sessionId) {
      sessions.delete(sessionId);
      if (activeSession?.id === sessionId) activeSession = null;
    },

    getConnection() {
      return connection;
    },

    getActiveSession() {
      if (activeSession && activeSession.expiresAt <= Date.now()) {
        activeSession = null;
      }
      return activeSession;
    },

    onConnectionChange(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
}
