import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createDataRoutes } from "./routes/data.js";
import { healthRoutes } from "./routes/health.js";
import { createSnapshotRoutes } from "./routes/snapshots.js";
import { createVaultRoutes } from "./routes/vault.js";
import { createServices } from "./services/index.js";

const services = createServices(process.env.RELAY_MODE);

export const app = new Hono().basePath("/v1");

app.use(logger());
app.use(cors());

app.route("/", healthRoutes);
app.route("/", createVaultRoutes(services.vault));
app.route("/", createDataRoutes(services.discovery));
app.route("/", createSnapshotRoutes(services.snapshot));
