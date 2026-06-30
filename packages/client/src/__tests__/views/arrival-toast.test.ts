/**
 * Arrival toast selection tests.
 *
 * Verifies the client mapping from a (shared) arrival kind to its copy + single next action:
 * full coverage of actionable kinds, the correct action per kind, and well-formed i18n ids that
 * match the `app.home.arrival.*` keys added to the shared catalogs.
 */

import { describe, expect, it } from "vitest";

import { ARRIVAL_TOASTS } from "../../views/Home/arrival-toast";

const KINDS = ["queue", "draft", "member", "signedIn"] as const;

describe("ARRIVAL_TOASTS", () => {
  it("covers every actionable arrival kind (none is intentionally excluded)", () => {
    expect(Object.keys(ARRIVAL_TOASTS).sort()).toEqual([...KINDS].sort());
  });

  it("routes each kind to the expected next action", () => {
    expect(ARRIVAL_TOASTS.queue.action).toBe("openWorkDashboardPending");
    expect(ARRIVAL_TOASTS.draft.action).toBe("openWorkDashboardDrafts");
    expect(ARRIVAL_TOASTS.member.action).toBe("startWork");
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
