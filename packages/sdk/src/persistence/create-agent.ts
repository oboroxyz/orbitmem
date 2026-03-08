/**
 * One-time setup helper for BYOS (Bring Your Own Storacha) users.
 * Creates a Storacha agent, provisions a space, and returns the
 * serialized proof to store in config.
 */
export async function createStorachaAgent(name = "orbitmem"): Promise<{
  agentDID: string;
  proof: string;
  instructions: string;
}> {
  const { Client } = await import("@storacha/client");

  const client = await (Client as any).create();
  const space = await client.createSpace(name);
  await client.setCurrentSpace(space.did());

  const delegation = await client.createDelegation(client.agent, ["*"], {
    expiration: Infinity,
  });

  const chunks: Uint8Array[] = [];
  for await (const chunk of delegation.archive()) {
    chunks.push(chunk);
  }
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const car = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    car.set(chunk, offset);
    offset += chunk.length;
  }

  const proof = btoa(String.fromCharCode(...car));

  return {
    agentDID: client.agent.did(),
    proof,
    instructions: [
      "Storacha agent created successfully.",
      `Agent DID: ${client.agent.did()}`,
      `Space DID: ${space.did()}`,
      "",
      "Save the 'proof' string in your OrbitMem config:",
      "",
      "  createOrbitMem({ persistence: { proof: '<proof string>' } })",
      "",
      "Or set it as an environment variable:",
      "",
      "  ORBITMEM_STORACHA_PROOF=<proof string>",
      "",
      "Note: You must register this agent with Storacha before uploading.",
      "Run: npx @storacha/cli login <email>",
    ].join("\n"),
  };
}
