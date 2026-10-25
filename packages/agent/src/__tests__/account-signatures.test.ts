import { describe, expect, it, vi } from "vitest";
import { serializeErc6492Signature } from "viem";
import { arbitrum } from "viem/chains";
import { createViemAccountSignatureVerifier } from "../services/account-signatures";

// TEST-QUALITY: allow-small-test-file - Verifier mechanics are shared across features; avatar route behavior stays in profile-avatars.test.ts.
describe("account signature verification", () => {
  it("passes an already wrapped ERC-6492 signature through when factory data is also supplied", async () => {
    const client = { call: vi.fn(async () => ({ data: "0x1" as const })) };
    const verify = createViemAccountSignatureVerifier({
      chain: arbitrum,
      rpcUrl: "http://unused.invalid",
      client,
    });
    const factory = "0x1111111111111111111111111111111111111111";
    const factoryData = "0xabcdef";
    const input = {
      chainId: arbitrum.id,
      address: "0x2222222222222222222222222222222222222222" as const,
      message: "signed account message",
      signature: serializeErc6492Signature({
        address: factory,
        data: factoryData,
        signature: "0x1234",
      }),
    };
    await expect(verify(input)).resolves.toBe(true);
    await expect(verify({ ...input, factory, factoryData })).resolves.toBe(true);
    expect(client.call.mock.calls[1]).toEqual(client.call.mock.calls[0]);
  });
  it("uses the production validator call for deployed and counterfactual smart accounts", async () => {
    const verificationClient = {
      call: vi.fn<(parameters: { data: `0x${string}` }) => Promise<{ data: `0x${string}` }>>(
        async () => ({ data: "0x1" })
      ),
    };
    const verify = createViemAccountSignatureVerifier({
      chain: arbitrum,
      rpcUrl: "http://unused.invalid",
      client: verificationClient,
    });
    const input = {
      chainId: arbitrum.id,
      address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
      message: "signed account message",
      signature: "0x1234" as const,
    };

    await expect(verify(input)).resolves.toBe(true);
    await expect(
      verify({
        ...input,
        factory: "0x1111111111111111111111111111111111111111",
        factoryData: "0xabcdef",
      })
    ).resolves.toBe(true);

    expect(verificationClient.call).toHaveBeenCalledTimes(2);
    const deployedCallData = verificationClient.call.mock.calls[0]?.[0].data;
    const counterfactualCallData = verificationClient.call.mock.calls[1]?.[0].data;
    expect(counterfactualCallData).not.toBe(deployedCallData);
    expect(counterfactualCallData).toContain("1111111111111111111111111111111111111111");
    expect(counterfactualCallData).toContain("abcdef");
  });
});
