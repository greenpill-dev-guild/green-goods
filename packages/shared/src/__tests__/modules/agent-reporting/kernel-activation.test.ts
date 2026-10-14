import { createKernelAccount } from "@zerodev/sdk";
import { getEntryPoint, KERNEL_V3_1 } from "@zerodev/sdk/constants";
import { createPublicClient, custom, concatHex, padHex, type Hex } from "viem";
import { arbitrum } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import {
  buildEnvelope,
  resolveReportingDeployment,
} from "../../../modules/agent-reporting/envelope";
import { grantActivationSignatureRequestSchema } from "../../../modules/agent-reporting/api-contract";
import type { GrantPolicy } from "../../../modules/agent-reporting/grants";
import { signGrantedKernelActivation } from "../../../modules/agent-reporting/kernel-activation";

const stubs = vi.hoisted(() => ({ sign: vi.fn(async () => "0xff1234"), verified: vi.fn() }));
vi.mock("../../../modules/agent-reporting/kernel-permissions", async (original) => {
  const real =
    await original<typeof import("../../../modules/agent-reporting/kernel-permissions")>();
  return {
    ...real,
    verifiedGrantPermissionValidator: stubs.verified,
    grantPermissionValidator: async () => ({
      getIdentifier: () => "0x12345678",
      signUserOperation: stubs.sign,
    }),
  };
});

const account = "0x00000000000000000000000000000000000000a1";
const garden = "0x00000000000000000000000000000000000000c2";
const paymaster = "0x0000000000000000000000000000000000000a11";
const deployment = resolveReportingDeployment(42161);
const envelope = buildEnvelope(deployment, {
  kind: "work",
  operationId: "op",
  revision: 1,
  chainId: 42161,
  accountAddress: account,
  gardenAddress: garden,
  clientWorkId: "cw",
  actionDefinitionDigest: `0x${"12".repeat(32)}`,
  fields: {
    actionUID: "7",
    title: "Seedlings",
    feedback: "Planted four seedlings",
    metadata: "bafkmetadata",
    media: [],
  },
  media: [],
  metadataDigest: `0x${"34".repeat(32)}`,
});
const nonce =
  BigInt(concatHex(["0x0102", padHex("0x12345678", { size: 20, dir: "right" }), "0x0000"])) << 64n;
const offline = createPublicClient({
  chain: arbitrum,
  transport: custom({
    async request() {
      throw new Error("offline");
    },
  }),
});

async function fixture() {
  const now = Date.now();
  const policy: GrantPolicy = {
    version: 1,
    purpose: "reporting",
    chainId: 42161,
    account,
    gardenAddress: garden,
    easAddress: deployment.easAddress,
    schemaUID: deployment.work.schemaUID,
    signerAddress: account,
    moduleRef: "fixture",
    validAfter: now - 1000,
    validUntil: now + 86_399_000,
    maxSubmissions: 5,
    gasCap: 500_000,
    gasCostCapWei: "1000000000000000",
    approvedPaymaster: paymaster,
    singleCallPolicy: "0x0000000000000000000000000000000000000a12",
  };
  // Use the actual SDK encoder as the independent compatibility vector.
  const kernel = await createKernelAccount(offline, {
    address: account,
    entryPoint: getEntryPoint("0.7"),
    kernelVersion: KERNEL_V3_1,
    plugins: {
      regular: {
        address: account,
        validatorType: "PERMISSION",
        supportedKernelVersions: ">=0.3.1",
        getEnableData: async () => "0x",
        getIdentifier: () => "0x12345678",
        isEnabled: async () => true,
      } as never,
    },
  });
  const operation = {
    sender: account,
    nonce,
    callData: await kernel.encodeCalls([
      { to: envelope.call.to, data: envelope.call.data, value: 0n },
    ]),
    callGasLimit: 100_000n,
    verificationGasLimit: 100_000n,
    preVerificationGas: 50_000n,
    maxFeePerGas: 1_000_000n,
    maxPriorityFeePerGas: 0n,
    paymaster,
    paymasterVerificationGasLimit: 50_000n,
    paymasterPostOpGasLimit: 10_000n,
    paymasterData: "0x1234" as Hex,
  };
  const client = {
    ...offline,
    readContract: vi.fn(async ({ functionName }) =>
      functionName === "getNonce"
        ? nonce
        : { hook: "0x0000000000000000000000000000000000000000", nonce: 0 }
    ),
  };
  return {
    client: client as typeof offline,
    policy,
    operation,
    envelope,
    signer: { address: account } as never,
  };
}

