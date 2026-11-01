import { toKernelSmartAccount } from "permissionless/accounts";
import { createPublicClient, custom, toEventSelector } from "viem";
import { toAccount } from "viem/accounts";
import { entryPoint07Address } from "viem/account-abstraction";
import { encode7579Calls } from "permissionless/utils";
import { describe, expect, it, vi } from "vitest";
import { arbitrum } from "viem/chains";
import {
  createFakeSmartAccountClient,
  createMockBatchBudget,
  fakePreparedUserOperation,
  createFakeWagmiDeps,
  createMockContractCall,
} from "../../../__tests__/test-utils/transaction-fakes";
import { MOCK_TX_HASH } from "../../../__tests__/test-utils/mock-factories";
import { PasskeySender } from "../passkey-sender";
import { WalletSender } from "../wallet-sender";
import {
  BatchConfirmationPendingError,
  BatchNotSubmittedError,
  type BatchReference,
} from "../batch-types";
import { createTransactionSender } from "../factory";
import { type ContractCall, TransactionRevertedError } from "../types";
import type { PasskeyAccountProfileId } from "../../auth/account-profile";

const listing = vi.hoisted(() => ({ profile: null as string | null, action: "" }));
vi.mock("../batch-enablement", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isBatchEnabled: (query: { action: string; rail: string; profile: string; chainId: number }) =>
    query.rail === "passkey" &&
    query.chainId === 42161 &&
    query.action === listing.action &&
    query.profile === listing.profile,
}));

const walletBudget = createMockBatchBudget();
const passkeyBudget = createMockBatchBudget({ sponsorship: "required" });
const hash = `0x${"a".repeat(64)}` as const;
const secondHash = `0x${"b".repeat(64)}` as const;
function wallet() {
  const deps = {
    ...createFakeWagmiDeps(),
    preflightBatch: vi.fn(async () => ({
      gas: "300000",
      maxFeePerGas: "2000000",
      maxFee: "600000000000",
      sponsored: false,
      authority: "wallet" as const,
    })),
    getCapabilities: vi.fn(async () => ({ atomic: { status: "supported" } })),
    sendCalls: vi.fn(async () => ({ id: "wallet:proposal/not-hex" })),
    waitForCallsStatus: vi.fn(async () => ({
      chainId: 42161,
      atomic: true,
      status: "success",
      receipts: [
        { status: "success", transactionHash: hash },
        { status: "success", transactionHash: secondHash },
      ],
    })),
    getCallsStatus: vi.fn(async () => ({
      chainId: 42161,
      atomic: true,
      status: "success",
      receipts: [{ status: "success", transactionHash: hash }],
    })),
  };
  return {
    deps,
    sender: new WalletSender(deps.config, deps.writeContractAsync, undefined, deps),
    calls: [
      createMockContractCall(),
      createMockContractCall({ args: ["0x1111111111111111111111111111111111111111", 2000n] }),
    ],
  };
}
function passkey(deps: { accountProfile?: PasskeyAccountProfileId } = {}) {
  const client = createFakeSmartAccountClient({ chain: arbitrum });
  client.account!.encodeCalls = vi.fn(async (calls) =>
    encode7579Calls({
      mode: {
        type: calls.length > 1 ? "batchcall" : "call",
        revertOnError: false,
        selector: "0x",
        context: "0x",
      },
      callData: calls,
    })
  );
  const sender = new PasskeySender(client, {
    resolveSmartAccountClient: async () => client,
    assertWriteSafety: async () => undefined,
    ...deps,
  });
  return {
    client,
    sender,
    calls: [
      createMockContractCall(),
      createMockContractCall({ args: ["0x1111111111111111111111111111111111111111", 2000n] }),
    ],
  };
}

