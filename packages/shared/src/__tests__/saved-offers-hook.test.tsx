/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  type SavedOffersApi,
  useSavedOffer,
  useSavedOffers,
  useSavedOfferPersistence,
} from "../hooks/commitment-pooling/useSavedOffers";
import { queryKeys } from "../config/query-keys";
import type { SavedOfferPayloadV1, SavedOfferRecord } from "../public-contracts/saved-offers";

const payload: SavedOfferPayloadV1 = {
  schemaVersion: 1,
  savedOfferId: "0191f2a0-1d5e-7c41-8f45-5ee9120ec012",
  title: "Rain garden",
  description: "Build one rain garden.",
  commitmentKind: "DomainImpact",
  unitLabel: "gardens",
  targetUnits: "1",
  claimMode: "ApprovalGated",
  domainTags: [],
  requirements: [],
  seriesLinks: [],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function savedOfferRecord(overrides: Partial<SavedOfferRecord> = {}): SavedOfferRecord {
  return {
    savedOfferId: payload.savedOfferId,
    payload,
    version: 1,
    updatedAt: "2026-08-16T00:00:00.000Z",
    ...overrides,
  };
}

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

function createApi(overrides: Partial<SavedOffersApi> = {}): SavedOffersApi {
  return {
    list: vi.fn(async () => []),
    get: vi.fn(async () => savedOfferRecord()),
    put: vi.fn(async () => savedOfferRecord()),
    delete: vi.fn(async () => 2),
    ...overrides,
  };
}

describe("saved offer query hooks", () => {
  it("keeps remote reads disabled until an API and record identity are available", async () => {
    const { wrapper } = createHarness();
    const list = renderHook(() => useSavedOffers({ chainId: 42161 }), { wrapper });
    const record = renderHook(
      () => useSavedOffer({ chainId: 42161, savedOfferId: "", api: createApi() }),
      { wrapper }
    );

    await waitFor(() => expect(list.result.current.fetchStatus).toBe("idle"));
    await waitFor(() => expect(record.result.current.fetchStatus).toBe("idle"));
    expect(list.result.current.records).toEqual([]);
  });

  it("returns listed records and an individual Saved Offer through canonical query keys", async () => {
    const expected = savedOfferRecord();
    const api = createApi({
      list: vi.fn(async () => [expected]),
      get: vi.fn(async () => expected),
    });
    const { queryClient, wrapper } = createHarness();
    const list = renderHook(() => useSavedOffers({ chainId: 42161, api }), { wrapper });
    const record = renderHook(
      () => useSavedOffer({ chainId: 42161, savedOfferId: payload.savedOfferId, api }),
      { wrapper }
    );

    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(record.result.current.isSuccess).toBe(true));
    expect(list.result.current.records).toEqual([expected]);
    expect(record.result.current.data).toEqual(expected);
    expect(queryClient.getQueryData(queryKeys.savedOffers.list(42161))).toEqual([expected]);
    expect(
      queryClient.getQueryData(queryKeys.savedOffers.record(42161, payload.savedOfferId))
    ).toEqual(expected);
  });

  it("surfaces API read failures", async () => {
    const error = { ok: false, errorCode: "provider_unavailable", message: "offline" } as const;
    const api = createApi({ list: vi.fn(async () => Promise.reject(error)) });
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useSavedOffers({ chainId: 42161, api }), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
    expect(result.current.records).toEqual([]);
  });
});

