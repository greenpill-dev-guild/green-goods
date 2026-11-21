/**
 * @vitest-environment happy-dom
 */
// TEST-QUALITY: allow-small-test-file - The hook owns three decisions: consent, read and failure.

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const mocks = vi.hoisted(() => ({ query: vi.fn(), published: vi.fn() }));

vi.mock("../../../modules/data/graphql-client", () => ({
  greenGoodsIndexer: { query: (...args: unknown[]) => mocks.query(...args) },
}));
vi.mock("../../../config/default-chain", () => ({ DEFAULT_CHAIN_ID: 42161 }));
vi.mock("../../../config/public-record-visibility", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../config/public-record-visibility")>()),
  isPublicPassportPublished: (...args: unknown[]) => mocks.published(...args),
}));

import { usePublicGardenPassport } from "../../../hooks/public/usePublicGardenPassport";
import type { Address } from "../../../types/domain";

const GARDEN = "0x1111111111111111111111111111111111111111" as Address;

describe("usePublicGardenPassport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockImplementation(async (_document, _variables, operation) =>
      operation === "getPublicPassportPool"
        ? { data: { CommitmentPool: [] } }
        : { data: { [String(operation).replace("getPublicPassport", "")]: [] } }
    );
  });

  it("reads nothing for a garden whose stewards have not agreed to publish", async () => {
    mocks.published.mockReturnValue(false);
    const { result } = renderHookWithQueryClient(() => usePublicGardenPassport(GARDEN));

    expect(result.current).toMatchObject({ published: false, isPending: false, isError: false });
    expect(result.current.passport).toBeUndefined();
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.published).toHaveBeenCalledWith(42161, GARDEN);
  });

  it("reads the passport of a garden that publishes one", async () => {
    mocks.published.mockReturnValue(true);
    const { result } = renderHookWithQueryClient(() => usePublicGardenPassport(GARDEN));

    expect(result.current).toMatchObject({ published: true, isPending: true });
    // The first read loads the deployment records on demand, which a busy machine can take
    // longer than the default second to do.
    await waitFor(() => expect(result.current.passport).toBeDefined(), { timeout: 5000 });
    expect(result.current.passport).toMatchObject({ chainId: 42161, garden: GARDEN, poolId: null });
    expect(result.current.isPending).toBe(false);
  });

  it("reports a passport that could not be read as failed, not as empty", async () => {
    mocks.published.mockReturnValue(true);
    mocks.query.mockResolvedValue({ error: new Error("indexer timeout") });
    const { result } = renderHookWithQueryClient(() => usePublicGardenPassport(GARDEN));

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect(result.current.passport).toBeUndefined();
  });
});
