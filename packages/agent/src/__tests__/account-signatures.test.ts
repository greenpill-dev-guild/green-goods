import { describe, expect, it, vi } from "vitest";
import {
  encodeDeployData,
  erc6492SignatureValidatorAbi,
  erc6492SignatureValidatorByteCode,
  serializeErc6492Signature,
  type Hex,
} from "viem";
import { arbitrum } from "viem/chains";
import {
  createViemAccountSignatureVerifier,
  createViemAccountHashVerifier,
} from "../services/account-signatures";

// TEST-QUALITY: allow-small-test-file - Verifier mechanics are shared across features; avatar route behavior stays in profile-avatars.test.ts.
describe("account signature verification", () => {
  it("verifies the exact typed-data hash for smart accounts without personal-message hashing it", async () => {
    const client = { call: vi.fn(async (_input: { data: Hex }) => ({ data: "0x01" as const })) };
    const verify = createViemAccountHashVerifier({
      chain: arbitrum,
      rpcUrl: "https://unused.invalid",
      client,
    });
    const input = {
      chainId: arbitrum.id,
      address: "0x2222222222222222222222222222222222222222" as const,
      hash: `0x${"ab".repeat(32)}` as Hex,
      signature: serializeErc6492Signature({
        address: "0x1111111111111111111111111111111111111111",
        data: "0x1234",
        signature: "0x5678",
      }),
    };
    expect(await verify(input)).toBe(true);
    expect(client.call.mock.calls[0][0].data).toBe(
      encodeDeployData({
        abi: erc6492SignatureValidatorAbi,
        args: [input.address, input.hash, input.signature],
        bytecode: erc6492SignatureValidatorByteCode,
      })
    );
  });
  it("preserves provider outages as unavailable rather than invalid signatures", async () => {
    const client = {
      call: vi.fn(async () => {
        throw new Error("RPC unavailable");
      }),
    };
    const verify = createViemAccountHashVerifier({
      chain: arbitrum,
      rpcUrl: "https://unused.invalid",
      client,
    });
    await expect(
      verify({
        chainId: arbitrum.id,
        address: "0x2222222222222222222222222222222222222222",
        hash: `0x${"ab".repeat(32)}`,
        signature: "0x1234",
      })
    ).rejects.toThrow("RPC unavailable");
  });
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