describe("explicit wallet batching", () => {
  it("takes a wallet reporting no atomic capability as one that cannot batch", async () => {
    const { sender, deps, calls } = wallet();
    deps.getCapabilities.mockResolvedValue({} as { atomic: { status: string } });

    const refusal = await sender
      .submitAtomicBatch(calls, { batchBudget: walletBudget })
      .catch((error) => error);

    expect(refusal).toBeInstanceOf(BatchNotSubmittedError);
    expect(refusal.message).toBe("batch-atomic-unavailable");
    expect(deps.sendCalls).not.toHaveBeenCalled();
  });
  it("says so when a wallet cannot tell whether it can batch, which is not a refusal", async () => {
    const { sender, deps, calls } = wallet();
    deps.getCapabilities.mockRejectedValue(new Error("wallet did not answer"));

    const failure = await sender
      .submitAtomicBatch(calls, { batchBudget: walletBudget })
      .catch((error) => error);

    expect(failure).toBeInstanceOf(BatchNotSubmittedError);
    expect(failure.message).toBe("batch-capability-unknown");
    expect(deps.sendCalls).not.toHaveBeenCalled();
  });
  it("persists the opaque ID before waiting and retains all execution receipts", async () => {
    const { sender, deps, calls } = wallet();
    const onBatchReference = vi.fn(async (reference: BatchReference) => {
      expect(reference).toMatchObject({
        kind: "wallet-calls",
        id: "wallet:proposal/not-hex",
        chainId: 42161,
      });
      expect(deps.waitForCallsStatus).not.toHaveBeenCalled();
    });
    const result = await sender.submitAtomicBatch(calls, {
      onBatchReference,
      batchBudget: walletBudget,
    });
    expect(onBatchReference).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      status: "confirmed",
      receipts: [{ transactionHash: hash }, { transactionHash: secondHash }],
    });
  });
  it("retains the accepted ID on receipt timeout and reconciles it without sendCalls", async () => {
    const { sender, deps, calls } = wallet();
    deps.waitForCallsStatus.mockRejectedValueOnce(new Error("timeout"));
    const result = await sender.submitAtomicBatch(calls, {
      batchBudget: walletBudget,
    });
    expect(result).toMatchObject({
      status: "unresolved",
      reference: { id: "wallet:proposal/not-hex" },
    });
    expect((await sender.reconcileBatch(result.reference!)).status).toBe("confirmed");
    expect(deps.sendCalls).toHaveBeenCalledOnce();
    expect(deps.getCallsStatus).toHaveBeenCalledWith(deps.config, {
      id: "wallet:proposal/not-hex",
    });
  });
  it.each([
    false,
    undefined,
  ])("refuses to confirm without explicit atomicity: %s", async (atomic) => {
    const { sender, deps, calls } = wallet();
    deps.waitForCallsStatus.mockResolvedValueOnce({
      chainId: 42161,
      atomic: atomic as boolean,
      status: "success",
      receipts: [{ status: "success", transactionHash: hash }],
    });
    expect(
      (
        await sender.submitAtomicBatch(calls, {
          batchBudget: walletBudget,
        })
      ).status
    ).toBe("unresolved");
  });
  it("keeps partial execution unresolved and refuses wrong-account recovery", async () => {
    const { sender, deps, calls } = wallet();
    deps.waitForCallsStatus.mockResolvedValueOnce({
      chainId: 42161,
      atomic: true,
      status: "failure",
      receipts: [
        { status: "success", transactionHash: hash },
        { status: "reverted", transactionHash: secondHash },
      ],
    });
    const result = await sender.submitAtomicBatch(calls, {
      batchBudget: walletBudget,
    });
    expect(result.status).toBe("unresolved");
    expect(result.receipts).toHaveLength(2);
    expect(
      (
        await sender.reconcileBatch({
          ...result.reference!,
          account: "0x2222222222222222222222222222222222222222",
        })
      ).status
    ).toBe("unresolved");
    expect(deps.getCallsStatus).not.toHaveBeenCalled();
  });
});

