/**
 * @vitest-environment happy-dom
 */

import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";
import { useJoinRequestsWaiting } from "../../../hooks/admin-ui/community/useJoinRequestsWaiting";
import { useGardenStateStore } from "../../../stores/useGardenStateStore";
import {
  joinRequestCountGrantScope,
  useJoinRequestCountGrantStore,
} from "../../../stores/useJoinRequestCountGrantStore";

const GARDEN = "0x1111111111111111111111111111111111111111";
const OTHER_GARDEN = "0x2222222222222222222222222222222222222222";
const CHAIN_ID = 42161;
const ACCOUNT = "0x3333333333333333333333333333333333333333";
const SCOPE = joinRequestCountGrantScope(CHAIN_ID, ACCOUNT)!;
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

function renderWaiting(gardenKey = GARDEN) {
  return renderHookWithQueryClient(() => useJoinRequestsWaiting(gardenKey));
}

describe("useJoinRequestsWaiting", () => {
  beforeEach(() => {
    useGardenStateStore.setState({ gardenStates: {} });
    useJoinRequestCountGrantStore.setState({ grantsByScope: {} });
    sessionStorage.clear();
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("counts nothing before a check of the queue, and reads nothing without a grant", () => {
    const { result } = renderWaiting();
    expect(result.current.joinRequestsWaiting).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("adds what each queue's last check found, and follows answered requests", () => {
    const { result } = renderWaiting();

    act(() => result.current.noteJoinRequestsRead("garden_membership", 2));
    act(() => result.current.noteJoinRequestsRead("steward_access", 1));
    expect(result.current.joinRequestsWaiting).toBe(3);

    act(() => result.current.noteJoinRequestsRead("garden_membership", 1));
    expect(result.current.joinRequestsWaiting).toBe(2);
  });

  it("keeps the count through a remount of the view, and apart from another garden", () => {
    const first = renderWaiting();
    act(() => first.result.current.noteJoinRequestsRead("garden_membership", 2));
    first.unmount();

    // Community remounts between some of its tabs; the number has to outlast that.
    expect(renderWaiting().result.current.joinRequestsWaiting).toBe(2);
    expect(renderWaiting(OTHER_GARDEN).result.current.joinRequestsWaiting).toBe(0);
  });

  it("clears with the garden state when a different account signs in", () => {
    const { result } = renderWaiting();
    act(() => result.current.noteJoinRequestsRead("steward_access", 4));

    // useIdentityChangeReset clears the whole store on an account change.
    act(() => useGardenStateStore.getState().clearAll());

    expect(result.current.joinRequestsWaiting).toBe(0);
  });

  it("shows the service's number on arrival from a stored grant, for that garden only", async () => {
    useJoinRequestCountGrantStore.getState().keepGrant(SCOPE, GARDEN, GRANT);
    answers(200, { ok: true, waiting: 5 });

    const { result } = renderWaiting();
    await waitFor(() => expect(result.current.joinRequestsWaiting).toBe(5));

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(`/public/gardens/${GARDEN}/join-requests/count`);
    expect(new Headers(init?.headers).get("Authorization")).toBe("GG-JoinCount grant.token");

    fetchMock.mockClear();
    expect(renderWaiting(OTHER_GARDEN).result.current.joinRequestsWaiting).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads again when a signed check keeps a grant and when requests are answered", async () => {
    answers(200, { ok: true, waiting: 3 });
    const { result } = renderWaiting();
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => result.current.keepJoinRequestCountGrant(GRANT));
    await waitFor(() => expect(result.current.joinRequestsWaiting).toBe(3));

    answers(200, { ok: true, waiting: 2 });
    act(() => result.current.noteJoinRequestsRead("garden_membership", 2));
    await waitFor(() => expect(result.current.joinRequestsWaiting).toBe(2));
  });

  it("drops a grant from a read that outlived the session, and keeps the next one", async () => {
    answers(200, { ok: true, waiting: 3 });
    const { result } = renderWaiting();
    const fromTheReadBeforeSignOut = result.current.keepJoinRequestCountGrant;

    act(() => useJoinRequestCountGrantStore.getState().clearAll());
    act(() => fromTheReadBeforeSignOut(GRANT));

    expect(useJoinRequestCountGrantStore.getState().grantsByScope).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => result.current.keepJoinRequestCountGrant(GRANT));
    await waitFor(() => expect(result.current.joinRequestsWaiting).toBe(3));
  });

  it.each([
    [401, "signature_invalid"],
    [403, "garden_role_required"],
  ])("forgets a grant the service refuses with %i", async (status, errorCode) => {
    useJoinRequestCountGrantStore.getState().keepGrant(SCOPE, GARDEN, GRANT);
    answers(status, { ok: false, errorCode, message: "refused" });

    const { result } = renderWaiting();
    await waitFor(() => expect(useJoinRequestCountGrantStore.getState().grantsByScope).toEqual({}));
    expect(result.current.joinRequestsWaiting).toBe(0);
  });

  it("keeps the grant and the last check through an outage", async () => {
    useJoinRequestCountGrantStore.getState().keepGrant(SCOPE, GARDEN, GRANT);
    answers(503, { ok: false, errorCode: "provider_unavailable", message: "down" });

    const { result } = renderWaiting();
    act(() => result.current.noteJoinRequestsRead("garden_membership", 2));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(result.current.joinRequestsWaiting).toBe(2);
    expect(useJoinRequestCountGrantStore.getState().grantsByScope[SCOPE]?.[GARDEN]).toEqual(GRANT);
  });
});
