import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RenderHookOptions } from "@testing-library/react";
import type { ReactNode } from "react";
import { act, renderHook as baseRenderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GardenJoinRequestQueueResponse,
  GardenJoinRequestSelfResponse,
} from "../../public-contracts/join-requests";
import type { Address } from "../../types/domain";
import { createTestQueryClient } from "../test-utils/query-client";

const mocks = vi.hoisted(() => ({
  sign: vi.fn(),
  accountAddress: "0x2222222222222222222222222222222222222222" as Address,
  mine: vi.fn(),
  create: vi.fn(),
  withdraw: vi.fn(),
  list: vi.fn(),
  trackFailed: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useSignMessage: () => ({ signMessageAsync: vi.fn(async () => "0x1234") }),
}));

vi.mock("../../hooks/auth/useAuth", () => ({
  useAuth: () => ({ authMode: "wallet", smartAccountClient: null }),
}));

vi.mock("../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => mocks.accountAddress,
}));

vi.mock("../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 42161,
}));

vi.mock("../../modules/auth/account-message-signer", () => ({
  createAccountMessageSigner: () => mocks.sign,
  resolveAccountFactoryArgs: vi.fn(async () => undefined),
}));

vi.mock("../../modules/garden-join-requests/analytics", () => ({
  trackGardenJoinRequestFailed: (...args: unknown[]) => mocks.trackFailed(...args),
}));

vi.mock("../../modules/garden-join-requests", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../modules/garden-join-requests")>()),
  gardenJoinRequestTransport: {
    mine: (...args: unknown[]) => mocks.mine(...args),
    create: (...args: unknown[]) => mocks.create(...args),
    withdraw: (...args: unknown[]) => mocks.withdraw(...args),
    list: (...args: unknown[]) => mocks.list(...args),
  },
}));

import { useGardenJoinRequests } from "../../hooks/garden/useGardenJoinRequests";
import { GardenJoinRequestTransportError } from "../../modules/garden-join-requests";

let testClient: QueryClient;
function renderHook<Result, Props>(
  callback: (props: Props) => Result,
  options: RenderHookOptions<Props> = {}
) {
  return baseRenderHook(callback, {
    ...options,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={testClient}>{children}</QueryClientProvider>
    ),
  });
}

const GARDEN_A = "0x1111111111111111111111111111111111111111" as const;
const GARDEN_B = "0x3333333333333333333333333333333333333333" as const;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const selfResponse: GardenJoinRequestSelfResponse = {
  ok: true,
  request: {
    id: "request-a",
    kind: "garden_membership",
    state: "pending",
    revision: 0,
    requestedVia: "garden_detail",
    requestedAt: "2026-08-27T12:00:00.000Z",
    expiresAt: "2026-09-26T12:00:00.000Z",
    canAskAgain: false,
  },
};

const queueResponse: GardenJoinRequestQueueResponse = {
  ok: true,
  items: [
    {
      ...selfResponse.request!,
      accountAddress: "0x4444444444444444444444444444444444444444",
      displayName: "Maya",
    },
  ],
  rateLimitedRecently: false,
};

