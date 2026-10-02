import { getEASConfig } from "@green-goods/shared/config/blockchain";
import { EASABI } from "@green-goods/shared/utils/blockchain/contracts";
import {
  custom,
  decodeFunctionData,
  encodeAbiParameters,
  encodeFunctionData,
  encodeFunctionResult,
  type Hex,
  keccak256,
  parseAbi,
  parseAbiParameters,
  toHex,
  zeroHash,
} from "viem";
import { arbitrum } from "viem/chains";
import { describe, expect, it } from "vitest";
import { createLiveReportingChain } from "../../services/reporting/live-chain";

/**
 * The viem adapter against a scripted JSON-RPC endpoint and a recorded EAS index response. It
 * proves call construction and result mapping, not live Arbitrum behavior.
 */
const EAS = getEASConfig(42161);
const GARDEN = "0x00000000000000000000000000000000000000a1";
const GARDENER = "0x00000000000000000000000000000000000000c1";
const ACCOUNT_ID = parseAbi(["function accountId() view returns (string)"]);
const META_FACTORY = parseAbi([
  "function deployWithFactory(address factory, bytes createData, bytes32 salt) payable returns (address)",
]);

type Handler = (method: string, params: unknown[]) => unknown;

function chainWith(handler: Handler, fetchStub?: typeof fetch) {
  return createLiveReportingChain({
    chain: arbitrum,
    rpcUrl: "https://rpc.test",
    transport: custom({
      async request({ method, params }) {
        return handler(method, (params ?? []) as unknown[]);
      },
    }),
    ...(fetchStub ? { fetch: fetchStub } : {}),
  });
}

function work(uid: Hex): Hex {
  return encodeFunctionResult({
    abi: EASABI,
    functionName: "getAttestation",
    result: {
      uid,
      schema: EAS.WORK.uid as Hex,
      time: 1n,
      expirationTime: 0n,
      revocationTime: 0n,
      refUID: zeroHash,
      recipient: GARDEN,
      attester: GARDENER,
      revocable: false,
      data: encodeAbiParameters(parseAbiParameters(EAS.WORK.schema), [
        7n,
        "Tree planting",
        "Planted by the fence",
        "bafy-metadata",
        ["bafy-photo"],
      ]),
    },
  } as never);
}

describe("live chain adapter", () => {
  it("classifies EOAs, Kernel accounts, counterfactual Kernel proofs and delegated EOAs", async () => {
    const codes: Record<string, Hex> = {
      "0x0000000000000000000000000000000000000001": "0x",
      "0x0000000000000000000000000000000000000002": "0x6080",
      "0x0000000000000000000000000000000000000003":
        "0xef0100aabbccddeeff00112233445566778899aabbcc",
    };
    const adapter = chainWith((method, params) => {
      if (method === "eth_getCode") return codes[String(params[0]).toLowerCase()] ?? "0x";
      if (method === "eth_call")
        return encodeFunctionResult({
          abi: ACCOUNT_ID,
          functionName: "accountId",
          result: "kernel.advanced.v0.3.1",
        });
      throw new Error(`unexpected ${method}`);
    });
    expect(await adapter.accountKind(42161, "0x0000000000000000000000000000000000000001")).toBe(
      "eoa"
    );
    expect(await adapter.accountKind(42161, "0x0000000000000000000000000000000000000002")).toBe(
      "kernel"
    );
    expect(await adapter.accountKind(42161, "0x0000000000000000000000000000000000000003")).toBe(
      "unsupported"
    );
    const kernelDeploy = encodeFunctionData({
      abi: META_FACTORY,
      functionName: "deployWithFactory",
      args: ["0xaac5D4240AF87249B3f71BC8E4A2cae074A3E419", "0x", zeroHash],
    });
    expect(
      await adapter.accountKind(
        42161,
        "0x0000000000000000000000000000000000000004",
        "0xd703aaE79538628d27099B8c4f621bE4CCd142d5",
        kernelDeploy
      )
    ).toBe("kernel");
    expect(
      await adapter.accountKind(
        42161,
        "0x0000000000000000000000000000000000000004",
        "0x0000000000000000000000000000000000000099"
      )
    ).toBe("unsupported");
  });

  it("maps a missing receipt to null", async () => {
    const hash = keccak256(toHex("tx"));
    const missing = chainWith(() => null);
    expect(await missing.transactionReceipt(42161, hash)).toBeNull();
  });

  it("rethrows receipt transport failures so retry can distinguish them from a missing receipt", async () => {
    const hash = keccak256(toHex("tx"));
    const down = chainWith(() => {
      throw new Error("rpc unavailable");
    });
    await expect(down.transactionReceipt(42161, hash)).rejects.toThrow();
  });

  it("lists pending work from the EAS index and decodes each work from chain data", async () => {
    const decidedWork = keccak256(toHex("decided"));
    const pendingWork = keccak256(toHex("pending"));
    const decision = encodeAbiParameters(parseAbiParameters(EAS.WORK_APPROVAL.schema), [
      7n,
      decidedWork,
      true,
      "ok",
      3,
      1,
      "",
    ]);
    const queries: unknown[] = [];
    const fetchStub = (async (_url: string, init: RequestInit) => {
      queries.push(JSON.parse(String(init.body)).variables);
      return new Response(
        JSON.stringify({
          data: {
            works: [{ id: decidedWork }, { id: pendingWork }],
            decisions: [{ data: decision }],
          },
        })
      );
    }) as unknown as typeof fetch;
    const adapter = chainWith((method, params) => {
      if (method !== "eth_call") throw new Error(`unexpected ${method}`);
      const call = params[0] as { data: Hex };
      const { args } = decodeFunctionData({ abi: EASABI, data: call.data });
      return work(args?.[0] as Hex);
    }, fetchStub);

    const pending = await adapter.pendingWork(42161, GARDEN);
    expect(pending).toEqual([
      {
        workUID: pendingWork,
        gardenAddress: GARDEN,
        gardenerAddress: GARDENER,
        actionUID: 7,
        title: "Tree planting",
        feedback: "Planted by the fence",
        mediaCids: ["bafy-photo"],
      },
    ]);
    // Index filters use checksummed addresses, as the EAS index stores them.
    expect(queries[0]).toMatchObject({ garden: "0x00000000000000000000000000000000000000A1" });
  });
});
