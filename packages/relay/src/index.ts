import { buildApp } from "./app.js";
import {
  createLiveServices,
  createMockServices,
  getOrbitDBPeer,
  stopOrbitDBPeer,
} from "./services/index.js";

const port = Number(process.env.PORT ?? 3000);
const mode = process.env.RELAY_MODE ?? "mock";

console.log(`OrbitMem Relay starting on port ${port} (mode: ${mode})`);

let app: ReturnType<typeof buildApp>;

if (mode === "live") {
  const services = await createLiveServices();
  app = buildApp(services);
  getOrbitDBPeer().then(() => {
    console.log("OrbitDB peer started");
  });
} else {
  app = buildApp(createMockServices());
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down...");
  await stopOrbitDBPeer();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down...");
  await stopOrbitDBPeer();
  process.exit(0);
});

export default { port, fetch: app.fetch };
