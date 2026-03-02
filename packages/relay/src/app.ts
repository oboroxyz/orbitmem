import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { healthRoutes } from './routes/health.js';
import { vaultRoutes } from './routes/vault.js';
import { dataRoutes } from './routes/data.js';
import { snapshotRoutes } from './routes/snapshots.js';

export const app = new Hono().basePath('/v1');

app.use(logger());
app.use(cors());

app.route('/', healthRoutes);
app.route('/', vaultRoutes);
app.route('/', dataRoutes);
app.route('/', snapshotRoutes);