describe("first-report activation signing boundary", () => {
  it("signs the SDK's exact first report with an ENABLE nonce and counts every gas component", async () => {
    const input = await fixture();
    stubs.sign.mockClear();
    const result = await signGrantedKernelActivation(input);
    expect(result.userOperationHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.delegateSignature).toBe("0xff1234");
    expect(stubs.sign).toHaveBeenCalledOnce();
  });
  it.each([
    "call",
    "sender",
    "nonce",
    "factory",
    "authorization",
    "paymaster",
    "gas",
    "fee",
    "expiry",
    "garden",
  ])("refuses altered %s before asking the delegated signer", async (kind) => {
    const input = await fixture();
    stubs.sign.mockClear();
    if (kind === "call") input.operation.callData = "0x1234";
    if (kind === "sender") input.operation.sender = garden;
    if (kind === "nonce") input.operation.nonce = 0n;
    if (kind === "factory") Object.assign(input.operation, { factory: garden, factoryData: "0x" });
    if (kind === "authorization")
      Object.assign(input.operation, { authorization: { address: garden } });
    if (kind === "paymaster") input.operation.paymaster = garden;
    if (kind === "gas") input.operation.paymasterPostOpGasLimit = 500_000n;
    if (kind === "fee") input.operation.maxPriorityFeePerGas = input.operation.maxFeePerGas + 1n;
    if (kind === "expiry") input.policy.validUntil = Date.now() - 1;
    if (kind === "garden") input.policy.gardenAddress = account;
    await expect(signGrantedKernelActivation(input)).rejects.toThrow("unsupported_scope");
    expect(stubs.sign).not.toHaveBeenCalled();
  });
  it("refuses an installed permission or changed EntryPoint sequence", async () => {
    const input = await fixture();
    stubs.sign.mockClear();
    input.client.readContract = vi.fn(async () => nonce + 1n) as never;
    await expect(signGrantedKernelActivation(input)).rejects.toThrow("conflict");
    expect(stubs.sign).not.toHaveBeenCalled();
  });
  it("rejects owner enable signatures and factory data at the wire boundary", () => {
    const op = {
      sender: account,
      nonce: "0x1",
      callData: "0x",
      callGasLimit: "0x1",
      verificationGasLimit: "0x1",
      preVerificationGas: "0x1",
      maxFeePerGas: "0x1",
      maxPriorityFeePerGas: "0x0",
      paymaster,
      paymasterVerificationGasLimit: "0x1",
      paymasterPostOpGasLimit: "0x0",
      paymasterData: "0x",
    };
    const request = {
      attemptId: "a",
      permitVersion: 1,
      payloadDigest: envelope.payloadDigest,
      userOperation: op,
    };
    expect(grantActivationSignatureRequestSchema.safeParse(request).success).toBe(true);
    expect(
      grantActivationSignatureRequestSchema.safeParse({
        ...request,
        userOperation: { ...op, signature: "0x1234" },
      }).success
    ).toBe(false);
    expect(
      grantActivationSignatureRequestSchema.safeParse({
        ...request,
        ownerEnableSignature: "0x1234",
      }).success
    ).toBe(false);
    expect(
      grantActivationSignatureRequestSchema.safeParse({
        ...request,
        userOperation: { ...op, factory: garden },
      }).success
    ).toBe(false);
  });
});
