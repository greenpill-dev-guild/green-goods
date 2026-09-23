// @vitest-environment jsdom
/**
 * Arrival toast selection tests.
 *
 * Verifies the client mapping from a (shared) arrival kind to its copy + single next action:
 * full coverage of actionable kinds, the correct action per kind, and well-formed i18n ids that
 * match the `app.home.arrival.*` keys added to the shared catalogs. Also covers the per-session
 * record of a passed arrival that AppShell writes and Home reads.
 */

import { afterEach, describe, expect, it } from "vitest";

import { ARRIVAL_TOASTS, hasArrivalPassed, markArrivalPassed } from "../../views/Home/arrivalToast";

const KINDS = ["queue", "draft", "review", "stewardClear", "gardener", "signedIn"] as const;

describe("ARRIVAL_TOASTS", () => {
  it("covers every actionable arrival kind (none is intentionally excluded)", () => {
    expect(Object.keys(ARRIVAL_TOASTS).sort()).toEqual([...KINDS].sort());
  });

  it("routes each kind to the expected next action", () => {
    expect(ARRIVAL_TOASTS.queue.action).toBe("openWorkDashboardPending");
    expect(ARRIVAL_TOASTS.draft.action).toBe("openWorkDashboardDrafts");
    expect(ARRIVAL_TOASTS.review.action).toBe("openWorkDashboardNeedsReview");
    expect(ARRIVAL_TOASTS.stewardClear.action).toBe("startWork");
    expect(ARRIVAL_TOASTS.gardener.action).toBe("startWork");
    expect(ARRIVAL_TOASTS.signedIn.action).toBe("openHelp");
  });

  it("uses well-formed app.home.arrival.* ids and a non-alarming status", () => {
    for (const kind of KINDS) {
      const spec = ARRIVAL_TOASTS[kind];
      expect(spec.titleId).toBe(`app.home.arrival.${kind}.title`);
      expect(spec.messageId).toBe(`app.home.arrival.${kind}.message`);
      expect(spec.actionLabelId).toBe(`app.home.arrival.${kind}.action`);
      expect(spec.status).toBe("info");
    }
  });
});

describe("arrival session", () => {
  afterEach(() => sessionStorage.clear());

  it("records a passed arrival for that account only, whatever the address casing", () => {
    // AppShell marks with the checksummed address; Home checks with the lowercased one.
    markArrivalPassed("0xAbCdEf0123456789aBcDeF0123456789AbCdEf01");

    expect(hasArrivalPassed("0xabcdef0123456789abcdef0123456789abcdef01")).toBe(true);
    expect(hasArrivalPassed("0x1111111111111111111111111111111111111111")).toBe(false);
  });
});
