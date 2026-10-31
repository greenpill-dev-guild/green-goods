/**
 * useAddMembersBatch Tests
 * @vitest-environment happy-dom
 */

import "fake-indexeddb/auto";
import { act, waitFor } from "@testing-library/react";
import { toHex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gardensKeys } from "../../../config/query-keys/garden";
import type { GardenMemberRow } from "../../../modules/garden/members-batch";
import {
  type BatchExecution,
  BatchNotSubmittedError,
} from "../../../modules/transactions/batch-types";
import { type Address, type Garden } from "../../../types/domain";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithProviders } from "../../test-utils/render-helpers";
import { createFakeBatchingSender } from "../../test-utils/transaction-fakes";

const {
  auth,
  mockErrorHandler,
  mockIsBatchEnabled,
  mockRefusal,
  sending,
  toasts,
  tracking,
  wearing,
} = vi.hoisted(() => ({
  auth: { primaryAddress: null as string | null, passkeyAccountProfile: "kernel-0.3.1-legacy" },
  mockErrorHandler: vi.fn(),
  mockIsBatchEnabled: vi.fn(),
  mockRefusal: vi.fn(),
  sending: { sender: null as unknown },
  toasts: { success: vi.fn(), info: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
  tracking: { started: vi.fn(), success: vi.fn(), failed: vi.fn() },
  wearing: new Set<string>(),
}));

vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => sending.sender,
}));
vi.mock("../../../hooks/auth/useUser", () => ({ useUser: () => auth }));
vi.mock("../../../components/toast", () => ({ toastService: toasts }));
vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: () => mockErrorHandler,
}));
vi.mock("../../../modules/transactions/batch-enablement", () => ({
  isBatchEnabled: mockIsBatchEnabled,
}));
vi.mock("../../../modules/app/analytics-events", () => ({
  trackAdminMemberAddStarted: tracking.started,
  trackAdminMemberAddSuccess: tracking.success,
  trackAdminMemberAddFailed: tracking.failed,
}));
vi.mock("../../../modules/garden/members-batch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../modules/garden/members-batch")>()),
  createGardenMembersChain: () => ({
    hatsModule: async () => "0x5b943088ecdDBF8E4ae387348A88A654aC5F7266",
    wearsRole: async ({ address, role }: GardenMemberRow) =>
      wearing.has(`${address.toLowerCase()}:${role}`),
    refusal: mockRefusal,
  }),
}));

vi.mock("../../../config/default-chain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../config/default-chain")>()),
  DEFAULT_CHAIN_ID: 42161,
}));

const { useAddMembersBatch } = await import("../../../hooks/garden/useAddMembersBatch");

const hash = `0x${"ab".repeat(32)}` as const;
const randomAddress = (): Address => toHex(crypto.getRandomValues(new Uint8Array(20)));
const CONFIRMED: Partial<BatchExecution> = {
  status: "confirmed",
  receipts: [{ transactionHash: hash, status: "success" }],
};

function renderBatch(execution: Partial<BatchExecution> = {}) {
  const account = randomAddress();
  const gardenAddress = randomAddress();
  const sender = createFakeBatchingSender(account, execution);
  auth.primaryAddress = account;
  sending.sender = sender;
  const queryClient = createTestQueryClient();
  // Nothing observes the roster here, and the test client collects unobserved data at once.
  queryClient.setQueryDefaults(gardensKeys.byChain(42161), { gcTime: Number.POSITIVE_INFINITY });
  const rendered = renderHookWithProviders(() => useAddMembersBatch(gardenAddress), {
    queryClient,
  });
  return { ...rendered, sender, queryClient, gardenAddress };
}

const rows = (): GardenMemberRow[] => [
  { address: randomAddress(), role: "gardener" },
  { address: randomAddress(), role: "evaluator" },
];

