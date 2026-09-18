/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from "vitest";
import {
  describeQuietReport,
  holdUpdateHandover,
  joinUpdateHandover,
} from "../../../modules/app/update-handover";

describe("describeQuietReport", () => {
  it("flattens the old worker's report and names what it still owed", () => {
    expect(
      describeQuietReport({
        trackedWork: 2,
        cancelledFetches: 3,
        pendingResponses: { image: 1, asset: 2 },
      })
    ).toEqual({
      old_worker_tracked_work: 2,
      old_worker_cancelled_fetches: 3,
      old_worker_pending_responses: "image:1,asset:2",
    });
    expect(
      describeQuietReport({ trackedWork: 0, cancelledFetches: 0, pendingResponses: {} })
    ).toMatchObject({ old_worker_pending_responses: "none" });
  });

  it("adds nothing for a worker that sent no report", () => {
    expect(describeQuietReport(undefined)).toEqual({});
  });
});

describe("update hand-over participants", () => {
  it("holds every participant for a hand-over and releases them once", () => {
    const first = { hold: vi.fn(), release: vi.fn() };
    const second = { hold: vi.fn(), release: vi.fn() };
    const leaveFirst = joinUpdateHandover(first);
    const leaveSecond = joinUpdateHandover(second);
    try {
      expect(first.hold).not.toHaveBeenCalled();

      const release = holdUpdateHandover();
      expect(first.hold).toHaveBeenCalledOnce();
      expect(second.hold).toHaveBeenCalledOnce();

      release();
      release();
      expect(first.release).toHaveBeenCalledOnce();
      expect(second.release).toHaveBeenCalledOnce();
    } finally {
      leaveFirst();
      leaveSecond();
    }
  });

  it("holds a participant that joins mid-hand-over and skips one that has left", () => {
    const early = { hold: vi.fn(), release: vi.fn() };
    const late = { hold: vi.fn(), release: vi.fn() };
    const leaveEarly = joinUpdateHandover(early);
    const release = holdUpdateHandover();
    const leaveLate = joinUpdateHandover(late);
    try {
      expect(late.hold).toHaveBeenCalledOnce();
      leaveEarly();
      release();
      expect(early.release).not.toHaveBeenCalled();
      expect(late.release).toHaveBeenCalledOnce();
    } finally {
      leaveLate();
    }
  });

  it("keeps participants held until the last overlapping hand-over lets go", () => {
    const participant = { hold: vi.fn(), release: vi.fn() };
    const leave = joinUpdateHandover(participant);
    try {
      const releaseFirst = holdUpdateHandover();
      const releaseSecond = holdUpdateHandover();
      releaseFirst();
      expect(participant.release).not.toHaveBeenCalled();
      releaseSecond();
      expect(participant.release).toHaveBeenCalledOnce();
    } finally {
      leave();
    }
  });
});
