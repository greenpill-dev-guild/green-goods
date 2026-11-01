/**
 * Count grant store tests: one grant per garden, chain and account, saved under its own key,
 * brought back after a reload without the lapsed or malformed ones, and gone once refused or at
 * sign-out.
 */

import { beforeEach, describe, expect, it } from "vitest";
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
