import { describe, test, expect } from 'bun:test';
import { createPersistenceLayer } from '../persistence-layer.js';

describe('PersistenceLayer (mock)', () => {
  // Use in-memory mock for testing
  const layer = createPersistenceLayer({
    spaceDID: 'did:key:test',
    mock: true,
  });

  test('archive creates a snapshot', async () => {
    const snapshot = await layer.archive({
      data: new TextEncoder().encode('{"test": true}'),
      entryCount: 1,
    });
    expect(snapshot.cid).toBeTruthy();
    expect(snapshot.size).toBeGreaterThan(0);
    expect(snapshot.encrypted).toBe(true);
  });

  test('listSnapshots returns archived snapshots', async () => {
    const list = await layer.listSnapshots();
    expect(list.length).toBeGreaterThan(0);
  });

  test('retrieve returns snapshot data', async () => {
    const snapshots = await layer.listSnapshots();
    const data = await layer.retrieve(snapshots[0].cid);
    expect(data).toBeInstanceOf(Uint8Array);
  });
});
