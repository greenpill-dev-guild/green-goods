import {
  createPublicClient,
  custom,
  decodeFunctionData,
  encodeFunctionResult,
  zeroAddress,
} from "viem";
import { arbitrum } from "viem/chains";
import { describe, expect, it } from "vitest";
import {
  createPermissionReader,
  invalidatePermissionCall,
  KERNEL_PERMISSION_ABI,
  permissionValidationId,
} from "../../../modules/agent-reporting/permission-management";

const ACCOUNT = "0x00000000000000000000000000000000000000a1";
const PERMISSION = "0x12345678";

function reader(
  input: { hook?: `0x${string}`; nonce?: number; validFrom?: number; root?: `0x${string}` } = {}
) {
  const client = createPublicClient({
    chain: arbitrum,
    transport: custom({
      async request({ method, params }) {
        if (method !== "eth_call") throw new Error("No Agent or other transport allowed");
        const call = (params as [{ data: `0x${string}` }])[0];
        const { functionName } = decodeFunctionData({
          abi: KERNEL_PERMISSION_ABI,
          data: call.data,
        });
        const result =
          functionName === "permissionConfig"
            ? { permissionFlag: "0x0000", signer: ACCOUNT, policyData: [] }
            : functionName === "validationConfig"
              ? {
                  nonce: input.nonce ?? 2,
                  hook: input.hook ?? "0x0000000000000000000000000000000000000001",
                }
              : functionName === "rootValidator"
                ? (input.root ?? `0x01${"00".repeat(20)}`)
                : functionName === "currentNonce"
                  ? 3
                  : (input.validFrom ?? 2);
        return encodeFunctionResult({ abi: KERNEL_PERMISSION_ABI, functionName, result } as never);
      },
    }),
  });
  return createPermissionReader(client as unknown as Parameters<typeof createPermissionReader>[0]);
}

describe("independent Kernel owner recovery", () => {
  it("decodes the actual pinned ABI tuple outputs into effective permission state", async () => {
    const permission = await reader().permission(ACCOUNT, PERMISSION);
    expect(permission).toMatchObject({ active: true, nonce: 2 });
    expect(permission.signerAddress.toLowerCase()).toBe(ACCOUNT);
    expect((await reader({ validFrom: 3 }).permission(ACCOUNT, PERMISSION)).active).toBe(false);
    expect((await reader({ hook: zeroAddress }).permission(ACCOUNT, PERMISSION)).active).toBe(
      false
    );
  });
  it("never offers the root permission for removal", async () => {
    await expect(
      reader({ root: permissionValidationId(PERMISSION) }).permission(ACCOUNT, PERMISSION)
    ).rejects.toThrow("unsupported_account");
  });
  it("derives only an owner-account zero-value invalidation and bounds the generation", () => {
    expect(invalidatePermissionCall(ACCOUNT, 3)).toMatchObject({
      address: ACCOUNT,
      account: ACCOUNT,
      value: 0n,
      functionName: "invalidateNonce",
      args: [4],
    });
    expect(() => invalidatePermissionCall(ACCOUNT, 0xffff_ffff)).toThrow();
    expect(() => permissionValidationId("0x1234")).toThrow("invalid_descriptor");
  });
  it("reconstructs recent permission identifiers from bounded direct-chain event chunks", async () => {
    const chunks: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
    const direct = createPermissionReader({
      getStorageAt: async () => undefined,
      getCode: async () => undefined,
      readContract: async () => 0,
      getBlockNumber: async () => 100_000n,
      getBlock: async ({ blockNumber }) => ({ timestamp: blockNumber * 4n }),
      getLogs: async (input) => {
        chunks.push({ fromBlock: input.fromBlock as bigint, toBlock: input.toBlock as bigint });
        return [{ args: { permission: PERMISSION } }];
      },
    });
    expect(await direct.discover(ACCOUNT)).toEqual([PERMISSION]);
    expect(chunks).toEqual([
      { fromBlock: 78_400n, toBlock: 88_399n },
      { fromBlock: 88_400n, toBlock: 98_399n },
      { fromBlock: 98_400n, toBlock: 100_000n },
    ]);
  });
});
