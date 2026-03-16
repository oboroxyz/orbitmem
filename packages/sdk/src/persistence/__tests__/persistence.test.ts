import { afterEach, describe, expect, mock, test } from "bun:test";

import { createPersistenceLayer } from "../persistence-layer.js";

// ── Mode detection ───────────────────────────────────────────

describe("createPersistenceLayer mode detection", () => {
  test("mock: true → creates mock persistence (archive returns bafy CID)", async () => {
    const layer = createPersistenceLayer({ mock: true });
    const snap = await layer.archive({});
    expect(snap.cid).toMatch(/^bafy/);
  });

  test("relayUrl → creates managed persistence (methods exist)", () => {
    const layer = createPersistenceLayer({ relayUrl: "http://localhost:3000" });
    expect(layer.archive).toBeFunction();
    expect(layer.retrieve).toBeFunction();
    expect(layer.listSnapshots).toBeFunction();
    expect(layer.deleteSnapshot).toBeFunction();
    expect(layer.getDealStatus).toBeFunction();
  });

  test("proof → creates direct persistence (methods exist)", () => {
    const layer = createPersistenceLayer({ proof: "ucan-proof-string" });
    expect(layer.archive).toBeFunction();
    expect(layer.retrieve).toBeFunction();
    expect(layer.listSnapshots).toBeFunction();
    expect(layer.deleteSnapshot).toBeFunction();
    expect(layer.getDealStatus).toBeFunction();
  });

  test("empty config {} → defaults to mock", async () => {
    const layer = createPersistenceLayer({});
    const snap = await layer.archive({});
    expect(snap.cid).toMatch(/^bafy/);
  });
});

// ── Mock persistence ─────────────────────────────────────────

describe("PersistenceLayer (mock)", () => {
  const layer = createPersistenceLayer({ mock: true });

  test("archive creates a snapshot", async () => {
    const snapshot = await (layer.archive as any)({
      data: new TextEncoder().encode('{"test": true}'),
      entryCount: 1,
    });
    expect(snapshot.cid).toBeTruthy();
    expect(snapshot.size).toBeGreaterThan(0);
    expect(snapshot.encrypted).toBe(true);
  });

  test("listSnapshots returns archived snapshots", async () => {
    const list = await layer.listSnapshots();
    expect(list.length).toBeGreaterThan(0);
  });

  test("retrieve returns snapshot data", async () => {
    const snapshots = await layer.listSnapshots();
    const data = await layer.retrieve(snapshots[0].cid);
    expect(data).toBeInstanceOf(Uint8Array);
  });

  test("restore returns merged count", async () => {
    const snapshots = await layer.listSnapshots();
    const result = await layer.restore(snapshots[0].cid);
    expect(result.merged).toBeDefined();
    expect(result.conflicts).toBe(0);
  });

  test("deleteSnapshot removes a snapshot", async () => {
    const snap = await (layer.archive as any)({
      data: new TextEncoder().encode("delete me"),
      entryCount: 1,
    });
    const beforeCount = (await layer.listSnapshots()).length;
    await layer.deleteSnapshot(snap.cid);
    const afterCount = (await layer.listSnapshots()).length;
    expect(afterCount).toBe(beforeCount - 1);
  });

  test("getDealStatus returns status for existing snapshot", async () => {
    const snap = await (layer.archive as any)({
      data: new TextEncoder().encode("status check"),
      entryCount: 1,
    });
    const deal = await layer.getDealStatus(snap.cid);
    expect(deal.status).toBe("pending");
  });
});

// ── Managed persistence ──────────────────────────────────────

