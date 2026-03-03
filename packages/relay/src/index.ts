import { app } from "./app.js";
import { getOrbitDBPeer, stopOrbitDBPeer } from "./services/index.js";

const port = Number(process.env.PORT ?? 3000);
const mode = process.env.RELAY_MODE ?? "mock";

console.log(`OrbitMem Relay starting on port ${port} (mode: ${mode})`);

// In live mode, start the OrbitDB peer
if (mode === "live") {
  getOrbitDBPeer().then(() => {
    console.log("OrbitDB peer started");
  });
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
