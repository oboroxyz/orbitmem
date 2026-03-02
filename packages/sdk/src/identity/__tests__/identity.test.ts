import { describe, expect, test } from "bun:test";
import { deriveSessionKey } from "../session.js";

describe("IdentityLayer", () => {
  test("creates session key from EVM signature", async () => {
    const session = await deriveSessionKey({
      family: "evm",
      signature: new Uint8Array(65).fill(1),
      parentAddress: "0x1234567890abcdef1234567890abcdef12345678",
      permissions: [{ type: "vault:read" }, { type: "vault:write" }],
      ttl: 3600,
    });
    expect(session.id).toBeTruthy();
    expect(session.family).toBe("evm");
    expect(session.permissions).toHaveLength(2);
    expect(session.isActive).toBe(true);
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });

  test("session key expires", async () => {
    const session = await deriveSessionKey({
      family: "evm",
      signature: new Uint8Array(65).fill(1),
      parentAddress: "0x1234567890abcdef1234567890abcdef12345678",
      permissions: [{ type: "vault:read" }],
      ttl: -1, // already expired
    });
    expect(session.isActive).toBe(false);
  });
});
