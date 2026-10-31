/**
 * useGardenSettingsBatch Tests
 * @vitest-environment happy-dom
 */

import "fake-indexeddb/auto";
import { act, waitFor } from "@testing-library/react";
import { toHex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gardensKeys } from "../../../config/query-keys/garden";
import type { GardenSettingsChange } from "../../../modules/garden/settings-batch";
import type { BatchCapability, BatchExecution } from "../../../modules/transactions/batch-types";
import type { Address } from "../../../types/domain";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithProviders } from "../../test-utils/render-helpers";
import { createFakeBatchingSender } from "../../test-utils/transaction-fakes";

const {
  auth,
  chainValues,
  connection,
  mockErrorHandler,
  mockIsBatchEnabled,
  mockSimulate,
  sending,
} = vi.hoisted(() => ({
  auth: { primaryAddress: null as string | null, passkeyAccountProfile: "kernel-0.3.1-legacy" },
  connection: { connector: { uid: "first-wallet" } as { uid: string } | undefined },
  chainValues: {} as Record<string, unknown>,
  mockErrorHandler: vi.fn(),
  mockIsBatchEnabled: vi.fn(),
  mockSimulate: vi.fn(),
  sending: { sender: null as unknown },
}));

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({ useCurrentChain: () => 42161 }));
vi.mock("../../../hooks/blockchain/useContractTxSender", () => ({
  useContractTxSender: () => vi.fn(),
}));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => sending.sender,
}));
vi.mock("../../../hooks/auth/useUser", () => ({ useUser: () => auth }));
vi.mock("wagmi", () => ({ useAccount: () => connection }));
vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: () => mockErrorHandler,
}));
vi.mock("../../../modules/transactions/batch-enablement", () => ({
  isBatchEnabled: mockIsBatchEnabled,
}));
vi.mock("../../../modules/garden/settings-batch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../modules/garden/settings-batch")>()),
  createGardenSettingsChain: () => ({
    read: async ({ functionName }: { functionName: string }) => chainValues[functionName],
    simulate: mockSimulate,
  }),
}));

const { useGardenSettingsBatch } = await import("../../../hooks/garden/useUpdateGarden");

const hash = `0x${"ab".repeat(32)}` as const;
const CHANGES: GardenSettingsChange[] = [
  { field: "name", value: "Tech and Sun" },
  { field: "openJoining", value: true },
];
const CONFIRMED: Partial<BatchExecution> = {
  status: "confirmed",
  receipts: [{ transactionHash: hash, status: "success" }],
};
const landing = () =>
  vi.fn(async () => ({
    status: "confirmed" as const,
    receipts: [{ transactionHash: hash, status: "success" as const }],
    sponsored: true,
  }));

function renderBatch(
  execution: Partial<BatchExecution> = {},
  atomic: BatchCapability["atomic"] = "supported"
) {
  const account: Address = toHex(crypto.getRandomValues(new Uint8Array(20)));
  const gardenAddress: Address = toHex(crypto.getRandomValues(new Uint8Array(20)));
  const sender = createFakeBatchingSender(account, execution);
  sender.getBatchCapability = vi.fn(async (scope) => ({ ...scope, atomic }));
  auth.primaryAddress = account;
  sending.sender = sender;
  const queryClient = createTestQueryClient();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const { result, rerender } = renderHookWithProviders(
    () => useGardenSettingsBatch(gardenAddress),
    { queryClient }
  );
  return { result, rerender, sender, invalidate };
}

