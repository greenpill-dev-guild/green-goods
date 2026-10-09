import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Hex } from "viem";
import { signGrantedKernelOperation } from "../../../modules/agent-reporting/kernel-executor";

const ports = vi.hoisted(() => ({
  sign: vi.fn(async () => "0xab"),
  prepare: vi.fn(),
  nonce: vi.fn(),
}));
vi.mock("@zerodev/sdk", () => ({
  createKernelAccount: async () => ({ signUserOperation: ports.sign }),
}));
vi.mock("permissionless", () => ({
  createSmartAccountClient: () => ({ prepareUserOperation: ports.prepare }),
}));
vi.mock("permissionless/clients/pimlico", () => ({ createPimlicoClient: () => ({}) }));
vi.mock("../../../modules/agent-reporting/kernel-permissions", () => ({
  grantPermissionValidator: async () => ({ getIdentifier: () => "0x12345678" }),
}));
vi.mock("../../../modules/agent-reporting/permission-management", () => ({
  createPermissionReader: () => ({
    assertKernel: async () => {},
    permission: async () => ({ active: true }),
  }),
}));

const account = "0x0000000000000000000000000000000000000011" as Hex;
const paymaster = "0x0000000000000000000000000000000000000022" as Hex;
const policy = {
  account,
  signerAddress: account,
  approvedPaymaster: paymaster,
  gasCap: 500_000,
  gasCostCapWei: "1000000000000000",
  chainId: 42161,
};
const input = () => ({
  client: { chain: { id: 42161 } } as never,
  bundlerUrl: "http://127.0.0.1:1",
  sponsorshipPolicyId: "fixture",
  signer: { address: account } as never,
  policy: policy as never,
  envelope: { call: { to: account, data: "0x1234" } } as never,
  reservedGasUnits: 100_000,
  onPrepared: ports.nonce,
});
beforeEach(() => {
  ports.sign.mockClear();
  ports.nonce.mockClear();
  ports.prepare.mockResolvedValue({
    sender: account,
    nonce: 0n,
    callData: "0x1234",
    signature: "0x",
    callGasLimit: 20_000n,
    verificationGasLimit: 20_000n,
    preVerificationGas: 20_000n,
    paymasterVerificationGasLimit: 20_000n,
    paymasterPostOpGasLimit: 20_000n,
    maxFeePerGas: 1n,
    maxPriorityFeePerGas: 0n,
    paymaster,
    paymasterData: "0x",
  });
});

describe("installed delegate attempt gas reservation", () => {
  it("allows the exact reserved gas across account and paymaster components", async () => {
    expect((await signGrantedKernelOperation(input())).userOperationHash).toMatch(
      /^0x[0-9a-f]{64}$/
    );
    expect(ports.sign).toHaveBeenCalledOnce();
    expect(ports.nonce).toHaveBeenCalledWith(0n);
  });
  it("refuses one extra paymaster gas unit even when the total grant and wei caps would admit it", async () => {
    const prepared = await ports.prepare();
    ports.prepare.mockResolvedValue({ ...prepared, paymasterPostOpGasLimit: 20_001n });
    await expect(signGrantedKernelOperation(input())).rejects.toThrow("attempt reservation");
    expect(ports.sign).not.toHaveBeenCalled();
    expect(ports.nonce).not.toHaveBeenCalled();
  });
  it.each([
    0,
    -1,
    Number.NaN,
    500_001,
  ])("rejects invalid or wider reservation %s before preparing", async (reservedGasUnits) => {
    ports.prepare.mockClear();
    await expect(signGrantedKernelOperation({ ...input(), reservedGasUnits })).rejects.toThrow(
      "Unsupported grant"
    );
    expect(ports.prepare).not.toHaveBeenCalled();
    expect(ports.sign).not.toHaveBeenCalled();
  });
});
