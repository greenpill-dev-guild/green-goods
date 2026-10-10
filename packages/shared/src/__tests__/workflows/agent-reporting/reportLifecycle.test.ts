import { describe, expect, it } from "vitest";
import {
  advanceLifecycle,
  LifecycleVersionError,
  type PersistedLifecycle,
  startLifecycle,
} from "../../../workflows/agent-reporting/persistence";
import {
  agentReportLifecycle,
  type ReportLifecycleContext,
  type ReportLifecycleEvent,
} from "../../../workflows/agent-reporting/reportLifecycle";
import {
  agentReviewLifecycle,
  type ReviewLifecycleContext,
  type ReviewLifecycleEvent,
} from "../../../workflows/agent-reporting/reviewLifecycle";

type Report = PersistedLifecycle<ReportLifecycleContext>;

function run(
  events: ReportLifecycleEvent[],
  from: Report = startLifecycle(agentReportLifecycle, 1)
) {
  return events.reduce(
    (state, event) => {
      const result = advanceLifecycle(agentReportLifecycle, 1, state.persisted, event);
      return {
        persisted: result.next,
        refused: result.handled ? state.refused : [...state.refused, event.type],
      };
    },
    { persisted: from, refused: [] as string[] }
  );
}

const toSending = (mode: "owner" | "delegated"): ReportLifecycleEvent[] => [
  { type: "READY_FOR_REVIEW", revision: 1 },
  { type: "CONFIRMED", revision: 1 },
  { type: "AUTHORITY_ESTABLISHED", mode },
  { type: "PREPARED" },
  { type: "ATTEMPT_RESERVED" },
];

describe("agent report lifecycle", () => {
  it.each([
    ["owner", "awaitingWallet"],
    ["delegated", "delegatedPreflight"],
  ] as const)("routes a confirmed %s report to %s after preparation", (mode, state) => {
    expect(run(toSending(mode).slice(0, 4)).persisted.value).toBe(state);
  });

  it("returns an edit before reservation to collection and invalidates the confirmation", () => {
    const { persisted } = run([
      ...toSending("owner").slice(0, 4),
      { type: "REVISED", revision: 2 },
    ]);
    expect(persisted).toMatchObject({
      value: "collecting",
      context: { revision: 2, confirmedRevision: null, authorizationMode: null },
    });
  });

  it("freezes the confirmed revision once sending starts", () => {
    const { persisted, refused } = run([
      ...toSending("owner"),
      { type: "REVISED", revision: 2 },
      { type: "CANCEL" },
      { type: "DEFERRED_INPUT", sourceId: "s9" },
    ]);
    expect(refused).toEqual(["REVISED", "CANCEL"]);
    expect(persisted).toMatchObject({
      value: "sending",
      context: { revision: 1, deferredSourceIds: ["s9"] },
    });
  });

  it("needs renewed confirmation after a proven rejection and never retries on its own", () => {
    const { persisted, refused } = run([
      ...toSending("owner"),
      { type: "REJECTED_BEFORE_SEND" },
      { type: "ATTEMPT_RESERVED" },
    ]);
    expect(persisted.value).toBe("review");
    expect(refused).toEqual(["ATTEMPT_RESERVED"]);
  });

  it("publishes only on a verified receipt and reconciles again if the receipt is invalidated", () => {
    const { persisted, refused } = run([
      ...toSending("delegated"),
      { type: "OUTCOME_UNCERTAIN" },
      { type: "REJECTED_BEFORE_SEND" },
      { type: "RECEIPT_VERIFIED" },
      { type: "RECEIPT_INVALIDATED" },
    ]);
    expect(refused).toEqual(["REJECTED_BEFORE_SEND"]);
    expect(persisted.value).toBe("reconciling");
  });

  it("falls back to the grant choice when a delegated grant becomes unavailable", () => {
    const { persisted } = run([
      ...toSending("delegated").slice(0, 4),
      { type: "GRANT_UNAVAILABLE" },
    ]);
    expect(persisted).toMatchObject({ value: "grantChoice", context: { authorizationMode: null } });
  });

  it("refuses a confirmation for a stale revision", () => {
    const { persisted, refused } = run([
      { type: "REVISED", revision: 2 },
      { type: "READY_FOR_REVIEW", revision: 2 },
      { type: "CONFIRMED", revision: 1 },
    ]);
    expect(persisted.value).toBe("review");
    expect(refused).toEqual(["CONFIRMED"]);
  });

  it("pauses a snapshot written by another machine version instead of guessing", () => {
    const persisted = {
      ...startLifecycle<ReportLifecycleContext>(agentReportLifecycle, 1),
      version: 2,
    };
    expect(() => advanceLifecycle(agentReportLifecycle, 1, persisted, { type: "CANCEL" })).toThrow(
      LifecycleVersionError
    );
  });
});

describe("agent review lifecycle", () => {
  const review = (events: ReviewLifecycleEvent[]) =>
    events.reduce(
      (persisted, event) => advanceLifecycle(agentReviewLifecycle, 1, persisted, event).next,
      startLifecycle<ReviewLifecycleContext>(agentReviewLifecycle, 1)
    );

  it("records a decision only after a verified receipt and lets a definitive failure be reconfirmed", () => {
    const base: ReviewLifecycleEvent[] = [
      { type: "READY_FOR_REVIEW", revision: 1 },
      { type: "CONFIRMED", revision: 1 },
      { type: "AUTHORITY_ESTABLISHED", mode: "owner" },
      { type: "ATTEMPT_RESERVED" },
      { type: "BROADCAST" },
    ];
    expect(review([...base, { type: "RECEIPT_VERIFIED" }]).value).toBe("recorded");
    expect(
      review([...base, { type: "DEFINITIVE_FAILURE" }, { type: "REVISED", revision: 2 }]).value
    ).toBe("discussing");
  });
});
