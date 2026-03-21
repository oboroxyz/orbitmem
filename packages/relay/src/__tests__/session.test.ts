import { describe, expect, test } from "bun:test";

import { createSessionToken, verifySessionToken } from "../middleware/session.js";

describe("Session Tokens", () => {
  test("creates and verifies a valid token", async () => {
    const token = await createSessionToken("0xABC", 1800);
    expect(token).toBeTruthy();
    const result = await verifySessionToken(token);
    expect(result).not.toBeNull();
    expect(result!.address).toBe("0xABC");
  });

  test("rejects a tampered token", async () => {
    const token = await createSessionToken("0xABC", 1800);
    const tampered = token.slice(0, -4) + "0000";
    const result = await verifySessionToken(tampered);
    expect(result).toBeNull();
  });

  test("rejects an expired token", async () => {
    const token = await createSessionToken("0xABC", -1);
    const result = await verifySessionToken(token);
    expect(result).toBeNull();
  });

  test("returns expiresAt in token payload", async () => {
    const token = await createSessionToken("0xABC", 60);
    const result = await verifySessionToken(token);
    expect(result!.expiresAt).toBeGreaterThan(Date.now());
  });
});
