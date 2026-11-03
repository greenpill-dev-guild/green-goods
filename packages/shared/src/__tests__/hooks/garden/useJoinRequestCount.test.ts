/**
 * How many join requests wait in a garden, read with the count grant a signed check left in this
 * browser (PRD-1381). Home draws a row and a bell event from it, so what matters is when it reads
 * nothing at all and when its answer stands for "something may be missing". The grant's keeping
 * and the badge's fallback are the admin hook's (admin-ui/useJoinRequestsWaiting.test.ts).
 *
 * @vitest-environment happy-dom
 */

import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useJoinRequestCount } from "../../../hooks/garden/useJoinRequestCount";
import {
  joinRequestCountGrantScope,
  useJoinRequestCountGrantStore,
} from "../../../stores/useJoinRequestCountGrantStore";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const GARDEN = "0x1111111111111111111111111111111111111111";
const SCOPE = joinRequestCountGrantScope(42161, "0x3333333333333333333333333333333333333333")!;
const GRANT = { token: "grant.token", expiresAt: 4_000_000_000 };

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => "0x3333333333333333333333333333333333333333",
}));
vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 42161,
}));

const fetchMock = vi.fn<typeof fetch>();

function answers(status: number, body: unknown) {
  fetchMock.mockImplementation(async () => Response.json(body, { status }));
}

describe("useJoinRequestCount", () => {
  beforeEach(() => {
    useJoinRequestCountGrantStore.setState({ grantsByScope: {} });
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads nothing without a grant, and Try Again sends nothing either", () => {
    answers(200, { ok: true, waiting: 4 });
    const { result } = renderHookWithQueryClient(() => useJoinRequestCount(GARDEN));

    result.current.refetch();

    expect(result.current).toMatchObject({ waiting: undefined, isLoading: false, isError: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads nothing for a reader who may not answer requests, though the browser holds a grant", async () => {
    useJoinRequestCountGrantStore.getState().keepGrant(SCOPE, GARDEN, GRANT);
    answers(200, { ok: true, waiting: 4 });
    const queryClient = createTestQueryClient();
    const steward = renderHookWithQueryClient(() => useJoinRequestCount(GARDEN), { queryClient });
    await waitFor(() => expect(steward.result.current.waiting).toBe(4));

    // The same account on a record that no longer names it: the cached answer stays unsaid.
    const { result } = renderHookWithQueryClient(
      () => useJoinRequestCount(GARDEN, { enabled: false }),
      { queryClient }
    );
    result.current.refetch();

    expect(result.current).toMatchObject({ waiting: undefined, isLoading: false, isError: false });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("says an outage may hide requests, and keeps the grant for the next read", async () => {
    useJoinRequestCountGrantStore.getState().keepGrant(SCOPE, GARDEN, GRANT);
    answers(503, { ok: false, errorCode: "provider_unavailable", message: "down" });

    const { result } = renderHookWithQueryClient(() => useJoinRequestCount(GARDEN));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.waiting).toBeUndefined();
    expect(useJoinRequestCountGrantStore.getState().grantsByScope[SCOPE]?.[GARDEN]).toEqual(GRANT);
  });

  it("forgets a lapsed grant without calling it a failure, so Home shows nothing", async () => {
    useJoinRequestCountGrantStore.getState().keepGrant(SCOPE, GARDEN, GRANT);
    answers(401, { ok: false, errorCode: "signature_invalid", message: "expired" });

    const { result } = renderHookWithQueryClient(() => useJoinRequestCount(GARDEN));

    await waitFor(() => expect(useJoinRequestCountGrantStore.getState().grantsByScope).toEqual({}));
    expect(result.current).toMatchObject({ waiting: undefined, isLoading: false, isError: false });
  });
});
