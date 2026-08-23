/** @vitest-environment jsdom */

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePoolCharter } from "../hooks/commitment-pooling/usePoolCharter";
import { renderHookWithProviders } from "./test-utils";

const mocks = vi.hoisted(() => ({ getJsonByHash: vi.fn() }));

vi.mock("../modules/data/ipfs/resolve", () => ({ getJsonByHash: mocks.getJsonByHash }));

describe("usePoolCharter", () => {
  beforeEach(() => {
    mocks.getJsonByHash.mockReset();
  });

  it("reads the purpose behind a charter CID", async () => {
    mocks.getJsonByHash.mockResolvedValue({ version: 1, purpose: "Neighbourly help in Rocinha" });

    const { result } = renderHookWithProviders(() => usePoolCharter("bafy-charter"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.charter).toEqual({ version: 1, purpose: "Neighbourly help in Rocinha" });
    expect(result.current.isUnavailable).toBe(false);
    expect(mocks.getJsonByHash).toHaveBeenCalledWith("bafy-charter");
  });

  it("treats no CID as no charter, without a read", () => {
    const { result } = renderHookWithProviders(() => usePoolCharter(null));

    expect(result.current).toEqual({ charter: null, isLoading: false, isUnavailable: false });
    expect(mocks.getJsonByHash).not.toHaveBeenCalled();
  });

  it("says the words are unavailable when the document cannot be read", async () => {
    mocks.getJsonByHash.mockRejectedValue(new Error("gateway down"));

    const { result } = renderHookWithProviders(() => usePoolCharter("bafy-charter"));

    // The hook retries a failed gateway read once before giving up.
    await waitFor(() => expect(result.current.isUnavailable).toBe(true), { timeout: 4000 });
    expect(result.current.charter).toBeNull();
  });
});
