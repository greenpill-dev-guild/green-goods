/**
 * @vitest-environment happy-dom
 */

import { commitmentFixture } from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import type { CommitmentEventRecord } from "@green-goods/shared/commitment-pooling";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const mocks = vi.hoisted(() => ({
  events: [] as CommitmentEventRecord[],
  reason: { reason: null, isLoading: false, isUnavailable: false } as {
    reason: { version: 1; reason: string } | null;
    isLoading: boolean;
    isUnavailable: boolean;
  },
  reasonCIDs: [] as (string | null | undefined)[],
}));

vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  useCommitmentActivity: () => ({ events: mocks.events, isError: false }),
  useCommitmentReason: (cid: string | null | undefined) => {
    mocks.reasonCIDs.push(cid);
    return mocks.reason;
  },
}));

const { CommitmentHistory } = await import("../../views/Home/Garden/Commitment/CommitmentHistory");

const VIEWER = "0x1111111111111111111111111111111111111111" as const;

/** One of the promise's own events, the reader's, at a minute past 1 October 2026 midnight UTC. */
function event(eventType: string, minute: number): CommitmentEventRecord {
  return {
    id: `${eventType}-${minute}`,
    chainId: 42161,
    poolId: 7n,
    cycleId: null,
    commitmentId: 4101n,
    eventType,
    actor: VIEWER,
    configurationKey: null,
    previousValue: null,
    newValue: null,
    units: null,
    data: null,
    txHash: `0x${minute.toString(16).padStart(64, "0")}`,
    timestamp: Date.UTC(2026, 9, 1) / 1000 + minute * 60,
  };
}

function renderHistory() {
  renderWithProviders(
    <CommitmentHistory
      chainId={42161}
      commitment={commitmentFixture({ commitmentId: 4101n, direction: "OFFER" })}
      viewer={VIEWER}
    />
  );
  return screen.getAllByRole("listitem").map((item) => ({
    text: item.querySelector("p")?.textContent ?? "",
    latest: item.getAttribute("data-latest") === "true",
  }));
}

describe("a promise's History", () => {
  it("lists the promise's events newest first, the newest marked latest", () => {
    mocks.events = [
      event("CONFIRMATION_RECORDED", 50),
      event("READY_FOR_CONFIRMATION", 40),
      event("ACCEPTED", 30),
      event("CLAIM_REQUESTED", 10),
      event("CREATED", 0),
    ];
    const lines = renderHistory();
    expect(lines[0]).toEqual({ text: "You confirmed it was kept", latest: true });
    expect(lines.at(-1)?.text).toBe("You offered this");
  });
});

describe("a withdrawn promise in History", () => {
  const STEWARD = "0x3333333333333333333333333333333333333333" as const;

  function renderWithdrawn() {
    const withdrawn = event("CANCELLED", 20);
    withdrawn.actor = STEWARD;
    mocks.events = [withdrawn, event("CREATED", 0)];
    mocks.reasonCIDs = [];
    renderWithProviders(
      <CommitmentHistory
        chainId={42161}
        commitment={commitmentFixture({
          commitmentId: 4101n,
          direction: "OFFER",
          cancelReasonCID: "bafy-cancel-reason",
        })}
        viewer={VIEWER}
      />
    );
    return screen.getAllByRole("listitem")[0]!;
  }

  // The creator reads why a steward withdrew it, under the line that says so.
  it.each([
    {
      shown: "the steward's reason",
      reason: {
        reason: { version: 1 as const, reason: "Duplicate promise" },
        isLoading: false,
        isUnavailable: false,
      },
      detail: "Reason: Duplicate promise",
    },
    {
      shown: "a quiet note while it loads",
      reason: { reason: null, isLoading: true, isUnavailable: false },
      detail: "Reading the reason…",
    },
    {
      shown: "a quiet note when it can't be read",
      reason: { reason: null, isLoading: false, isUnavailable: true },
      detail: "The reason can't be read right now.",
    },
  ])("shows $shown under the withdrawn line", ({ reason, detail }) => {
    mocks.reason = reason;
    const line = renderWithdrawn();
    const texts = [...line.querySelectorAll("p")].map((p) => p.textContent);
    expect(texts[0]).toMatch(/withdrew it$/);
    expect(texts[1]).toBe(detail);
    expect(mocks.reasonCIDs).toContain("bafy-cancel-reason");
  });

  it("reads no reason for a promise that was never withdrawn", () => {
    mocks.events = [event("CREATED", 0)];
    mocks.reasonCIDs = [];
    mocks.reason = { reason: null, isLoading: false, isUnavailable: false };
    renderWithProviders(
      <CommitmentHistory
        chainId={42161}
        commitment={commitmentFixture({
          commitmentId: 4101n,
          cancelReasonCID: "bafy-cancel-reason",
        })}
        viewer={VIEWER}
      />
    );
    // The hook still runs on every render; it is handed no CID, so it reads nothing.
    expect(mocks.reasonCIDs.length).toBeGreaterThan(0);
    expect(mocks.reasonCIDs.every((cid) => cid === null || cid === undefined)).toBe(true);
  });
});
