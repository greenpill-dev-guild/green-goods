/**
 * @vitest-environment happy-dom
 */

import "fake-indexeddb/auto";
import { act, waitFor } from "@testing-library/react";
import { encodeAbiParameters, encodeEventTopics, type Log } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { KARMA_MODULE_ABI } from "../../../modules/garden/karma-sync-records";
import type { TransactionSender } from "../../../modules/transactions/types";
import type { Address, Garden } from "../../../types/domain";
import type { KarmaIntegrationProjection } from "../../../types/karma";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithProviders } from "../../test-utils/render-helpers";
import { captureSendActs } from "../../test-utils/send-acts";
import { createFakeBatchingSender } from "../../test-utils/transaction-fakes";

const GARDEN = "0x1111111111111111111111111111111111111111" as Address;
const OWNER = "0x2222222222222222222222222222222222222222" as Address;
const TOKEN = "0x3333333333333333333333333333333333333333" as Address;
const MODULE = "0x4444444444444444444444444444444444444444" as Address;
const PROJECT_UID = `0x${"55".repeat(32)}` as const;

const mocks = vi.hoisted(() => ({
  readContract: vi.fn(),
  getTransactionReceipt: vi.fn(),
  getProjection: vi.fn(),
  sendContractCall: vi.fn(),
  sender: null as unknown,
  listed: false,
  schedule: vi.fn(),
  handleError: vi.fn(() => ({ message: "Karma write failed" })),
  toast: {
    loading: vi.fn(() => "karma-toast"),
    dismiss: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@wagmi/core", () => ({
  readContract: mocks.readContract,
  getTransactionReceipt: mocks.getTransactionReceipt,
}));
vi.mock("wagmi", () => ({ useAccount: () => ({ connector: undefined }) }));
vi.mock("../../../config/appkit", () => ({ getWagmiConfig: () => ({}) }));
vi.mock("../../../modules/data/karma", () => ({
  getKarmaGardenProjection: mocks.getProjection,
}));
vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: OWNER, passkeyAccountProfile: "kernel-0.3.1-legacy" }),
}));
// No rail lists Karma yet; a test lists it to reach the batch.
vi.mock("../../../modules/transactions/batch-enablement", () => ({
  isBatchEnabled: (query: { action: string }) => mocks.listed && query.action === "karma-reconcile",
}));
vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 42161,
}));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => mocks.sender,
}));
vi.mock("../../../utils/blockchain/contracts", () => ({
  GardenTokenABI: [],
  getNetworkContracts: () => ({ karmaGAPModule: MODULE }),
}));
vi.mock("../../../components/toast", () => ({ toastService: mocks.toast }));
vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: () => mocks.handleError,
}));
vi.mock("../../../hooks/utils/useTimeout", () => ({
  useProgressiveInvalidation: () => ({ start: mocks.schedule, cancel: vi.fn() }),
}));

const { useKarmaIntegration } = await import("../../../hooks/garden/useKarmaIntegration");

const projection: KarmaIntegrationProjection = {
  projectUID: PROJECT_UID,
  projectState: "synced",
  projectReason: null,
  detailsState: "synced",
  detailsReason: null,
  membershipState: "synced",
  membershipReason: null,
  accessState: "synced",
  accessReason: null,
  projectUpdateState: "synced",
  projectUpdateReason: null,
  membershipPendingAccounts: [],
  membershipFailedAccounts: [],
  accessPendingAccounts: [],
  accessFailedAccounts: [],
  lastFailureReason: null,
  lastSyncAt: 1,
};

const garden: Garden = {
  id: GARDEN,
  chainId: 42161,
  tokenAddress: TOKEN,
  tokenID: 1n,
  name: "Mutable Garden Name",
  description: "",
  location: "",
  bannerImage: "",
  stewards: [],
  owners: [OWNER],
  gardeners: [],
  evaluators: [],
  funders: [],
  communities: [],
  assessments: [],
  works: [],
  createdAt: 1,
};