describe("useAddMembersBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wearing.clear();
    mockIsBatchEnabled.mockReturnValue(true);
    mockRefusal.mockResolvedValue(null);
  });

  it("is available only once its rail is listed, and needs no wallet capability", async () => {
    mockIsBatchEnabled.mockReturnValue(false);
    const unlisted = renderBatch();
    await waitFor(() => expect(unlisted.result.current.isSettlingHold).toBe(false));
    expect(unlisted.result.current.available).toBe(false);

    mockIsBatchEnabled.mockReturnValue(true);
    const listed = renderBatch();
    await waitFor(() => expect(listed.result.current.available).toBe(true));
    expect(mockIsBatchEnabled).toHaveBeenLastCalledWith({
      action: "add-members",
      rail: "passkey",
      profile: "kernel-0.3.1-legacy",
      chainId: 42161,
    });
    expect(listed.sender.getBatchCapability).not.toHaveBeenCalled();
    expect(listed.result.current.signaturesFor(11)).toBe(2);
    expect(listed.result.current.account).toBe(auth.primaryAddress);
  });

  it("adds the list, updates the roster, and says so once", async () => {
    const { result, queryClient, gardenAddress } = renderBatch(CONFIRMED);
    const list = rows();
    queryClient.setQueryData(gardensKeys.byChain(42161), [
      { id: gardenAddress, gardeners: [], evaluators: [] },
    ] as unknown as Garden[]);
    mockRefusal.mockImplementation(async () => {
      for (const { address, role } of list) wearing.add(`${address.toLowerCase()}:${role}`);
      return null;
    });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.add(list);
    });

    expect(outcome).toMatchObject({ notSent: [], refused: [], unknown: [] });
    expect(toasts.success).toHaveBeenCalledTimes(1);
    const [garden] = queryClient.getQueryData<Garden[]>(gardensKeys.byChain(42161))!;
    expect(garden.gardeners).toContain(list[0].address.toLowerCase());
    expect(garden.evaluators).toContain(list[1].address.toLowerCase());
  });

  it("tells analytics only about rows it tried", async () => {
    const { result } = renderBatch(CONFIRMED);
    const [held, sent] = rows();
    wearing.add(`${held.address.toLowerCase()}:${held.role}`);
    mockRefusal.mockImplementation(async () => {
      wearing.add(`${sent.address.toLowerCase()}:${sent.role}`);
      return null;
    });

    await act(async () => {
      await result.current.add([held, sent]);
    });

    expect(tracking.started).toHaveBeenCalledTimes(1);
    expect(tracking.started).toHaveBeenCalledWith(
      expect.objectContaining({ targetAddress: sent.address })
    );
    expect(tracking.success).toHaveBeenCalledTimes(1);
    expect(tracking.failed).not.toHaveBeenCalled();
  });

  it("leaves a list past its ceilings out of analytics until someone tries it", async () => {
    const { result, sender } = renderBatch(CONFIRMED);
    vi.mocked(sender.sendContractCall).mockImplementationOnce(async () => {
      throw new BatchNotSubmittedError(new Error("batch-budget-exceeded"));
    });
    const list = rows();

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.add(list);
    });

    expect(outcome).toMatchObject({ notBatchable: list, notSent: [] });
    expect(tracking.started).not.toHaveBeenCalled();
    expect(tracking.failed).not.toHaveBeenCalled();
    expect(mockErrorHandler).not.toHaveBeenCalled();
  });

  it("explains a failure before sending, and keeps every row", async () => {
    const { result } = renderBatch();
    const list = rows();
    mockRefusal.mockResolvedValueOnce(null).mockResolvedValueOnce("Not a garden admin");

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.add(list);
    });

    expect(outcome).toMatchObject({ notSent: list, added: [] });
    expect(mockErrorHandler).toHaveBeenCalledTimes(1);
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it("holds an unknown add even after batching is switched off, until the person moves on", async () => {
    const { result } = renderBatch();
    const list = rows();
    await act(async () => {
      await result.current.add(list);
    });
    await waitFor(() => expect(result.current.hold?.rows).toHaveLength(2));
    expect(result.current.hold?.onChain).toHaveLength(2);

    mockIsBatchEnabled.mockReturnValue(false);
    await act(async () => {
      await result.current.moveOn();
    });

    await waitFor(() => expect(result.current.hold).toBeNull());
    expect(result.current.saved).toEqual([]);
  });

  it("lands what a later read proves, and tells a tab that was showing it", async () => {
    const { result, sender, queryClient, gardenAddress } = renderBatch();
    const list = rows();
    queryClient.setQueryData(gardensKeys.byChain(42161), [
      { id: gardenAddress, gardeners: [], evaluators: [] },
    ] as unknown as Garden[]);
    await act(async () => {
      await result.current.add(list);
    });
    await waitFor(() => expect(result.current.hold).not.toBeNull());

    sender.reconcileBatch = vi.fn(async () => CONFIRMED as BatchExecution);
    for (const { address, role } of list) wearing.add(`${address.toLowerCase()}:${role}`);
    await act(async () => {
      await result.current.checkAgain();
    });

    await waitFor(() => expect(result.current.saved).toHaveLength(2));
    expect(result.current.hold).toBeNull();
    expect(toasts.success).toHaveBeenCalledTimes(1);
    // The add that started unknown ends in analytics too.
    expect(tracking.started).toHaveBeenCalledTimes(2);
    expect(tracking.success).toHaveBeenCalledTimes(2);
    expect(tracking.success).toHaveBeenCalledWith(expect.objectContaining({ txHash: hash }));
    const [garden] = queryClient.getQueryData<Garden[]>(gardensKeys.byChain(42161))!;
    expect(garden.gardeners).toContain(list[0].address.toLowerCase());
  });
});
