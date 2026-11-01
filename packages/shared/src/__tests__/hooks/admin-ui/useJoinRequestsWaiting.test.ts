/**
 * @vitest-environment happy-dom
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useJoinRequestsWaiting } from "../../../hooks/admin-ui/community/useJoinRequestsWaiting";
import { useGardenStateStore } from "../../../stores/useGardenStateStore";

const GARDEN = "0x1111111111111111111111111111111111111111";
const OTHER_GARDEN = "0x2222222222222222222222222222222222222222";

describe("useJoinRequestsWaiting", () => {
  beforeEach(() => {
    useGardenStateStore.setState({ gardenStates: {} });
    sessionStorage.clear();
  });

  it("counts nothing before a check of the queue", () => {
    const { result } = renderHook(() => useJoinRequestsWaiting(GARDEN));
    expect(result.current.joinRequestsWaiting).toBe(0);
  });

  it("adds what each queue's last check found, and follows answered requests", () => {
    const { result } = renderHook(() => useJoinRequestsWaiting(GARDEN));

    act(() => result.current.noteJoinRequestsRead("garden_membership", 2));
    act(() => result.current.noteJoinRequestsRead("steward_access", 1));
    expect(result.current.joinRequestsWaiting).toBe(3);

    act(() => result.current.noteJoinRequestsRead("garden_membership", 1));
    expect(result.current.joinRequestsWaiting).toBe(2);
  });

  it("keeps the count through a remount of the view, and apart from another garden", () => {
    const first = renderHook(() => useJoinRequestsWaiting(GARDEN));
    act(() => first.result.current.noteJoinRequestsRead("garden_membership", 2));
    first.unmount();

    // Community remounts between some of its tabs; the number has to outlast that.
    expect(
      renderHook(() => useJoinRequestsWaiting(GARDEN)).result.current.joinRequestsWaiting
    ).toBe(2);
    expect(
      renderHook(() => useJoinRequestsWaiting(OTHER_GARDEN)).result.current.joinRequestsWaiting
    ).toBe(0);
  });

  it("clears with the garden state when a different account signs in", () => {
    const { result } = renderHook(() => useJoinRequestsWaiting(GARDEN));
    act(() => result.current.noteJoinRequestsRead("steward_access", 4));

    // useIdentityChangeReset clears the whole store on an account change.
    act(() => useGardenStateStore.getState().clearAll());

    expect(result.current.joinRequestsWaiting).toBe(0);
  });
});