describe("useGardenJoinRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testClient = createTestQueryClient();
    // Remount tests need the normal cache lifetime; the helper otherwise collects immediately.
    testClient.setDefaultOptions({
      ...testClient.getDefaultOptions(),
      queries: { ...testClient.getDefaultOptions().queries, gcTime: 5 * 60 * 1000 },
    });
    mocks.accountAddress = "0x2222222222222222222222222222222222222222";
    mocks.sign.mockResolvedValue("0x1234");
    mocks.mine.mockResolvedValue(selfResponse);
    mocks.create.mockResolvedValue(selfResponse);
    mocks.withdraw.mockResolvedValue({ ok: true });
    mocks.list.mockResolvedValue(queueResponse);
  });

  it("retains pending status and its authorization when the dialog remounts", async () => {
    const first = renderHook(() => useGardenJoinRequests(GARDEN_A));
    await act(async () => {
      await first.result.current.submitRequest({
        displayName: "Maya",
        requestedVia: "garden_detail",
      });
    });
    first.unmount();
    const second = renderHook(() => useGardenJoinRequests(GARDEN_A));
    expect(second.result.current.request?.state).toBe("pending");
    expect(second.result.current.hasCheckedStatus).toBe(true);
    await act(async () => {
      await second.result.current.checkStatus();
    });
    expect(mocks.mine.mock.calls[0][1]).toMatchObject({
      action: "create",
      readSelf: { audience: window.location.origin },
    });
  });

  it("reuses an independently signed status proof until expiry", async () => {
    const { result } = renderHook(() => useGardenJoinRequests(GARDEN_A));
    await act(async () => {
      await result.current.checkStatus();
      await result.current.checkStatus();
    });
    expect(mocks.mine.mock.calls[0][1]).toBe(mocks.mine.mock.calls[1][1]);
  });

  it("reconciles a lost create response using its retained grant after remount", async () => {
    mocks.create.mockRejectedValueOnce(
      new GardenJoinRequestTransportError("Lost response", undefined, undefined, true)
    );
    const first = renderHook(() => useGardenJoinRequests(GARDEN_A));
    await act(async () => {
      await expect(
        first.result.current.submitRequest({ displayName: "Maya", requestedVia: "garden_detail" })
      ).rejects.toThrow();
    });
    first.unmount();
    const second = renderHook(() => useGardenJoinRequests(GARDEN_A));
    expect(second.result.current.outcomeUnknown).toBe(true);
    expect(second.result.current.hasCheckedStatus).toBe(false);
    await act(async () => {
      await second.result.current.checkStatus();
    });
    expect(mocks.sign).toHaveBeenCalledOnce();
    expect(second.result.current.outcomeUnknown).toBe(false);
    expect(second.result.current.request?.state).toBe("pending");
  });

  it("does not reuse authorization after logout removes the private query", async () => {
    const first = renderHook(() => useGardenJoinRequests(GARDEN_A));
    await act(async () => {
      await first.result.current.checkStatus();
    });
    first.unmount();
    // Real QueryCache removal with the namespace rule used by Auth.signOut.
    testClient.removeQueries({ predicate: ({ queryKey }) => queryKey[0] !== "greengoods" });
    const second = renderHook(() => useGardenJoinRequests(GARDEN_A));
    expect(second.result.current.request).toBeNull();
    await act(async () => {
      await second.result.current.checkStatus();
    });
    expect(mocks.sign).toHaveBeenCalledTimes(2);
  });

  it("ignores a read held across logout and same-account login", async () => {
    const pending = deferred<GardenJoinRequestSelfResponse>();
    mocks.mine.mockReturnValueOnce(pending.promise);
    const first = renderHook(() => useGardenJoinRequests(GARDEN_A));
    let response!: Promise<unknown>;
    act(() => {
      response = first.result.current.checkStatus();
    });
    await waitFor(() => expect(mocks.mine).toHaveBeenCalledOnce());
    first.unmount();
    testClient.removeQueries({ predicate: ({ queryKey }) => queryKey[0] !== "greengoods" });
    const second = renderHook(() => useGardenJoinRequests(GARDEN_A));
    pending.resolve(selfResponse);
    await act(async () => {
      expect(await response).toBeNull();
    });
    expect(second.result.current.request).toBeNull();
    expect(second.result.current.canRefreshStatus).toBe(false);
  });

  it("does not dispatch a late signature after account A changes to B and back", async () => {
    const pending = deferred<`0x${string}`>();
    mocks.sign.mockReturnValueOnce(pending.promise);
    const { result, rerender } = renderHook(() => useGardenJoinRequests(GARDEN_A));
    let sending!: Promise<unknown>;
    act(() => {
      sending = result.current.submitRequest({
        displayName: "Maya",
        requestedVia: "garden_detail",
      });
    });
    await waitFor(() => expect(mocks.sign).toHaveBeenCalledOnce());
    mocks.accountAddress = "0x4444444444444444444444444444444444444444";
    rerender();
    mocks.accountAddress = "0x2222222222222222222222222222222222222222";
    rerender();
    pending.resolve("0x1234");
    await act(async () => {
      expect(await sending).toBeNull();
    });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(result.current.canRefreshStatus).toBe(false);
  });

  it("requests fresh status authorization after expiry and rejects an expired signing result", async () => {
    let clock = Date.now();
    const now = vi.spyOn(Date, "now").mockImplementation(() => clock);
    try {
      const { result } = renderHook(() => useGardenJoinRequests(GARDEN_A));
      await act(async () => {
        await result.current.checkStatus();
      });
      clock += 301_000;
      await act(async () => {
        await result.current.checkStatus();
      });
      expect(mocks.sign).toHaveBeenCalledTimes(2);
      mocks.sign.mockImplementationOnce(async () => {
        clock += 301_000;
        return "0x1234";
      });
      await act(async () => {
        await expect(
          result.current.submitRequest({ displayName: "Maya", requestedVia: "garden_detail" })
        ).rejects.toMatchObject({ errorCode: "signature_expired" });
      });
      expect(mocks.create).not.toHaveBeenCalled();
    } finally {
      now.mockRestore();
    }
  });

  it("keeps private status out of the actual persistence policy and credentials out of query data", async () => {
    const { createShouldDehydrateQuery } = await import("../../config/query-persistence");
    const { result } = renderHook(() => useGardenJoinRequests(GARDEN_A));
    await act(async () => {
      await result.current.checkStatus();
    });
    const query = testClient
      .getQueryCache()
      .getAll()
      .find((q) => q.queryKey[0] === "garden-join-requests")!;
    expect(createShouldDehydrateQuery()(query)).toBe(false);
    expect(JSON.stringify(query.state.data)).not.toContain("signature");
    expect(JSON.stringify(query.state.data)).not.toContain("nonce");
  });

  it("does not expose a late status response after the garden changes", async () => {
    const pendingMine = deferred<GardenJoinRequestSelfResponse>();
    mocks.mine.mockReturnValueOnce(pendingMine.promise);
    const { result, rerender } = renderHook(
      ({ gardenAddress }) => useGardenJoinRequests(gardenAddress),
      { initialProps: { gardenAddress: GARDEN_A as Address } }
    );

    let statusPromise!: Promise<unknown>;
    act(() => {
      statusPromise = result.current.checkStatus();
    });
    await waitFor(() => expect(mocks.mine).toHaveBeenCalledOnce());

    rerender({ gardenAddress: GARDEN_B });
    pendingMine.resolve(selfResponse);
    await act(async () => {
      await statusPromise;
    });

    expect(result.current.request).toBeNull();
    expect(result.current.hasCheckedStatus).toBe(false);
    expect(result.current.statusState).toEqual({ isLoading: false, error: null });
  });

  it("invalidates an earlier absent result after an uncertain send until a signed read reconciles it", async () => {
    mocks.mine.mockResolvedValueOnce({ ok: true, request: null });
    const { result } = renderHook(() => useGardenJoinRequests(GARDEN_A));
    await act(async () => {
      await result.current.checkStatus();
    });
    expect(result.current.hasCheckedStatus).toBe(true);
    mocks.create.mockRejectedValueOnce(
      new GardenJoinRequestTransportError("Lost response", 503, "provider_unavailable", true)
    );
    await act(async () => {
      await expect(
        result.current.submitRequest({ displayName: "Maya", requestedVia: "garden_detail" })
      ).rejects.toMatchObject({ outcomeUnknown: true });
    });
    expect(result.current.hasCheckedStatus).toBe(false);
    mocks.mine.mockRejectedValueOnce(new Error("Temporary status failure"));
    await act(async () => {
      await expect(result.current.checkStatus()).rejects.toThrow();
    });
    expect(result.current.hasCheckedStatus).toBe(false);
    await act(async () => {
      await result.current.checkStatus();
    });
    expect(result.current.request).toEqual(selfResponse.request);
    expect(result.current.hasCheckedStatus).toBe(true);
    expect(mocks.mine).toHaveBeenLastCalledWith(
      GARDEN_A,
      expect.objectContaining({
        action: "create",
        signature: "0x1234",
        readSelf: expect.any(Object),
      })
    );
  });

  it("clears a loaded queue when the signed-in account changes", async () => {
    const { result, rerender } = renderHook(() => useGardenJoinRequests(GARDEN_A));
    await act(async () => {
      await result.current.loadQueue();
    });
    expect(result.current.queue).toHaveLength(1);

    mocks.accountAddress = "0x5555555555555555555555555555555555555555";
    rerender();

    expect(result.current.queue).toEqual([]);
    expect(result.current.nextCursor).toBeUndefined();
  });

  it("does not let an older status read replace a newly submitted request", async () => {
    const pendingMine = deferred<GardenJoinRequestSelfResponse>();
    mocks.mine.mockReturnValueOnce(pendingMine.promise);
    const { result } = renderHook(() => useGardenJoinRequests(GARDEN_A));

    let statusPromise!: Promise<unknown>;
    act(() => {
      statusPromise = result.current.checkStatus();
    });
    await waitFor(() => expect(mocks.mine).toHaveBeenCalledOnce());

    await act(async () => {
      await result.current.submitRequest({ displayName: "Maya", requestedVia: "garden_detail" });
    });
    pendingMine.resolve({ ok: true, request: null });
    await act(async () => {
      await statusPromise;
    });

    expect(result.current.request).toEqual(selfResponse.request);
    expect(result.current.hasCheckedStatus).toBe(true);
  });

  it("waits for an in-flight submission before starting a later status check", async () => {
    const pendingCreate = deferred<GardenJoinRequestSelfResponse>();
    let submissionSettled = false;
    mocks.create.mockReturnValueOnce(pendingCreate.promise);
    mocks.mine.mockImplementationOnce(async () => {
      expect(submissionSettled).toBe(true);
      return selfResponse;
    });
    const { result } = renderHook(() => useGardenJoinRequests(GARDEN_A));

    let submitPromise!: Promise<unknown>;
    let statusPromise!: Promise<unknown>;
    act(() => {
      submitPromise = result.current.submitRequest({
        displayName: "Maya",
        requestedVia: "garden_detail",
      });
    });
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());

    act(() => {
      statusPromise = result.current.checkStatus();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.mine).not.toHaveBeenCalled();

    submissionSettled = true;
    pendingCreate.resolve(selfResponse);
    await act(async () => {
      await Promise.all([submitPromise, statusPromise]);
    });

    expect(mocks.mine).toHaveBeenCalledOnce();
    expect(result.current.request).toEqual(selfResponse.request);
    expect(result.current.hasCheckedStatus).toBe(true);
  });

  it("shares the in-flight write barrier with a remounted status reader", async () => {
    const pendingCreate = deferred<GardenJoinRequestSelfResponse>();
    mocks.create.mockReturnValueOnce(pendingCreate.promise);
    const first = renderHook(() => useGardenJoinRequests(GARDEN_A));
    let submitting!: Promise<unknown>;
    await act(async () => {
      submitting = first.result.current.submitRequest({
        displayName: "Maya",
        requestedVia: "garden_detail",
      });
    });
    first.unmount();
    const second = renderHook(() => useGardenJoinRequests(GARDEN_A));
    let checking!: Promise<unknown>;
    await act(async () => {
      checking = second.result.current.checkStatus();
    });
    expect(mocks.mine).not.toHaveBeenCalled();
    await act(async () => {
      pendingCreate.resolve(selfResponse);
      await Promise.all([submitting, checking]);
    });
    expect(mocks.sign).toHaveBeenCalledOnce();
    expect(second.result.current.request).toEqual(selfResponse.request);
  });

  it("ignores an older empty status response after a newer create succeeds", async () => {
    const pendingRead = deferred<GardenJoinRequestSelfResponse>();
    mocks.mine.mockReturnValueOnce(pendingRead.promise);
    const { result } = renderHook(() => useGardenJoinRequests(GARDEN_A));
    let checking!: Promise<unknown>;
    await act(async () => {
      checking = result.current.checkStatus();
    });
    await act(async () => {
      await result.current.submitRequest({ displayName: "Maya", requestedVia: "garden_detail" });
    });
    await act(async () => {
      pendingRead.resolve({ ok: true, request: null });
      expect(await checking).toBeNull();
    });
    expect(result.current.request).toEqual(selfResponse.request);
  });

  it("clears a superseded status spinner when withdrawing", async () => {
    const { result } = renderHook(() => useGardenJoinRequests(GARDEN_A));
    await act(async () => {
      await result.current.checkStatus();
    });
    const pendingRead = deferred<GardenJoinRequestSelfResponse>();
    mocks.mine.mockReturnValueOnce(pendingRead.promise);
    let checking!: Promise<unknown>;
    await act(async () => {
      checking = result.current.checkStatus();
    });
    expect(result.current.statusState.isLoading).toBe(true);
    await act(async () => {
      await result.current.withdrawRequest();
    });
    await act(async () => {
      pendingRead.resolve(selfResponse);
      await checking;
    });
    expect(result.current.request).toBeNull();
    expect(result.current.statusState.isLoading).toBe(false);
  });

  it("never prompts for a signature during automatic status reconciliation", async () => {
    const { result } = renderHook(() => useGardenJoinRequests(GARDEN_A));
    await act(async () => {
      await result.current.checkStatus({ allowSignature: false });
    });
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(mocks.mine).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.submitRequest({ displayName: "Maya", requestedVia: "garden_detail" });
    });
    const clock = Date.now();
    const now = vi.spyOn(Date, "now").mockReturnValue(clock + 301_000);
    try {
      await act(async () => {
        await result.current.checkStatus({ allowSignature: false });
      });
      expect(mocks.sign).toHaveBeenCalledOnce();
      expect(mocks.mine).not.toHaveBeenCalled();
      expect(result.current.request).toEqual(selfResponse.request);
      expect(result.current.hasCheckedStatus).toBe(true);
    } finally {
      now.mockRestore();
    }
  });

  it("does not wait for a logged-out session's unfinished signature", async () => {
    const signing = deferred<`0x${string}`>();
    mocks.sign.mockReturnValueOnce(signing.promise);
    const first = renderHook(() => useGardenJoinRequests(GARDEN_A));
    let submitting!: Promise<unknown>;
    await act(async () => {
      submitting = first.result.current.submitRequest({
        displayName: "Maya",
        requestedVia: "garden_detail",
      });
    });
    act(() => testClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "greengoods" }));
    first.unmount();
    const second = renderHook(() => useGardenJoinRequests(GARDEN_A));
    let checking!: Promise<unknown>;
    await act(async () => {
      checking = second.result.current.checkStatus();
    });
    try {
      await waitFor(() => expect(mocks.mine).toHaveBeenCalledOnce());
    } finally {
      await act(async () => {
        signing.resolve("0x1234");
        await Promise.all([submitting, checking]);
      });
    }
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("shows and records a failed request, but not a declined signature", async () => {
    const { result } = renderHook(() => useGardenJoinRequests(GARDEN_A));
    const input = { displayName: "Maya", requestedVia: "garden_detail" as const };

    mocks.create.mockRejectedValueOnce(
      new GardenJoinRequestTransportError("unavailable", 503, "provider_unavailable", true)
    );
    await act(async () => {
      await result.current.submitRequest(input).catch(() => undefined);
    });
    expect(result.current.mutationState.error).toBeInstanceOf(GardenJoinRequestTransportError);
    expect(mocks.trackFailed).toHaveBeenCalledWith({
      operation: "create",
      status: 503,
      errorCode: "provider_unavailable",
    });

    mocks.trackFailed.mockClear();
    mocks.create.mockRejectedValueOnce(
      Object.assign(new Error("User rejected the request."), { code: 4001 })
    );
    await act(async () => {
      await result.current.submitRequest(input).catch(() => undefined);
    });
    expect(result.current.mutationState.error).toBeNull();
    expect(mocks.trackFailed).not.toHaveBeenCalled();
  });

  it("binds a withdrawal proof to the loaded request and revision", async () => {
    const { result } = renderHook(() => useGardenJoinRequests(GARDEN_A));
    await act(async () => {
      await result.current.checkStatus();
    });

    await act(async () => {
      await result.current.withdrawRequest();
    });

    expect(mocks.withdraw).toHaveBeenCalledWith(
      GARDEN_A,
      expect.objectContaining({
        action: "withdraw",
        requestId: "request-a",
        expectedRevision: 0,
      })
    );
    expect(result.current.request).toBeNull();
  });
});
