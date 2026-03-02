import { createOrbitDBInstance } from "@orbitmem/sdk";

let peerInstance: Awaited<ReturnType<typeof createOrbitDBInstance>> | null = null;

export async function getOrbitDBPeer(opts?: { directory?: string; listenAddrs?: string[] }) {
  if (peerInstance) return peerInstance;

  peerInstance = await createOrbitDBInstance({
    directory: opts?.directory ?? "./relay-orbitdb",
    listenAddrs: opts?.listenAddrs ?? ["/ip4/0.0.0.0/tcp/0"],
  });

  return peerInstance;
}

export async function openVaultDB(vaultAddress: string) {
  const peer = await getOrbitDBPeer();
  // Open or replicate an existing vault by its OrbitDB address
  return peer.orbitdb.open(vaultAddress, { type: "nested" });
}

export async function stopOrbitDBPeer() {
  if (peerInstance) {
    await peerInstance.cleanup();
    peerInstance = null;
  }
}
