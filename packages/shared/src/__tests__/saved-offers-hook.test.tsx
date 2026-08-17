/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  type SavedOffersApi,
  useSavedOfferPersistence,
} from "../hooks/commitment-pooling/useSavedOffers";
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
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
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
});