function mockSuccessfulReads() {
  mocks.getProjection.mockResolvedValue(projection);
  mocks.readContract.mockImplementation(async (_config, request) => {
    if (request.functionName === "karmaSyncVersion") return 1n;
    if (request.functionName === "slug") return "canonical-garden-slug";
    if (request.functionName === "ownerOf") return OWNER;
    throw new Error(`Unexpected read: ${request.functionName}`);
  });
}

describe("useKarmaIntegration query and mutation seams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.handleError.mockReturnValue({ message: "Karma write failed" });
    mocks.listed = false;
    mocks.sender = {
      sendContractCall: mocks.sendContractCall,
      supportsBatching: false,
      supportsSponsorship: false,
      authMode: "wallet",
    } satisfies TransactionSender;
    mockSuccessfulReads();
  });

  it("reads the canonical account slug and exposes its profile URL", async () => {
    const { result } = renderHookWithProviders(() => useKarmaIntegration(garden));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.status.status).toBe("synced");
    expect(result.current.profileUrl).toBe("https://www.karmahq.org/project/canonical-garden-slug");
    expect(mocks.readContract).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ address: GARDEN, functionName: "slug" })
    );
  });

  it("uses the Karma name-derived slug when the account slug is empty", async () => {
    mocks.readContract.mockImplementation(async (_config, request) => {
      if (request.functionName === "karmaSyncVersion") return 1n;
      if (request.functionName === "slug") return "";
      if (request.functionName === "ownerOf") return OWNER;
      throw new Error(`Unexpected read: ${request.functionName}`);
    });
    const { result } = renderHookWithProviders(() => useKarmaIntegration(garden));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.profileUrl).toBe("https://www.karmahq.org/project/mutable-garden-name");
  });

  it("surfaces a slug read error as failed instead of an upgrade or missing project", async () => {
    const slugFailure = new Error("slug read unavailable");
    mocks.readContract.mockImplementation(async (_config, request) => {
      if (request.functionName === "karmaSyncVersion") return 1n;
      if (request.functionName === "slug") throw slugFailure;
      if (request.functionName === "ownerOf") return OWNER;
      throw new Error(`Unexpected read: ${request.functionName}`);
    });
    const { result } = renderHookWithProviders(() => useKarmaIntegration(garden));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.status).toMatchObject({
      status: "failed",
      reason: "karma_status_read_unavailable",
    });
    expect(result.current.error).toBe(slugFailure);
    expect(result.current.profileUrl).toBeNull();
    expect(result.current.canReconcile).toBe(false);
  });

  it("invalidates immediately and schedules refresh after a partial sequential failure", async () => {
    const partialFailure = new Error("access transaction failed");
    mocks.sendContractCall
      .mockResolvedValueOnce({ hash: `0x${"66".repeat(32)}`, sponsored: false })
      .mockRejectedValueOnce(partialFailure);
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHookWithProviders(() => useKarmaIntegration(garden), { queryClient });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const { acts, sent } = await captureSendActs(() =>
      act(async () => {
        await expect(result.current.reconcile()).rejects.toBe(partialFailure);
      })
    );
    // The first call landed before the second failed: the act keeps both (PRD-1571).
    expect(acts).toEqual([
      ["send_act_started", "karma_sync", undefined],
      ["send_act_ended", "karma_sync", "partial"],
    ]);
    expect(sent).toContain('"copies_confirmed":1');
    expect(sent).toContain('"copies_failed":1');

    expect(mocks.sendContractCall).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ functionName: "reconcileProject" })
    );
    expect(mocks.sendContractCall).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ functionName: "reconcileProjectAccess", args: [GARDEN, OWNER] })
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["greengoods", "gardens", "karma", "status", GARDEN, 42161],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["greengoods", "gardens", "karma", "slug", GARDEN, 42161],
    });
    expect(mocks.schedule).toHaveBeenCalledOnce();
    expect(mocks.toast.error).toHaveBeenCalled();
  });

  it("sends a listed passkey's sync under one signature and calls a recorded failure a failure", async () => {
    mocks.listed = true;
    const sender = createFakeBatchingSender(OWNER, {
      status: "confirmed",
      receipts: [{ transactionHash: `0x${"66".repeat(32)}`, status: "success" }],
    });
    mocks.sender = sender;
    const synced = (account: Address, operation: number, outcome: number) => ({
      address: MODULE,
      topics: encodeEventTopics({
        abi: KARMA_MODULE_ABI,
        eventName: "KarmaSyncRecorded",
        args: { garden: GARDEN, projectUID: PROJECT_UID, account },
      }),
      data: encodeAbiParameters(
        [
          { type: "uint8" },
          { type: "uint8" },
          { type: "bytes32" },
          { type: "bytes32" },
          { type: "string" },
        ],
        [operation, outcome, PROJECT_UID, PROJECT_UID, outcome === 2 ? "attestation_failed" : ""]
      ),
    });
    const NONE = "0x0000000000000000000000000000000000000000" as Address;
    // The project and its details are current; the owner's access lands, its MemberOf does not.
    mocks.getTransactionReceipt.mockResolvedValue({
      logs: [
        synced(NONE, 0, 0),
        synced(NONE, 1, 0),
        synced(OWNER, 3, 0),
        synced(OWNER, 2, 2),
      ] as unknown as Log[],
    });
    const { result } = renderHookWithProviders(() => useKarmaIntegration(garden));
    await waitFor(() => expect(result.current.signatures).toBe(1));

    const { acts, sent } = await captureSendActs(() => act(() => result.current.reconcile()));

    // The transaction landed, so the act did, even though one sync inside it failed (PRD-1571).
    expect(acts).toEqual([
      ["send_act_started", "karma_sync", undefined],
      ["send_act_ended", "karma_sync", "confirmed"],
    ]);
    for (const value of [GARDEN, OWNER]) expect(sent).not.toContain(value.slice(2).toLowerCase());
    expect(sender.submitAtomicBatch).toHaveBeenCalledOnce();
    expect(vi.mocked(sender.submitAtomicBatch!).mock.calls[0][0]).toEqual([
      expect.objectContaining({ functionName: "reconcileProject", args: [GARDEN] }),
      expect.objectContaining({ functionName: "reconcileProjectAccess", args: [GARDEN, OWNER] }),
    ]);
    expect(mocks.sendContractCall).not.toHaveBeenCalled();
    expect(mocks.toast.success).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringMatching(/^One part of this sync/) })
    );
  });

  it("ends a listed sync still confirming while nobody can say it landed (PRD-1571)", async () => {
    mocks.listed = true;
    mocks.sender = createFakeBatchingSender(OWNER);
    const { result } = renderHookWithProviders(() => useKarmaIntegration(garden));
    await waitFor(() => expect(result.current.signatures).toBe(1));

    const { acts } = await captureSendActs(() => act(() => result.current.reconcile()));

    expect(acts).toEqual([
      ["send_act_started", "karma_sync", undefined],
      ["send_act_ended", "karma_sync", "confirming"],
    ]);
  });

  it("keeps a sequential call still awaiting its receipt as confirming when a later one fails (PRD-1571)", async () => {
    const failure = new Error("access transaction failed");
    mocks.sendContractCall
      .mockResolvedValueOnce({
        hash: `0x${"66".repeat(32)}`,
        sponsored: false,
        confirmation: "pending",
      })
      .mockRejectedValueOnce(failure);
    const { result } = renderHookWithProviders(() => useKarmaIntegration(garden));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const { acts, sent } = await captureSendActs(() =>
      act(async () => {
        await expect(result.current.reconcile()).rejects.toBe(failure);
      })
    );

    expect(acts.at(-1)).toEqual(["send_act_ended", "karma_sync", "partial"]);
    expect(sent).toContain('"copies_confirming":1');
    expect(sent).not.toContain('"copies_confirmed"');
  });
});
