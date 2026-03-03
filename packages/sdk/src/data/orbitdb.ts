import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify } from "@libp2p/identify";
import { tcp } from "@libp2p/tcp";
import { createOrbitDB, useDatabaseType } from "@orbitdb/core";
import { Nested } from "@orbitdb/nested-db";
import { LevelBlockstore } from "blockstore-level";
import { createHelia } from "helia";
import { createLibp2p } from "libp2p";

// Register the Nested database type (must happen before createOrbitDB)
useDatabaseType(Nested);

export async function createOrbitDBInstance(opts: {
  directory?: string;
  listenAddrs?: string[];
}): Promise<{ orbitdb: any; ipfs: any; libp2p: any; cleanup: () => Promise<void> }> {
  const blockstore = new LevelBlockstore(opts.directory ?? "./orbitdb/blocks");

  const libp2p = await createLibp2p({
    addresses: { listen: opts.listenAddrs ?? ["/ip4/0.0.0.0/tcp/0"] },
    transports: [tcp()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
      pubsub: gossipsub({ allowPublishToZeroTopicPeers: true }),
    },
  });

  const ipfs = await createHelia({ libp2p, blockstore });
  const orbitdb = await createOrbitDB({ ipfs });

  return {
    orbitdb,
    ipfs,
    libp2p,
    cleanup: async () => {
      await orbitdb.stop();
      await ipfs.stop();
    },
  };
}
