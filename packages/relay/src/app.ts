import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { dataRoutes } from "./routes/data.js";
import { healthRoutes } from "./routes/health.js";
import { snapshotRoutes } from "./routes/snapshots.js";
import { vaultRoutes } from "./routes/vault.js";

export const app = new Hono().basePath("/v1");

app.use(logger());
app.use(cors());

app.route("/", healthRoutes);
app.route("/", vaultRoutes);
app.route("/", dataRoutes);
app.route("/", snapshotRoutes);
