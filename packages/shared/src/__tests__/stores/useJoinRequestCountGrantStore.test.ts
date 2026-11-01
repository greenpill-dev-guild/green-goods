/**
 * Count grant store tests: one grant per garden, chain and account, saved under its own key,
 * brought back after a reload without the lapsed or malformed ones, and gone once refused or at
 * sign-out.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../../modules/app/logger";
import {
  JOIN_REQUEST_COUNT_GRANTS_STORAGE_KEY,
  joinRequestCountGrantScope,
  useJoinRequestCountGrantStore,
} from "../../stores/useJoinRequestCountGrantStore";

const SCOPE = joinRequestCountGrantScope(42161, "0xA11CE00000000000000000000000000000000001")!;
const GARDEN_A = "0xA000000000000000000000000000000000000001";
const GARDEN_B = "0xB000000000000000000000000000000000000002";
const A = GARDEN_A.toLowerCase();
const B = GARDEN_B.toLowerCase();
const LATER = Math.floor(Date.now() / 1000) + 86_400;
const grant = (token: string) => ({ token, expiresAt: LATER });

const state = () => useJoinRequestCountGrantStore.getState();

beforeEach(() => {
  localStorage.clear();
  useJoinRequestCountGrantStore.setState({ grantsByScope: {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useJoinRequestCountGrantStore", () => {
  it("scopes grants to one chain and one account, and needs an account", () => {
    expect(SCOPE).toBe("42161:0xa11ce00000000000000000000000000000000001");
    expect(joinRequestCountGrantScope(42161, null)).toBeNull();
  });

  it("keeps one grant per garden, the newest replacing the last", () => {
    state().keepGrant(SCOPE, GARDEN_A, grant("first"));
    state().keepGrant(SCOPE, GARDEN_B, grant("other"));
    state().keepGrant(SCOPE, GARDEN_A, grant("second"));

    expect(state().grantsByScope[SCOPE]).toEqual({ [A]: grant("second"), [B]: grant("other") });
    expect(localStorage.getItem(JOIN_REQUEST_COUNT_GRANTS_STORAGE_KEY)).toContain("second");
  });

  it("forgets a refused grant, but not a newer one that has replaced it", () => {
    state().keepGrant(SCOPE, GARDEN_A, grant("newer"));

    state().forgetGrant(SCOPE, GARDEN_A, "older");
    expect(state().grantsByScope[SCOPE]?.[A]).toEqual(grant("newer"));

    state().forgetGrant(SCOPE, GARDEN_A, "newer");
    expect(state().grantsByScope).toEqual({});
  });

  it("clears every grant from memory and from the device", () => {
    state().keepGrant(SCOPE, GARDEN_A, grant("first"));

    state().clearAll();

    expect(state().grantsByScope).toEqual({});
    expect(localStorage.getItem(JOIN_REQUEST_COUNT_GRANTS_STORAGE_KEY)).not.toContain("first");
  });

  it("clears a grant another tab saved, even when this tab holds none", () => {
    localStorage.setItem(
      JOIN_REQUEST_COUNT_GRANTS_STORAGE_KEY,
      JSON.stringify({ state: { grantsByScope: { [SCOPE]: { [A]: grant("other-tab") } } } })
    );

    state().clearAll();

    expect(localStorage.getItem(JOIN_REQUEST_COUNT_GRANTS_STORAGE_KEY)).not.toContain("other-tab");
  });

  it("keeps the grant for this session when storage refuses it, and says so", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const refuse = () => {
      throw new DOMException("Storage is blocked.", "SecurityError");
    };
    vi.stubGlobal("localStorage", { getItem: refuse, setItem: refuse, removeItem: refuse });

    await useJoinRequestCountGrantStore.persist.rehydrate();
    state().keepGrant(SCOPE, GARDEN_A, grant("first"));
    useJoinRequestCountGrantStore.persist.clearStorage();

    expect(state().grantsByScope[SCOPE]?.[A]).toEqual(grant("first"));
    for (const message of [
      "Could not read the join-request count grants",
      "Could not save the join-request count grant",
      "Could not remove the join-request count grants",
    ]) {
      expect(warn).toHaveBeenCalledWith(
        message,
        expect.objectContaining({ source: "useJoinRequestCountGrantStore" })
      );
    }
  });

  it("brings back only usable grants after a reload", async () => {
    localStorage.setItem(
      JOIN_REQUEST_COUNT_GRANTS_STORAGE_KEY,
      JSON.stringify({
        state: {
          grantsByScope: {
            [SCOPE]: {
              [GARDEN_A]: grant("usable"),
              [B]: { token: "lapsed", expiresAt: 1 },
              "0xc": { token: 7, expiresAt: LATER },
              "0xd": null,
            },
            "1:0xempty": { "0xe": { expiresAt: LATER } },
          },
        },
        version: 0,
      })
    );

    await useJoinRequestCountGrantStore.persist.rehydrate();

    expect(state().grantsByScope).toEqual({ [SCOPE]: { [A]: grant("usable") } });
  });
});
