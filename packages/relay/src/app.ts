import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { healthRoutes } from './routes/health.js';

export const app = new Hono().basePath('/v1');

app.use(logger());
app.use(cors());

app.route('/', healthRoutes);
