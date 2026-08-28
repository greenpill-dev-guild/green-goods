/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Address, Garden } from "../../../types/domain";
import type { KarmaIntegrationProjection } from "../../../types/karma";

const GARDEN = "0x1111111111111111111111111111111111111111" as Address;
const OWNER = "0x2222222222222222222222222222222222222222" as Address;
const TOKEN = "0x3333333333333333333333333333333333333333" as Address;
const MODULE = "0x4444444444444444444444444444444444444444" as Address;
const PROJECT_UID = `0x${"55".repeat(32)}` as const;

const mocks = vi.hoisted(() => ({
  readContract: vi.fn(),
  getProjection: vi.fn(),
  sendContractCall: vi.fn(),
  schedule: vi.fn(),
  handleError: vi.fn(() => ({ message: "Karma write failed" })),
  toast: {
    loading: vi.fn(() => "karma-toast"),
    dismiss: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@wagmi/core", () => ({ readContract: mocks.readContract }));
vi.mock("../../../config/appkit", () => ({ getWagmiConfig: () => ({}) }));
vi.mock("../../../modules/data/karma", () => ({
  getKarmaGardenProjection: mocks.getProjection,
}));
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => OWNER,
}));
vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 42161,
}));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => ({
    sendContractCall: mocks.sendContractCall,
    supportsBatching: false,
    supportsSponsorship: false,
    authMode: "wallet",
  }),
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

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(IntlProvider, { locale: "en", messages: {}, children })
    );
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

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
    mockSuccessfulReads();
  });

  it("reads the canonical account slug and exposes its profile URL", async () => {
    const queryClient = createQueryClient();
    const { result } = renderHook(() => useKarmaIntegration(garden), {
      wrapper: createWrapper(queryClient),
    });

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
    const queryClient = createQueryClient();
    const { result } = renderHook(() => useKarmaIntegration(garden), {
      wrapper: createWrapper(queryClient),
    });

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
    const queryClient = createQueryClient();
    const { result } = renderHook(() => useKarmaIntegration(garden), {
      wrapper: createWrapper(queryClient),
    });

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
    const queryClient = createQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useKarmaIntegration(garden), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.reconcile()).rejects.toBe(partialFailure);
    });

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
});
