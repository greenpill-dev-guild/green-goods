import type { SmartAccountClient } from "permissionless";
import type { Hex } from "viem";
import { getUserOperationHash, type UserOperation } from "viem/account-abstraction";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  sendBrowserGrantActivation,
  signatureFreeActivationOperation,
} from "../../../modules/agent-reporting/browser-grant-activation";
import type { GrantActivationOperation } from "../../../modules/agent-reporting/api-contract";
import type { GrantPolicy } from "../../../modules/agent-reporting/grants";
import { ACCOUNT, workEnvelope } from "../../hooks/agent-reporting/fake-agent";

const sdk = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../../modules/agent-reporting/kernel-permissions", () => ({
  createGrantedKernelActivationAccount: sdk.create,
}));
const entryPoint = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const paymaster = "0x0000000000000000000000000000000000000a11";
const ownerPacked = "0xdeadbeef" as Hex;
const prepared: UserOperation<"0.7"> = {
  sender: ACCOUNT,
  nonce: 0n,
  callData: "0x1234",
  callGasLimit: 100n,
  verificationGasLimit: 100n,
  preVerificationGas: 100n,
  maxFeePerGas: 10n,
  maxPriorityFeePerGas: 1n,
  paymaster,
  paymasterVerificationGasLimit: 100n,
  paymasterPostOpGasLimit: 0n,
  paymasterData: "0xab",
  signature: "0xaabb",
};
const policy: GrantPolicy = {
  version: 1,
  purpose: "reporting",
  chainId: 42161,
  account: ACCOUNT,
  gardenAddress: ACCOUNT,
  easAddress: ACCOUNT,
  schemaUID: `0x${"12".repeat(32)}`,
  signerAddress: ACCOUNT,
  moduleRef: "fixture",
  validAfter: 1,
  validUntil: 1_900_000_000_000,
  maxSubmissions: 5,
  gasCap: 1_000,
  gasCostCapWei: "100000",
  approvedPaymaster: paymaster,
};
function fixture(operation: UserOperation<"0.7"> = prepared) {
  const signDelegate = vi.fn(async (_operation: GrantActivationOperation) => "0xffbb" as Hex);
  const assertOwner = vi.fn();
  const onBeforeBroadcast = vi.fn();
  const sign = vi.fn(async (op: UserOperation<"0.7">) => {
    await sdk.create.mock.calls[0]![0].signDelegate(op);
    return ownerPacked;
  });
  const rootValidator = { getIdentifier: () => "0x1234" };
  sdk.create.mockResolvedValue({ entryPoint: { address: entryPoint }, signUserOperation: sign });
  const hash = getUserOperationHash({
    userOperation: operation,
    entryPointAddress: entryPoint,
    entryPointVersion: "0.7",
    chainId: 42161,
  });
  const prepare = vi.fn(async () => operation);
  const request = vi.fn(async () => hash);
  const ownerClient = {
    account: { kernelPluginManager: { sudoValidator: rootValidator } },
    prepareUserOperation: prepare,
    request,
  } as unknown as SmartAccountClient;
  const input = {
    ownerClient,
    policy,
    permissionId: "0x12345678" as Hex,
    envelope: workEnvelope(),
    assertOwner,
    signDelegate,
    onBeforeBroadcast,
  };
  return {
    input,
    signDelegate,
    assertOwner,
    onBeforeBroadcast,
    sign,
    rootValidator,
    hash,
    prepare,
    request,
  };
}
beforeEach(() => sdk.create.mockReset());

/** @direct-test-subject ../../../modules/agent-reporting/browser-grant-activation.ts */
describe("browser first publication activation", () => {
  it("sends only 12 explicit bare fields to the Agent and packs owner authority only for the bundler", async () => {
    const f = fixture();
    await expect(sendBrowserGrantActivation(f.input)).resolves.toBe(f.hash);
    expect(sdk.create.mock.calls[0]![0].ownerValidator).toBe(f.rootValidator);
    const wire = f.signDelegate.mock.calls[0]![0] as unknown as Record<string, unknown>;
    expect(Object.keys(wire)).toHaveLength(12);
    expect(wire).not.toHaveProperty("signature");
    expect(wire).not.toHaveProperty("factory");
    expect(JSON.stringify(wire)).not.toContain(ownerPacked);
    expect(f.request).toHaveBeenCalledWith(
      {
        method: "eth_sendUserOperation",
        params: [
          expect.objectContaining({ signature: ownerPacked, paymaster, nonce: "0x0" }),
          entryPoint,
        ],
      },
      { retryCount: 0 }
    );
    expect(f.onBeforeBroadcast.mock.invocationCallOrder[0]).toBeLessThan(
      f.request.mock.invocationCallOrder[0]!
    );
  });

  it("stops an owner decline during preparation before delegate authority or broadcast exists", async () => {
    const f = fixture();
    f.prepare.mockRejectedValue(Object.assign(new Error("Declined"), { code: 4001 }));
    await expect(sendBrowserGrantActivation(f.input)).rejects.toMatchObject({ code: 4001 });
    expect(f.signDelegate).not.toHaveBeenCalled();
    expect(f.request).not.toHaveBeenCalled();
  });

  it.each([
    "factory",
    "factoryData",
    "authorization",
  ] as const)("refuses a deployment authority field: %s", (field) => {
    expect(() =>
      signatureFreeActivationOperation({
        ...prepared,
        [field]: field === "factory" ? ACCOUNT : "0x1234",
      } as UserOperation<"0.7">)
    ).toThrow("already deployed");
  });

  it("refuses an unapproved sponsor or an exceeded gas budget before requesting a delegate signature", async () => {
    const f = fixture({ ...prepared, paymaster: ACCOUNT });
    await expect(sendBrowserGrantActivation(f.input)).rejects.toThrow("budget");
    expect(f.signDelegate).not.toHaveBeenCalled();
    expect(f.request).not.toHaveBeenCalled();
    const expensive = fixture({ ...prepared, maxFeePerGas: 1_000_000n });
    await expect(sendBrowserGrantActivation(expensive.input)).rejects.toThrow("budget");
    expect(expensive.signDelegate).not.toHaveBeenCalled();
  });

  it("rechecks owner identity after signing and stops a changed session before broadcast", async () => {
    const f = fixture();
    let changed = false;
    f.sign.mockImplementation(async (op) => {
      await sdk.create.mock.calls[0]![0].signDelegate(op);
      changed = true;
      return ownerPacked;
    });
    f.assertOwner.mockImplementation(() => {
      if (changed) throw new Error("Session changed");
    });
    await expect(sendBrowserGrantActivation(f.input)).rejects.toThrow("Session changed");
    expect(f.signDelegate).toHaveBeenCalledTimes(1);
    expect(f.request).not.toHaveBeenCalled();
  });

  it("retains the expected public hash when a bundler returns a different reference", async () => {
    const f = fixture();
    f.request.mockResolvedValue(`0x${"00".repeat(32)}`);
    await expect(sendBrowserGrantActivation(f.input)).rejects.toThrow("reference mismatch");
    expect(f.onBeforeBroadcast).toHaveBeenCalledWith(f.hash);
  });
});