describe("passkey batches for callers that group their own writes", () => {
  const PROFILE = "kernel-0.3.1-legacy";
  const accepted = async (sender: PasskeySender, calls: ContractCall[], extra = {}) =>
    sender.sendAtomicBatch(calls, { batchBudget: passkeyBudget, ...extra });

  it("groups only an action listed for this account's profile on this chain", async () => {
    listing.action = "pool-setup";
    listing.profile = PROFILE;
    const listed = passkey({ accountProfile: PROFILE }).sender;
    await expect(listed.canSendAtomicBatch(42161, "pool-setup")).resolves.toBe(true);
    await expect(listed.canSendAtomicBatch(10, "pool-setup")).resolves.toBe(false);

    // Pool setup probes for this, so nobody's flow changes until a rail is listed.
    await expect(listed.canSendAtomicBatch(42161)).resolves.toBe(false);
    await expect(
      passkey({ accountProfile: "another-profile" as never }).sender.canSendAtomicBatch(
        42161,
        "pool-setup"
      )
    ).resolves.toBe(false);
    await expect(passkey().sender.canSendAtomicBatch(42161, "pool-setup")).resolves.toBe(false);
    listing.action = "";
    await expect(listed.canSendAtomicBatch(42161, "pool-setup")).resolves.toBe(false);
  });

  it("carries the profile a session signed in with, from the factory", async () => {
    listing.action = "pool-setup";
    listing.profile = PROFILE;
    const client = passkey().client;
    const sender = createTransactionSender({
      authMode: "passkey",
      smartAccountClient: client,
      resolveSmartAccountClient: async () => client,
      passkeyAccountProfile: PROFILE,
    });

    await expect(sender.canSendAtomicBatch?.(42161, "pool-setup")).resolves.toBe(true);
    listing.action = "";
  });

  it("won't group a listed action when the encoding isn't all-or-nothing", async () => {
    listing.action = "pool-setup";
    listing.profile = PROFILE;
    const { sender, client } = passkey({ accountProfile: PROFILE });
    client.account!.encodeCalls = vi.fn(async (calls) =>
      encode7579Calls({
        mode: { type: "batchcall", revertOnError: true, selector: "0x", context: "0x" },
        callData: calls,
      })
    );

    await expect(sender.canSendAtomicBatch(42161, "pool-setup")).resolves.toBe(false);
    listing.action = "";
  });

  it("sends one UserOperation, says when it's accepted, and returns its hash", async () => {
    const { sender, client, calls } = passkey();
    const onAccepted = vi.fn(async () => {});

    const result = await accepted(sender, calls, { onAccepted });

    expect(client.sendUserOperation).toHaveBeenCalledOnce();
    expect(client.sendUserOperation.mock.calls[0][0]).toMatchObject({
      calls: [{ to: calls[0].address }, { to: calls[1].address }],
    });
    expect(onAccepted).toHaveBeenCalledOnce();
    expect(result).toEqual({ hash: expect.any(String), sponsored: true });
  });

  it("refuses to send without ceilings, and says it never went out", async () => {
    const { sender, client, calls } = passkey();
    const onNeverSent = vi.fn();

    await expect(sender.sendAtomicBatch(calls, { onNeverSent })).rejects.toThrow(
      "batch-budget-required"
    );

    expect(onNeverSent).toHaveBeenCalledOnce();
    expect(client.sendUserOperation).not.toHaveBeenCalled();
  });

  it("gives back the same error a caller already reads when a signature is refused", async () => {
    const { sender, client, calls } = passkey();
    const onNeverSent = vi.fn();
    const refused = new Error("The operation either timed out or was not allowed.");
    client.sendUserOperation.mockRejectedValueOnce(refused);

    await expect(accepted(sender, calls, { onNeverSent })).rejects.toBe(refused);

    expect(onNeverSent).toHaveBeenCalledOnce();
  });

  it.each([
    ["reverted", TransactionRevertedError],
    ["unresolved", BatchConfirmationPendingError],
  ] as const)("doesn't report a hash for a batch that %s", async (status, expected) => {
    const { sender, calls } = passkey();
    const onNeverSent = vi.fn();
    vi.spyOn(sender, "submitAtomicBatch").mockResolvedValue({
      status,
      receipts: status === "reverted" ? [{ transactionHash: hash, status: "reverted" }] : [],
      sponsored: true,
    });

    await expect(accepted(sender, calls, { onNeverSent })).rejects.toBeInstanceOf(expected);

    expect(onNeverSent).not.toHaveBeenCalled();
  });
});