describe("useGardenSettingsBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connection.connector = { uid: "first-wallet" };
    mockIsBatchEnabled.mockReturnValue(true);
    mockSimulate.mockResolvedValue(undefined);
    Object.assign(chainValues, { name: "Old name", openJoining: false });
  });

  it("stays off and asks no wallet for a combination nobody has listed", async () => {
    mockIsBatchEnabled.mockReturnValue(false);
    const { result, sender } = renderBatch();

    await waitFor(() => expect(result.current.isSettlingHold).toBe(false));

    expect(result.current.available).toBe(false);
    expect(sender.getBatchCapability).not.toHaveBeenCalled();
  });

  it("is available once listed and the sender reports atomic, and not before", async () => {
    const { result, sender } = renderBatch();
    await waitFor(() => expect(result.current.available).toBe(true));
    expect(mockIsBatchEnabled).toHaveBeenCalledWith({
      action: "garden-settings",
      rail: "passkey",
      profile: "kernel-0.3.1-legacy",
      chainId: 42161,
    });
    expect(sender.getBatchCapability).toHaveBeenCalledTimes(1);

    const notAtomic = renderBatch({}, "ready");
    await waitFor(() => expect(notAtomic.sender.getBatchCapability).toHaveBeenCalled());
    await waitFor(() => expect(notAtomic.result.current.isSettlingHold).toBe(false));
    expect(notAtomic.result.current.available).toBe(false);
  });

  it("asks again when the same account reconnects through another wallet", async () => {
    const { result, sender, rerender } = renderBatch({}, "ready");
    await waitFor(() => expect(sender.getBatchCapability).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.isSettlingHold).toBe(false));
    expect(result.current.available).toBe(false);

    connection.connector = { uid: "second-wallet" };
    sender.getBatchCapability = vi.fn(async (scope) => ({
      ...scope,
      atomic: "supported" as const,
    }));
    rerender();

    await waitFor(() => expect(result.current.available).toBe(true));
    expect(sender.getBatchCapability).toHaveBeenCalledTimes(1);
  });

  it("refreshes the garden after a save lands", async () => {
    const { result, invalidate } = renderBatch(CONFIRMED);
    Object.assign(chainValues, { name: "Tech and Sun", openJoining: true });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.send(CHANGES);
    });

    expect(outcome).toEqual({ status: "saved", transactionHash: hash });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: gardensKeys.all });
    expect(result.current.hold).toBeNull();
  });

  it("explains a failure before sending, and calls nothing sent", async () => {
    mockSimulate.mockRejectedValueOnce(new Error("NotGardenOwner"));
    const { result, sender } = renderBatch();

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.send(CHANGES);
    });

    expect(outcome).toEqual({ status: "not-saved" });
    expect(mockErrorHandler).toHaveBeenCalledTimes(1);
    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
  });

  it("holds an unknown save even after batching is switched off, until the person moves on", async () => {
    const { result } = renderBatch();
    await act(async () => {
      await result.current.send(CHANGES);
    });
    await waitFor(() => expect(result.current.hold?.fields).toEqual(["name", "openJoining"]));
    const firstRead = result.current.lastReadAt;
    expect(firstRead).toBeGreaterThan(0);

    mockIsBatchEnabled.mockReturnValue(false);
    vi.spyOn(Date, "now").mockReturnValue(firstRead + 1_000);
    await act(async () => {
      await result.current.checkAgain();
    });
    await waitFor(() => expect(result.current.lastReadAt).toBeGreaterThan(firstRead));
    expect(result.current.hold?.fields).toEqual(["name", "openJoining"]);
    vi.restoreAllMocks();

    await act(async () => {
      await result.current.moveOn();
    });
    await waitFor(() => expect(result.current.hold).toBeNull());
    expect(result.current.saved).toEqual([]);
  });

  it("reports what a second look proves landed, and refreshes the garden", async () => {
    const { result, sender, invalidate } = renderBatch();
    await act(async () => {
      await result.current.send(CHANGES);
    });
    await waitFor(() => expect(result.current.hold).not.toBeNull());

    sender.reconcileBatch = landing();
    Object.assign(chainValues, { name: "Tech and Sun", openJoining: true });
    await act(async () => {
      await result.current.checkAgain();
    });

    await waitFor(() => expect(result.current.saved).toEqual(CHANGES));
    expect(result.current.hold).toBeNull();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: gardensKeys.all });
  });

  it("reports a save the read after sending proves landed, with nobody asking", async () => {
    const { result, sender } = renderBatch();
    sender.reconcileBatch = landing();
    Object.assign(chainValues, { name: "Tech and Sun", openJoining: true });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.send(CHANGES);
    });

    expect(outcome).toEqual({ status: "unknown" });
    await waitFor(() => expect(result.current.saved).toEqual(CHANGES));
    expect(result.current.hold).toBeNull();
  });
});
