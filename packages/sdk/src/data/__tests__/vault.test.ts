import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createVault, createOrbitDBInstance } from '../index.js';

describe('DataLayer — Vault', () => {
  let vault: Awaited<ReturnType<typeof createVault>>;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const { orbitdb, cleanup: c } = await createOrbitDBInstance({ directory: './.test-orbitdb' });
    cleanup = c;
    vault = await createVault(orbitdb, {});
  });

  afterAll(async () => {
    await vault.close();
    await cleanup();
  });

  test('put and get a public value', async () => {
    const entry = await vault.put('test/greeting', 'hello', { visibility: 'public' });
    expect(entry.value).toBe('hello');
    expect(entry.visibility).toBe('public');
    expect(entry.encrypted).toBe(false);

    const retrieved = await vault.get('test/greeting');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.value).toBe('hello');
  });

  test('put and get nested path', async () => {
    await vault.put('travel/dietary', 'vegan', { visibility: 'public' });
    await vault.put('travel/budget', 3000, { visibility: 'public' });

    const travel = await vault.get('travel');
    expect(travel).not.toBeNull();
    expect(travel!.value).toMatchObject({ dietary: 'vegan', budget: 3000 });
  });

  test('insert merges nested object', async () => {
    await vault.insert({
      profile: { name: 'Alice', interests: ['travel'] },
    }, { visibility: 'public' });

    const profile = await vault.get('profile');
    expect(profile).not.toBeNull();
    expect(profile!.value).toMatchObject({ name: 'Alice', interests: ['travel'] });
  });

  test('del removes a path', async () => {
    await vault.put('temp/data', 42, { visibility: 'public' });
    await vault.del('temp/data');
    const result = await vault.get('temp/data');
    expect(result).toBeNull();
  });

  test('keys returns all leaf paths', async () => {
    const allKeys = await vault.keys();
    expect(allKeys).toContain('test/greeting');
    expect(allKeys).toContain('travel/dietary');
  });

  test('all returns full nested object', async () => {
    const everything = await vault.all();
    expect(everything).toHaveProperty('test');
    expect(everything).toHaveProperty('travel');
  });
});
