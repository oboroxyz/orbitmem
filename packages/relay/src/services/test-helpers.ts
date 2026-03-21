import type { MockVaultService } from "./mock-vault.js";

let testVaultService: MockVaultService | null = null;

export function setTestVaultService(service: MockVaultService): void {
  testVaultService = service;
}

export function getTestVaultService(): MockVaultService {
  if (!testVaultService) throw new Error("Test vault service not initialized");
  return testVaultService;
}
