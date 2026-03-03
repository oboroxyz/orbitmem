import { LiveVaultService } from "./live-vault.js";
import { MockDiscoveryService } from "./mock-discovery.js";
import { MockSnapshotService } from "./mock-snapshot.js";
import { MockVaultService } from "./mock-vault.js";
import type { RelayServices } from "./types.js";

export { getOrbitDBPeer, stopOrbitDBPeer } from "./orbitdb-peer.js";
export type { IDiscoveryService, ISnapshotService, IVaultService, RelayServices } from "./types.js";

export function createServices(mode?: string): RelayServices {
  if (mode === "live") {
    return {
      vault: new LiveVaultService(),
      snapshot: new MockSnapshotService(),
      discovery: new MockDiscoveryService(),
    };
  }
  return {
    vault: new MockVaultService(),
    snapshot: new MockSnapshotService(),
    discovery: new MockDiscoveryService(),
  };
}
