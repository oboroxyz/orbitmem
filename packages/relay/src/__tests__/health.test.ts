import { describe, expect, test } from "bun:test";
import { app } from "../app.js";

describe("Relay Health", () => {
  test("GET /v1/health returns ok", async () => {
    const res = await app.request("/v1/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
