/**
 * @vitest-environment happy-dom
 */

import { commitmentFixture } from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import type { CommitmentEventRecord } from "@green-goods/shared/commitment-pooling";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingHistoryAnchor } from "../../views/Home/Garden/Commitment/serviceBookingTypes";
import { renderWithProviders, screen } from "../test-utils";

const mocks = vi.hoisted(() => ({ events: [] as CommitmentEventRecord[] }));

vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  useCommitmentActivity: () => ({ events: mocks.events, isError: false }),
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

const step = (id: string, anchor?: BookingHistoryAnchor) => ({
  id,
  text: `Booking: ${id}`,
  state: "done",
  stateLabel: "Done",
  anchor,
});

/** A hub day booked, accepted and reported, its split approved: newest first, as the page reads it. */
const HUB_DAY_STEPS = [
  step("split"),
  step("delivered", "READY_FOR_CONFIRMATION"),
  step("started"),
  step("accepted", "ACCEPTED"),
  step("deposited"),
  step("agreed", "CLAIM_REQUESTED"),
];

function renderHistory(bookingLines = HUB_DAY_STEPS) {
  renderWithProviders(
    <CommitmentHistory
      chainId={42161}
      commitment={commitmentFixture({ commitmentId: 4101n, direction: "OFFER" })}
      viewer={VIEWER}
      bookingLines={bookingLines}
    />
  );
  return screen.getAllByRole("listitem").map((item) => ({
    text: item.querySelector("p")?.textContent ?? "",
    latest: item.getAttribute("data-latest") === "true",
  }));
}

describe("a voucher booking in History", () => {
  beforeEach(() => {
    mocks.events = [
      event("CONFIRMATION_RECORDED", 50),
      event("READY_FOR_CONFIRMATION", 40),
      event("ACCEPTED", 30),
      event("CLAIM_REQUESTED", 10),
      event("CREATED", 0),
    ];
  });

  it("puts a confirmation made while a transfer was on its way above the split, as the latest", () => {
    const lines = renderHistory();
    expect(lines[0]).toEqual({ text: "You confirmed it was kept", latest: true });
    expect(lines.filter((line) => line.latest)).toHaveLength(1);
    expect(lines.map((line) => line.text).slice(1, 4)).toEqual([
      "Booking: split",
      "Booking: delivered",
      "You sent it for confirmation",
    ]);
  });

  it("places each booking step at the promise's own event, or after the step before it", () => {
    const texts = renderHistory().map((line) => line.text);
    const at = (text: string) => texts.indexOf(text);
    // Approval and deposit happened between asking for the hub day and its acceptance.
    expect(at("Booking: deposited")).toBeLessThan(at("Booking: agreed"));
    expect(at("Booking: deposited")).toBeGreaterThan(at("You took this up"));
    expect(at("Booking: started")).toBeLessThan(at("Booking: accepted"));
    expect(at("Booking: started")).toBeGreaterThan(at("You sent it for confirmation"));
    expect(texts.at(-1)).toBe("You offered this");
  });

  it("never dates a step before the step it followed", () => {
    // An older reading of acceptance than of the deposit before it still sorts above the deposit.
    mocks.events = [event("ACCEPTED", 5), event("CLAIM_REQUESTED", 10)];
    const texts = renderHistory([
      step("accepted", "ACCEPTED"),
      step("agreed", "CLAIM_REQUESTED"),
    ]).map((line) => line.text);
    expect(texts.indexOf("Booking: accepted")).toBeLessThan(texts.indexOf("Booking: agreed"));
  });

  it("keeps the promise's events in their own order when there is no booking", () => {
    const lines = renderHistory([]);
    expect(lines[0]).toEqual({ text: "You confirmed it was kept", latest: true });
    expect(lines.at(-1)?.text).toBe("You offered this");
  });
});
