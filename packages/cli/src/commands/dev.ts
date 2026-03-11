export async function dev(_args: string[], flags: Record<string, string>): Promise<void> {
  const port = flags.port ? Number(flags.port) : 3000;

  process.stdout.write(`Starting OrbitMem relay on http://localhost:${port}...\n`);

  const { buildApp } = await import("@orbitmem/relay/app");
  const { createMockServices } = await import("@orbitmem/relay/services");
  const { serve } = await import("@hono/node-server");
  const services = createMockServices();
  const app = buildApp(services);

  const server = serve({
    fetch: app.fetch,
    port,
  });

  process.stdout.write(`Relay running at http://localhost:${port}\n`);
  process.stdout.write(`Press Ctrl+C to stop\n\n`);

  process.on("SIGINT", () => {
    process.stdout.write("\nShutting down...\n");
    server.close();
    process.exit(0);
  });
}
