/** @vitest-environment jsdom */

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePoolCharter } from "../hooks/commitment-pooling/usePoolCharter";
import type { CommitmentDocumentStore } from "../modules/commitment-pooling/document-store";
import { renderHookWithProviders } from "./test-utils";

const readJson = vi.fn();
const documents: CommitmentDocumentStore = { pinJson: vi.fn(), readJson };

describe("usePoolCharter", () => {
  beforeEach(() => {
    readJson.mockReset();
  });

  it("reads the purpose behind a charter CID", async () => {
    readJson.mockResolvedValue({ version: 1, purpose: "Neighbourly help in Rocinha" });

    const { result } = renderHookWithProviders(() => usePoolCharter("bafy-charter", { documents }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.charter).toEqual({ version: 1, purpose: "Neighbourly help in Rocinha" });
    expect(result.current.isUnavailable).toBe(false);
    expect(readJson).toHaveBeenCalledWith("bafy-charter");
  });

  it("treats no CID as no charter, without a read", () => {
    const { result } = renderHookWithProviders(() => usePoolCharter(null, { documents }));

    expect(result.current).toEqual({ charter: null, isLoading: false, isUnavailable: false });
    expect(readJson).not.toHaveBeenCalled();
  });

  it("says the words are unavailable when the document cannot be read", async () => {
    readJson.mockRejectedValue(new Error("gateway down"));

    const { result } = renderHookWithProviders(() => usePoolCharter("bafy-charter", { documents }));

    // The hook retries a failed gateway read once before giving up.
    await waitFor(() => expect(result.current.isUnavailable).toBe(true), { timeout: 4000 });
    expect(result.current.charter).toBeNull();
  });
});
