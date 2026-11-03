/**
 * useActionEditBatch Tests
 * @vitest-environment happy-dom
 */

import "fake-indexeddb/auto";
import { act, waitFor } from "@testing-library/react";
import { toHex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { actionsKeys, batchKeys } from "../../../config/query-keys/garden";
import type { ActionEditChange } from "../../../modules/action/action-edit";
import type { BatchCapability, BatchExecution } from "../../../modules/transactions/batch-types";
import type { Address } from "../../../types/domain";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithProviders } from "../../test-utils/render-helpers";
import { createFakeBatchingSender } from "../../test-utils/transaction-fakes";

const {
  auth,
  action,
  mockErrorHandler,
  mockIsBatchEnabled,
  mockSimulate,
  mockToastError,
  sending,
} = vi.hoisted(() => ({
  auth: { primaryAddress: null as string | null, passkeyAccountProfile: "kernel-0.3.1-legacy" },
  action: {} as Record<string, unknown>,
  mockErrorHandler: vi.fn(),
  mockIsBatchEnabled: vi.fn(),
  mockSimulate: vi.fn(),
  mockToastError: vi.fn(),
  sending: { sender: null as unknown },
}));

vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => sending.sender,
}));
vi.mock("../../../hooks/auth/useUser", () => ({ useUser: () => auth }));
vi.mock("wagmi", () => ({ useAccount: () => ({ connector: { uid: "wallet" } }) }));
vi.mock("../../../components/toast", () => ({ toastService: { error: mockToastError } }));
vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: () => mockErrorHandler,
}));
vi.mock("../../../modules/transactions/batch-enablement", () => ({
  isBatchEnabled: mockIsBatchEnabled,
}));
vi.mock("../../../modules/action/action-edit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../modules/action/action-edit")>()),
  createActionEditChain: () => ({ read: async () => ({ ...action }), simulate: mockSimulate }),
}));

const { useActionEditBatch } = await import("../../../hooks/action/useActionEditBatch");

const hash = `0x${"ab".repeat(32)}` as const;
const AUGUST = { startTime: 1785542400n, endTime: 1788134400n };
const MOVED_TO_OCTOBER: ActionEditChange[] = [
  { field: "title", value: "Plant the October beds" },
  { field: "startTime", value: 1790812800 },
  { field: "endTime", value: 1793404800 },
];

/** Every batch that asks this wallet shares one answer under this key. */
const capabilityKey = (account: Address) => batchKeys.capability(account, 42161, "wallet");

function renderBatch(
  execution: Partial<BatchExecution> = {},
  { atomic = "supported", authMode = "passkey", cached } = {} as {
    atomic?: BatchCapability["atomic"];
    authMode?: "passkey" | "wallet";
    /** What another batch already cached for this wallet. */
    cached?: BatchCapability["atomic"];
  }
) {
  const account: Address = toHex(crypto.getRandomValues(new Uint8Array(20)));
  // Each test edits its own action: the journal outlives each one.
  const actionUID = BigInt(crypto.getRandomValues(new Uint32Array(1))[0]);
  const sender = Object.assign(createFakeBatchingSender(account, execution), { authMode });
  sender.getBatchCapability = vi.fn(async (scope) =>
    // While this wallet's own answer is out, the cached one stands.
    cached ? new Promise<never>(() => undefined) : { ...scope, atomic }
  );
  auth.primaryAddress = account;
  sending.sender = sender;
  const queryClient = createTestQueryClient();
  if (cached) queryClient.setQueryData(capabilityKey(account), cached);
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const { result } = renderHookWithProviders(() => useActionEditBatch(42161, actionUID), {
    queryClient,
  });
  return { result, sender, invalidate, queryClient, account };
}