describe("explicit passkey batching", () => {
  it("sends all calls in one UserOperation while legacy batching stays sequential", async () => {
    const { sender, client, calls } = passkey();
    expect(
      (
        await sender.submitAtomicBatch(calls, {
          batchBudget: passkeyBudget,
        })
      ).status
    ).toBe("confirmed");
    expect(client.sendUserOperation).toHaveBeenCalledOnce();
    expect(client.sendUserOperation.mock.calls[0][0]).toMatchObject({
      calls: [{ to: calls[0].address }, { to: calls[1].address }],
    });
    expect(sender.supportsBatching).toBe(false);
    await sender.sendBatch(calls);
    expect(client.sendUserOperation).toHaveBeenCalledTimes(3);
  });
  it("rejects a try-mode encoding before signing", async () => {
    const { sender, client, calls } = passkey();
    client.account!.encodeCalls = async (calls) =>
      encode7579Calls({
        mode: { type: "batchcall", revertOnError: true, selector: "0x", context: "0x" },
        callData: calls,
      });
    await expect(
      sender.submitAtomicBatch(calls, {
        batchBudget: passkeyBudget,
      })
    ).rejects.toThrow("batch-atomic-unavailable");
    expect(client.sendUserOperation).not.toHaveBeenCalled();
  });
  it.each([
    ["the sender can no longer batch", passkeyBudget, "batch-atomic-unavailable"],
    ["the calls outgrow the ceilings", { ...passkeyBudget, maxCalls: 1 }, "batch-budget-exceeded"],
  ])("reports a batch as never sent when %s", async (_name, batchBudget, message) => {
    const { sender, client, calls } = passkey();
    vi.spyOn(sender, "getBatchCapability").mockResolvedValue({
      account: client.account!.address,
      chainId: client.chain!.id,
      atomic: "unsupported",
    });

    const refusal = await sender.submitAtomicBatch(calls, { batchBudget }).catch((error) => error);

    expect(refusal).toBeInstanceOf(BatchNotSubmittedError);
    expect(refusal.message).toBe(message);
    expect(client.sendUserOperation).not.toHaveBeenCalled();
  });
  it("says so when a passkey cannot tell whether it can batch, which is not a refusal", async () => {
    const { sender, client, calls } = passkey();
    vi.spyOn(sender, "getBatchCapability").mockResolvedValue({
      account: client.account!.address,
      chainId: client.chain!.id,
      atomic: "unknown",
    });

    const failure = await sender
      .submitAtomicBatch(calls, { batchBudget: passkeyBudget })
      .catch((error) => error);

    expect(failure).toBeInstanceOf(BatchNotSubmittedError);
    expect(failure.message).toBe("batch-capability-unknown");
    expect(client.sendUserOperation).not.toHaveBeenCalled();
  });
  it("does not report outer-transaction success when the UserOperation failed", async () => {
    const { sender, client, calls } = passkey();
    const receipt = await client.waitForUserOperationReceipt({ hash: MOCK_TX_HASH });
    client.waitForUserOperationReceipt.mockResolvedValue({ ...receipt, success: false });
    expect(
      (
        await sender.submitAtomicBatch(calls, {
          batchBudget: passkeyBudget,
        })
      ).status
    ).toBe("reverted");
  });
  it("blocks a session change while the signer prompt is open", async () => {
    const { sender, client, calls } = passkey();
    let active = true;
    client.account!.signUserOperation = vi.fn(async () => {
      active = false;
      return "0x1234" as const;
    });
    await expect(
      sender.submitAtomicBatch(calls, {
        batchBudget: passkeyBudget,
        assertOwnership: async () => {
          if (!active) throw new Error("submission-ownership-changed");
        },
      })
    ).rejects.toThrow("submission-ownership-changed");
    expect(client.waitForUserOperationReceipt).not.toHaveBeenCalled();
  });
});

