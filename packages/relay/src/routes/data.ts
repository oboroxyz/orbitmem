import { Hono } from 'hono';
import { MockRegistry } from '@orbitmem/sdk';
import { erc8128 } from '../middleware/erc8128.js';

// Shared mock registry instance for the relay
const registry = new MockRegistry();

export { registry };

export const dataRoutes = new Hono();

// Search data registrations
dataRoutes.get('/data/search', async (c) => {
  const schema = c.req.query('schema');
  const tags = c.req.query('tags')?.split(',') as any;
  const verifiedOnly = c.req.query('verifiedOnly') === 'true';
  const minQuality = c.req.query('minQuality') ? Number(c.req.query('minQuality')) : undefined;

  const results = registry.findData({
    schema: schema || undefined,
    tags: tags?.length ? tags : undefined,
    verifiedOnly: verifiedOnly || undefined,
    minQuality,
  });

  return c.json({ results, count: results.length });
});

// Get data quality score
dataRoutes.get('/data/:dataId/score', async (c) => {
  const dataId = Number(c.req.param('dataId'));
  const score = registry.getDataScore(dataId);
  return c.json(score);
});

// Submit quality feedback — requires ERC-8128
dataRoutes.post('/data/:dataId/feedback', erc8128(), async (c) => {
  const dataId = Number(c.req.param('dataId'));
  const body = await c.req.json<{
    value: number;
    qualityDimension?: string;
    tag1?: string;
    tag2?: string;
  }>();

  registry.rateData(dataId, {
    clientAddress: c.get('signer') as any,
    value: body.value,
    valueDecimals: 0,
    tag1: body.tag1,
    tag2: body.tag2,
    isRevoked: false,
    vaultKey: '',
    qualityDimension: body.qualityDimension as any,
  });

  return c.json({ status: 'ok', dataId, signer: c.get('signer') });
});

// Register data (for seeding / testing)
dataRoutes.post('/data/register', async (c) => {
  const body = await c.req.json<{
    key: string;
    name: string;
    description: string;
    schema?: string;
    tags: string[];
  }>();

  const reg = registry.registerData({
    key: body.key,
    name: body.name,
    description: body.description,
    schema: body.schema,
    tags: body.tags as any,
  });

  return c.json(reg);
});
