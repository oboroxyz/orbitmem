import { describe, test, expect, beforeAll } from 'bun:test';
import { app } from '../app.js';

function makeERC8128Headers(overrides?: Record<string, string>) {
  return {
    'X-OrbitMem-Signer': '0xTEST_SIGNER',
    'X-OrbitMem-Family': 'evm',
    'X-OrbitMem-Algorithm': 'ecdsa-secp256k1',
    'X-OrbitMem-Timestamp': String(Date.now()),
    'X-OrbitMem-Nonce': crypto.randomUUID(),
    'X-OrbitMem-Signature': 'ab'.repeat(32),
    'Content-Type': 'application/json',
    ...overrides,
  };
}

describe('Relay Vault Routes', () => {
  // Seed test data
  beforeAll(async () => {
    await app.request('/v1/vault/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: 'test-vault-001',
        entries: [
          { key: 'travel/dietary', value: 'vegan', visibility: 'public' },
          { key: 'travel/budget', value: { min: 1000, max: 2000 }, visibility: 'public' },
          { key: 'travel/passport', value: 'ENCRYPTED_BLOB', visibility: 'private' },
        ],
      }),
    });
  });

  test('GET /v1/vault/public/:address/:key returns public entry', async () => {
    const res = await app.request('/v1/vault/public/test-vault-001/travel/dietary');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.value).toBe('vegan');
    expect(body.visibility).toBe('public');
  });

  test('GET /v1/vault/public/:address/:key returns 404 for private', async () => {
    const res = await app.request('/v1/vault/public/test-vault-001/travel/passport');
    expect(res.status).toBe(404);
  });

  test('GET /v1/vault/public/:address/keys lists public keys', async () => {
    const res = await app.request('/v1/vault/public/test-vault-001/keys');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.keys).toContain('travel/dietary');
    expect(body.keys).toContain('travel/budget');
    expect(body.keys).not.toContain('travel/passport');
  });

  test('POST /v1/vault/read requires ERC-8128 headers', async () => {
    const res = await app.request('/v1/vault/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultAddress: 'test-vault-001', path: 'travel/passport' }),
    });
    expect(res.status).toBe(401);
  });

  test('POST /v1/vault/read returns data with valid headers', async () => {
    const res = await app.request('/v1/vault/read', {
      method: 'POST',
      headers: makeERC8128Headers(),
      body: JSON.stringify({ vaultAddress: 'test-vault-001', path: 'travel/passport' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.value).toBe('ENCRYPTED_BLOB');
    expect(body.signer).toBe('0xTEST_SIGNER');
  });

  test('POST /v1/auth/challenge returns nonce', async () => {
    const res = await app.request('/v1/auth/challenge', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.nonce).toBeTruthy();
    expect(body.message).toContain('OrbitMem Authentication');
  });
});
