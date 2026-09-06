import { afterEach, describe, expect, it, vi } from "vitest";
import { createPublicClient, custom, encodeAbiParameters, type Hex } from "viem";
import { entryPoint07Address, type P256Credential } from "viem/account-abstraction";
import { arbitrum, celo } from "viem/chains";

const { factoryCalls } = vi.hoisted(() => ({
  factoryCalls: [] as { chainId: number; data: Hex }[],
}));
const ACCOUNT = "0x1111111111111111111111111111111111111111" as const;

vi.mock("../../config/pimlico", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../config/pimlico")>();
  return {
    ...original,
    createPublicClientForChain: (chainId: number) =>
      createPublicClient({
        chain: chainId === 42220 ? celo : arbitrum,
        transport: custom({
          request: async ({ method }) => {
            if (method === "eth_getCode") return "0x";
            throw new Error(`Unexpected RPC method: ${method}`);
          },
        }),
      }).extend(() => ({
        call: async ({ data }: { data?: Hex }) => {
          if (!data) throw new Error("Factory call requires calldata");
          factoryCalls.push({ chainId, data });
          return { data: encodeAbiParameters([{ type: "address" }], [ACCOUNT]) };
        },
      })),
  };
});

import { defaultPasskeyAdapters } from "../../workflows/auth-passkey-adapters";

const credential: P256Credential = {
  id: "canary-test-credential",
  publicKey:
    "0x046b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5",
  // Rebuilding uses the public credential only; no browser ceremony runs in this test.
  raw: undefined as unknown as P256Credential["raw"],
};

afterEach(() => {
  vi.unstubAllEnvs();
  factoryCalls.length = 0;
});

describe("passkey cross-chain account construction", () => {
  it("uses identical Kernel account factory calldata and EntryPoint 0.7 on Arbitrum and Celo", async () => {
    vi.stubEnv("VITE_PIMLICO_API_KEY", "test-api-key");
    vi.stubEnv("VITE_PIMLICO_SPONSORSHIP_POLICY_ID", "arbitrum-policy");
    vi.stubEnv("VITE_PIMLICO_CELO_SPONSORSHIP_POLICY_ID", "celo-policy");
    const primary = await defaultPasskeyAdapters.buildSmartAccount(credential, 42161);
    const settlement = await defaultPasskeyAdapters.buildSmartAccount(credential, 42220);
    expect(factoryCalls).toHaveLength(2);
    expect(factoryCalls[0].chainId).toBe(42161);
    expect(factoryCalls[1].chainId).toBe(42220);
    expect(factoryCalls[0].data).toBe(factoryCalls[1].data);
    expect(settlement.address).toBe(primary.address);
    expect(settlement.client.account!.entryPoint).toMatchObject({
      address: entryPoint07Address,
      version: "0.7",
    });
    const factoryArgs = await settlement.client.account!.getFactoryArgs();
    expect(factoryArgs.factory?.toLowerCase()).toBe("0xd703aae79538628d27099b8c4f621be4ccd142d5");
    expect(factoryArgs.factoryData?.toLowerCase()).toContain(
      "aac5d4240af87249b3f71bc8e4a2cae074a3e419"
    );
    expect(factoryArgs.factoryData?.toLowerCase()).toContain(
      "ba45a2bfb8de3d24ca9d7f1b551e14dff5d690fd"
    );
    expect(factoryArgs).toEqual(await primary.client.account!.getFactoryArgs());
    expect(primary.client.paymasterContext).toEqual({ sponsorshipPolicyId: "arbitrum-policy" });
    expect(settlement.client.paymasterContext).toEqual({ sponsorshipPolicyId: "celo-policy" });
  });

  it("refuses Celo construction before factory RPC when only a primary policy exists", async () => {
    vi.stubEnv("VITE_PIMLICO_SPONSORSHIP_POLICY_ID", "arbitrum-policy");
    vi.stubEnv("VITE_PIMLICO_CELO_SPONSORSHIP_POLICY_ID", undefined);
    await expect(defaultPasskeyAdapters.buildSmartAccount(credential, 42220)).rejects.toMatchObject(
      { code: "policy_unavailable" }
    );
    expect(factoryCalls).toEqual([]);
  });
});