it.each([
  "0.3.1",
  "0.3.3",
] as const)("uses the installed Kernel %s encoder in default batch mode", async (version) => {
  const { sender, client, calls } = passkey();
  const request = vi.fn(async () => {
    throw new Error("encoding must not need an RPC");
  });
  const publicClient = createPublicClient({ chain: arbitrum, transport: custom({ request }) });
  const refuseSignature = async (): Promise<never> => {
    throw new Error("encoding must not sign");
  };
  const owner = toAccount({
    address: "0x1111111111111111111111111111111111111111",
    signMessage: refuseSignature,
    signTransaction: refuseSignature,
    signTypedData: refuseSignature,
  });
  const account = await toKernelSmartAccount({
    client: publicClient,
    owners: [owner],
    address: client.account!.address,
    version,
    entryPoint: { address: entryPoint07Address, version: "0.7" },
  });
  client.account!.encodeCalls = account.encodeCalls.bind(account);
  expect(
    (
      await sender.submitAtomicBatch(calls, {
        batchBudget: passkeyBudget,
      })
    ).status
  ).toBe("confirmed");
  expect(request).not.toHaveBeenCalled();
  expect(client.sendUserOperation).toHaveBeenCalledOnce();
});

it.each([
  ["missing sponsor", { paymaster: undefined }, "batch-sponsorship-required"],
  ["gas over ceiling", { verificationGasLimit: 5000001n }, "batch-budget-exceeded"],
  ["fee over ceiling", { maxFeePerGas: 1000000001n }, "batch-budget-exceeded"],
] as const)("refuses %s before the passkey is asked to sign", async (_name, patch, message) => {
  const { sender, client, calls } = passkey();
  const sign = vi.spyOn(client.account!, "signUserOperation");
  client.sendUserOperation.mockImplementation(async (request) => {
    await request.account!.signUserOperation({
      ...fakePreparedUserOperation(client.account!.address),
      ...patch,
    });
    return hash;
  });
  await expect(sender.submitAtomicBatch(calls, { batchBudget: passkeyBudget })).rejects.toThrow(
    message
  );
  expect(sign).not.toHaveBeenCalled();
  expect(client.waitForUserOperationReceipt).not.toHaveBeenCalled();
});

it("refuses an oversize wallet quote before asking the wallet", async () => {
  const { sender, deps, calls } = wallet();
  deps.preflightBatch.mockRejectedValueOnce(new Error("batch-budget-exceeded"));
  await expect(sender.submitAtomicBatch(calls, { batchBudget: walletBudget })).rejects.toThrow(
    "batch-budget-exceeded"
  );
  expect(deps.sendCalls).not.toHaveBeenCalled();
});

it.each([
  "kernel-failure",
  "sender",
  "operation",
] as const)("keeps scoped receipt recovery truthful after base migration: %s", async (kind) => {
  const { sender, client } = passkey();
  const receipt = await client.getUserOperationReceipt({ hash: MOCK_TX_HASH });
  client.getUserOperationReceipt.mockResolvedValue({
    ...receipt!,
    ...(kind === "sender" ? { sender: "0x2222222222222222222222222222222222222222" } : {}),
    ...(kind === "operation" ? { userOpHash: secondHash } : {}),
    logs:
      kind === "kernel-failure"
        ? [
            {
              address: client.account!.address,
              topics: [toEventSelector("TryExecuteUnsuccessful(uint256,bytes)")],
              data: "0x",
            },
          ]
        : [],
  } as unknown as NonNullable<typeof receipt>);
  await expect(
    sender.reconcileBatch({
      kind: "user-operation",
      hash: MOCK_TX_HASH,
      chainId: 42161,
      account: client.account!.address,
    })
  ).resolves.toMatchObject({ status: kind === "kernel-failure" ? "reverted" : "unresolved" });
});
