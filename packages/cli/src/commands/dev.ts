export async function dev(_args: string[], flags: Record<string, string>): Promise<void> {
  const port = flags.port ? Number(flags.port) : 3000;

  process.stdout.write(`Starting OrbitMem relay on http://localhost:${port}...\n`);

  const { buildApp } = await import("@orbitmem/relay/src/app.js");
  const { createMockServices } = await import("@orbitmem/relay/src/services/index.js");
  const services = createMockServices();
  const app = buildApp(services);

  const server = Bun.serve({
    port,
    fetch: app.fetch,
  });

  process.stdout.write(`Relay running at http://localhost:${server.port}\n`);
  process.stdout.write(`Press Ctrl+C to stop\n\n`);

  process.on("SIGINT", () => {
    process.stdout.write("\nShutting down...\n");
    server.stop();
    process.exit(0);
  });
}
