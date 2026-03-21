import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { type MPPConfig } from "./middleware/mpp.js";
import { createDataRoutes } from "./routes/data.js";
import { healthRoutes } from "./routes/health.js";
import { createSnapshotRoutes } from "./routes/snapshots.js";
import { createVaultRoutes } from "./routes/vault.js";
import { createMockServices } from "./services/index.js";
import type { RelayServices } from "./services/types.js";

export function buildApp(services: RelayServices, mppConfig?: MPPConfig): Hono {
  const app = new Hono().basePath("/v1");
  app.use(logger());
  app.use(cors());
  app.route("/", healthRoutes);
  app.route("/", createVaultRoutes(services.vault, mppConfig));
  app.route("/", createDataRoutes(services.discovery));
  app.route("/", createSnapshotRoutes(services.snapshot, services.plan));
  return app;
}

const defaultMppConfig: MPPConfig | undefined = process.env.MPP_ACCEPTED_METHODS
  ? {
      acceptedMethods: process.env.MPP_ACCEPTED_METHODS.split(",") as MPPConfig["acceptedMethods"],
      network: (process.env.MPP_NETWORK ?? "base-sepolia") as MPPConfig["network"],
    }
  : undefined;

const app = buildApp(createMockServices(), defaultMppConfig);

export { app };
