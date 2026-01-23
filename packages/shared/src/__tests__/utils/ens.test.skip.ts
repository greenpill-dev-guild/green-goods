import { describe, expect, it, vi } from "vitest";
import { resolveEnsName, resolveEnsAddress } from "../../utils";

vi.mock("../../config/pimlico", () => ({
  createPublicClientForChain: vi.fn(() => ({
    getEnsName: vi.fn(async () => "alice.eth"),
    getEnsAddress: vi.fn(async () => "0x1234567890123456789012345678901234567890"),
  })),
}));

describe("ens utils", () => {
  it("resolves ENS name", async () => {
    await expect(resolveEnsName("0x1234567890123456789012345678901234567890")).resolves.toBe(
      "alice.eth"
    );
  });

  it("resolves ENS address", async () => {
    await expect(resolveEnsAddress("alice.eth")).resolves.toBe(
      "0x1234567890123456789012345678901234567890"
    );
  });
});