describe("useActionEditBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBatchEnabled.mockReturnValue(true);
    mockSimulate.mockResolvedValue(undefined);
    Object.assign(action, { ...AUGUST, title: "Plant the August beds", instructions: "bafy-old" });
  });

  it("asks no wallet until its rail is listed, then batches only with atomic calls", async () => {
    mockIsBatchEnabled.mockReturnValue(false);
    const unlisted = renderBatch();
    await waitFor(() => expect(unlisted.result.current.isSettlingHold).toBe(false));
    expect(unlisted.result.current.available).toBe(false);
    expect(unlisted.sender.getBatchCapability).not.toHaveBeenCalled();

    mockIsBatchEnabled.mockReturnValue(true);
    const passkey = renderBatch();
    await waitFor(() => expect(passkey.result.current.available).toBe(true));
    expect(mockIsBatchEnabled).toHaveBeenLastCalledWith({
      action: "action-edit",
      rail: "passkey",
      profile: "kernel-0.3.1-legacy",
      chainId: 42161,
    });
    // Deposits read this answer from the same key, so it stays the wallet's own word.
    expect(passkey.queryClient.getQueryData(capabilityKey(passkey.account))).toBe("supported");

    const wallet = renderBatch({}, { atomic: "ready", authMode: "wallet" });
    await waitFor(() => expect(wallet.sender.getBatchCapability).toHaveBeenCalled());
    await waitFor(() => expect(wallet.result.current.isSettlingHold).toBe(false));
    expect(wallet.result.current.available).toBe(false);
    expect(mockIsBatchEnabled).toHaveBeenLastCalledWith(
      expect.objectContaining({ rail: "wallet", profile: "eip-5792" })
    );
  });

  it("edits field by field on a wallet another batch already found unable to batch", async () => {
    const { result, sender } = renderBatch({}, { authMode: "wallet", cached: "unsupported" });

    await waitFor(() => expect(sender.getBatchCapability).toHaveBeenCalled());
    await waitFor(() => expect(result.current.isSettlingHold).toBe(false));

    expect(result.current.available).toBe(false);
  });

  it("explains a save that failed once, whether it reverted or never went out", async () => {
    const reverted = renderBatch({ status: "reverted" });
    let outcome: unknown;
    await act(async () => {
      outcome = await reverted.result.current.send(MOVED_TO_OCTOBER);
    });
    expect(outcome).toEqual({ status: "not-saved" });
    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockErrorHandler).not.toHaveBeenCalled();

    mockSimulate.mockRejectedValueOnce(new Error("NotActionOwner"));
    const refused = renderBatch();
    await act(async () => {
      outcome = await refused.result.current.send(MOVED_TO_OCTOBER);
    });
    expect(outcome).toEqual({ status: "not-saved" });
    expect(mockErrorHandler).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(refused.sender.submitAtomicBatch).not.toHaveBeenCalled();
  });

  it("holds an unknown save until a second look proves it, then refreshes the actions", async () => {
    const { result, sender, invalidate } = renderBatch();
    await act(async () => {
      await result.current.send(MOVED_TO_OCTOBER);
    });
    await waitFor(() =>
      expect(result.current.hold?.fields).toEqual(["title", "endTime", "startTime"])
    );
    expect(result.current.holdFeedback?.detail).toContain("Title on chain: Plant the August beds");

    sender.reconcileBatch = vi.fn(async () => ({
      status: "confirmed" as const,
      receipts: [{ transactionHash: hash, status: "success" as const }],
      sponsored: true,
    }));
    Object.assign(action, {
      title: "Plant the October beds",
      startTime: 1790812800n,
      endTime: 1793404800n,
    });
    await act(async () => {
      await result.current.checkAgain();
    });

    await waitFor(() => expect(result.current.saved).toHaveLength(3));
    expect(result.current.hold).toBeNull();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: actionsKeys.byChain(42161) });
  });

  it("orders a save that goes one write at a time by the window the chain holds", async () => {
    const { result } = renderBatch();

    const ordered = await result.current.order(MOVED_TO_OCTOBER);

    expect(ordered.map((change) => change.field)).toEqual(["title", "endTime", "startTime"]);
  });
});