describe("PersistenceLayer (managed)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("archive POSTs to relay and returns mapped snapshot", async () => {
    const mockResponse = {
      cid: "bafyrelay123",
      size: 42,
      archivedAt: Date.now(),
      author: "0xabc",
      entryCount: 5,
      encrypted: true,
      filecoinStatus: "pending",
    };

    globalThis.fetch = mock((url: string, init?: RequestInit) => {
      expect(url).toBe("http://localhost:3000/v1/snapshots/archive");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(init?.body as string);
      expect(body.data).toBeDefined();
      expect(body.entryCount).toBe(5);
      return Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));
    }) as unknown as typeof fetch;

    const layer = createPersistenceLayer({
      relayUrl: "http://localhost:3000",
      author: "0xabc" as `0x${string}`,
    });

    const snap = await (layer.archive as any)({
      data: new TextEncoder().encode("hello relay"),
      entryCount: 5,
    });

    expect(snap.cid).toBe("bafyrelay123");
    expect(snap.entryCount).toBe(5);
  });

  test("listSnapshots GETs from relay and returns mapped array", async () => {
    const mockSnapshots = [
      {
        cid: "bafy1",
        size: 10,
        archivedAt: Date.now(),
        author: "0xabc",
        entryCount: 2,
        encrypted: true,
        filecoinStatus: "pending",
      },
      {
        cid: "bafy2",
        size: 20,
        archivedAt: Date.now(),
        author: "0xabc",
        entryCount: 3,
        encrypted: true,
        filecoinStatus: "active",
      },
    ];

    globalThis.fetch = mock((url: string) => {
      expect(url).toBe("http://localhost:3000/v1/snapshots");
      return Promise.resolve(new Response(JSON.stringify(mockSnapshots), { status: 200 }));
    }) as unknown as typeof fetch;

    const layer = createPersistenceLayer({ relayUrl: "http://localhost:3000" });
    const list = await layer.listSnapshots();

    expect(list).toHaveLength(2);
    expect(list[0].cid).toBe("bafy1");
    expect(list[1].cid).toBe("bafy2");
  });

  test("retrieve fetches from IPFS gateway", async () => {
    const payload = new TextEncoder().encode("snapshot data");

    globalThis.fetch = mock((url: string) => {
      expect(url).toBe("https://w3s.link/ipfs/bafytest");
      return Promise.resolve(new Response(payload, { status: 200 }));
    }) as unknown as typeof fetch;

    const layer = createPersistenceLayer({ relayUrl: "http://localhost:3000" });
    const data = await layer.retrieve("bafytest");

    expect(data).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(data)).toBe("snapshot data");
  });

  test("retrieve uses custom gatewayUrl when provided", async () => {
    const payload = new TextEncoder().encode("custom gw");

    globalThis.fetch = mock((url: string) => {
      expect(url).toBe("https://custom.gw/ipfs/bafycustom");
      return Promise.resolve(new Response(payload, { status: 200 }));
    }) as unknown as typeof fetch;

    const layer = createPersistenceLayer({
      relayUrl: "http://localhost:3000",
      gatewayUrl: "https://custom.gw",
    });
    const data = await layer.retrieve("bafycustom");
    expect(new TextDecoder().decode(data)).toBe("custom gw");
  });

  test("archive throws on non-ok response", async () => {
    globalThis.fetch = mock(() => {
      return Promise.resolve(new Response("Internal Server Error", { status: 500 }));
    }) as unknown as typeof fetch;

    const layer = createPersistenceLayer({ relayUrl: "http://localhost:3000" });
    expect((layer.archive as any)({ data: new Uint8Array(0), entryCount: 0 })).rejects.toThrow(
      "500",
    );
  });

  test("deleteSnapshot sends DELETE to relay", async () => {
    globalThis.fetch = mock((url: string, init?: RequestInit) => {
      expect(url).toBe("http://localhost:3000/v1/snapshots/bafydel");
      expect(init?.method).toBe("DELETE");
      return Promise.resolve(new Response(null, { status: 204 }));
    }) as unknown as typeof fetch;

    const layer = createPersistenceLayer({ relayUrl: "http://localhost:3000" });
    await layer.deleteSnapshot("bafydel");
  });

  test("restore retrieves then returns merge info", async () => {
    const payload = new TextEncoder().encode("data");

    globalThis.fetch = mock(() => {
      return Promise.resolve(new Response(payload, { status: 200 }));
    }) as unknown as typeof fetch;

    const layer = createPersistenceLayer({ relayUrl: "http://localhost:3000" });
    const result = await layer.restore("bafyrestore");
    expect(result.merged).toBe(0);
    expect(result.conflicts).toBe(0);
  });

  test("getDealStatus returns pending", async () => {
    const layer = createPersistenceLayer({ relayUrl: "http://localhost:3000" });
    const deal = await layer.getDealStatus("bafydeal");
    expect(deal.status).toBe("pending");
  });
});
