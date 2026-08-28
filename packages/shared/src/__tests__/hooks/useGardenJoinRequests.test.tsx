import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GardenJoinRequestQueueResponse,
  GardenJoinRequestSelfResponse,
} from "../../public-contracts/join-requests";
import type { Address } from "../../types/domain";

const mocks = vi.hoisted(() => ({
  accountAddress: "0x2222222222222222222222222222222222222222" as Address,
  mine: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
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

vi.mock("../../modules/profile-avatar", () => ({
  createProfileAvatarSigner: () => async () => "0x1234",
  resolveProfileAvatarFactoryArgs: vi.fn(async () => undefined),
}));

vi.mock("../../modules/garden-join-requests", () => ({
  gardenJoinRequestTransport: {
    mine: (...args: unknown[]) => mocks.mine(...args),
    create: (...args: unknown[]) => mocks.create(...args),
    list: (...args: unknown[]) => mocks.list(...args),
  },
}));

import { useGardenJoinRequests } from "../../hooks/garden/useGardenJoinRequests";

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
    mocks.accountAddress = "0x2222222222222222222222222222222222222222";
    mocks.create.mockResolvedValue(selfResponse);
    mocks.list.mockResolvedValue(queueResponse);
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
});