describe("useSavedOfferPersistence", () => {
  it("does not let an older success overwrite a newer failure state", async () => {
    const first = deferred<SavedOfferRecord>();
    const second = deferred<SavedOfferRecord>();
    const put = vi
      .fn<SavedOffersApi["put"]>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const api: SavedOffersApi = {
      list: vi.fn(async () => []),
      get: vi.fn(),
      put,
      delete: vi.fn(),
    };
    const { wrapper } = createHarness();
    const { result } = renderHook(
      () => useSavedOfferPersistence({ chainId: 42161, api, isOnline: () => true }),
      { wrapper }
    );

    let older!: Promise<SavedOfferRecord>;
    let newer!: Promise<SavedOfferRecord>;
    act(() => {
      older = result.current.saveMutation.mutateAsync({ payload, expectedVersion: 0 });
      newer = result.current.saveMutation.mutateAsync({
        payload: { ...payload, title: "Newer title" },
        expectedVersion: 0,
      });
    });
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));

    await act(async () => {
      second.reject({ ok: false, errorCode: "version_conflict", message: "conflict" });
      await expect(newer).rejects.toMatchObject({ errorCode: "version_conflict" });
    });
    expect(result.current.state).toBe("VERSION_CONFLICT");

    await act(async () => {
      first.resolve({
        savedOfferId: payload.savedOfferId,
        payload,
        version: 1,
        updatedAt: "2026-08-16T00:00:00.000Z",
      });
      await older;
    });
    expect(result.current.state).toBe("VERSION_CONFLICT");
  });

  it("keeps offline saves local without calling the remote API", async () => {
    const api = createApi();
    const { wrapper } = createHarness();
    const { result } = renderHook(
      () => useSavedOfferPersistence({ chainId: 42161, api, isOnline: () => false }),
      { wrapper }
    );

    await act(async () => {
      await expect(
        result.current.saveMutation.mutateAsync({ payload, expectedVersion: 0 })
      ).rejects.toMatchObject({ errorCode: "provider_unavailable" });
    });
    expect(result.current.state).toBe("OFFLINE_LOCAL");
    expect(api.put).not.toHaveBeenCalled();
  });

  it("marks a configured-online save as failed when no provider exists", async () => {
    const { wrapper } = createHarness();
    const { result } = renderHook(
      () => useSavedOfferPersistence({ chainId: 42161, isOnline: () => true }),
      { wrapper }
    );

    await act(async () => {
      await expect(
        result.current.saveMutation.mutateAsync({ payload, expectedVersion: 0 })
      ).rejects.toMatchObject({ errorCode: "provider_unavailable" });
    });
    expect(result.current.state).toBe("SAVE_FAILED");
  });

  it("records confirmed saves and removes confirmed deletes from the query cache", async () => {
    const record = savedOfferRecord();
    const api = createApi({
      put: vi.fn(async () => record),
      delete: vi.fn(async () => 2),
    });
    const { queryClient, wrapper } = createHarness();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const { result } = renderHook(
      () => useSavedOfferPersistence({ chainId: 42161, api, isOnline: () => true }),
      { wrapper }
    );

    await act(async () => {
      await result.current.saveMutation.mutateAsync({ payload, expectedVersion: 0 });
    });
    expect(result.current.state).toBe("SAVED_REMOTE");
    expect(
      queryClient.getQueryData(queryKeys.savedOffers.record(42161, payload.savedOfferId))
    ).toEqual(record);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.savedOffers.list(42161) });

    await act(async () => {
      await result.current.deleteMutation.mutateAsync({
        savedOfferId: payload.savedOfferId,
        expectedVersion: 1,
      });
    });
    expect(result.current.state).toBe("LOCAL_DRAFT");
    expect(
      queryClient.getQueryData(queryKeys.savedOffers.record(42161, payload.savedOfferId))
    ).toBeUndefined();
  });

  it("surfaces version conflicts as a distinct persistence state", async () => {
    const api = createApi({
      put: vi.fn(async () =>
        Promise.reject({
          ok: false,
          errorCode: "version_conflict",
          message: "stale version",
          currentVersion: 2,
        })
      ),
    });
    const { wrapper } = createHarness();
    const { result } = renderHook(
      () => useSavedOfferPersistence({ chainId: 42161, api, isOnline: () => true }),
      { wrapper }
    );

    await act(async () => {
      await expect(
        result.current.saveMutation.mutateAsync({ payload, expectedVersion: 1 })
      ).rejects.toMatchObject({ errorCode: "version_conflict", currentVersion: 2 });
    });
    expect(result.current.state).toBe("VERSION_CONFLICT");
  });

  it.each([
    {
      name: "offline",
      api: createApi(),
      isOnline: (): boolean => false,
      expectedState: "OFFLINE_LOCAL" as const,
    },
    {
      name: "missing provider",
      api: undefined,
      isOnline: (): boolean => true,
      expectedState: "SAVE_FAILED" as const,
    },
  ])("fails closed when deleting with an $name boundary", async (testCase) => {
    const { wrapper } = createHarness();
    const { result } = renderHook(
      () =>
        useSavedOfferPersistence({
          chainId: 42161,
          api: testCase.api,
          isOnline: testCase.isOnline,
        }),
      { wrapper }
    );

    await act(async () => {
      await expect(
        result.current.deleteMutation.mutateAsync({
          savedOfferId: payload.savedOfferId,
          expectedVersion: 1,
        })
      ).rejects.toMatchObject({ errorCode: "provider_unavailable" });
    });
    expect(result.current.state).toBe(testCase.expectedState);
    if (testCase.api) expect(testCase.api.delete).not.toHaveBeenCalled();
  });

  it("preserves a delete version conflict and the default navigator online boundary", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    const api = createApi({
      delete: vi.fn(async () =>
        Promise.reject({
          ok: false,
          errorCode: "version_conflict",
          message: "stale version",
          currentVersion: 4,
        })
      ),
    });
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useSavedOfferPersistence({ chainId: 42161, api }), {
      wrapper,
    });

    await act(async () => {
      await expect(
        result.current.deleteMutation.mutateAsync({
          savedOfferId: payload.savedOfferId,
          expectedVersion: 3,
        })
      ).rejects.toMatchObject({ errorCode: "version_conflict", currentVersion: 4 });
    });
    expect(result.current.state).toBe("VERSION_CONFLICT");
  });

  it("does not let an in-flight remote result override a newer local edit", async () => {
    const pending = deferred<SavedOfferRecord>();
    const api = createApi({ put: vi.fn(() => pending.promise) });
    const { wrapper } = createHarness();
    const { result } = renderHook(
      () => useSavedOfferPersistence({ chainId: 42161, api, isOnline: () => true }),
      { wrapper }
    );

    let save!: Promise<SavedOfferRecord>;
    act(() => {
      save = result.current.saveMutation.mutateAsync({ payload, expectedVersion: 0 });
    });
    await waitFor(() => expect(result.current.state).toBe("SAVING_REMOTE"));
    act(() => result.current.markLocalDraft());
    expect(result.current.state).toBe("LOCAL_DRAFT");

    await act(async () => {
      pending.resolve(savedOfferRecord());
      await save;
    });
    expect(result.current.state).toBe("LOCAL_DRAFT");
  });
});
