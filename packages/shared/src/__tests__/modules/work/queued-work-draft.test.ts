/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import {
  buildQueuedWorkDraft,
  resolveQueuedWorkTitle,
} from "../../../modules/work/queued-work-draft";
import type { Action, Address } from "../../../types/domain";
import type { Job, WorkJobPayload } from "../../../types/job-queue";

const GARDEN = "0x2222222222222222222222222222222222222222" as Address;
const USER = "0x1111111111111111111111111111111111111111" as Address;

function workJob(payload: Partial<WorkJobPayload> = {}): Job<WorkJobPayload> {
  return {
    id: "job-1",
    kind: "work",
    payload: { actionUID: 7, gardenAddress: GARDEN, feedback: "Weeded the beds", ...payload },
    createdAt: 1,
    attempts: 0,
    synced: false,
    userAddress: USER,
  };
}

const action = (uid: number, title: string) => ({ id: `11155111-${uid}`, title }) as Action;

describe("the draft a queued work job becomes", () => {
  it("separates voice notes from photos and fills the optional fields the same way every time", () => {
    const photo = new File(["p"], "p.jpg", { type: "image/jpeg" });
    const note = new File(["a"], "a.webm", { type: "audio/webm" });
    const { payload } = workJob({ tags: ["soil"], timeSpentMinutes: 45 });

    expect(buildQueuedWorkDraft(payload, [photo, note], "Weeding")).toEqual({
      actionUID: 7,
      title: "Weeding",
      feedback: "Weeded the beds",
      media: [photo],
      details: {},
      location: undefined,
      timeSpentMinutes: 45,
      tags: ["soil"],
      audioNotes: [note],
    });
    expect(buildQueuedWorkDraft(workJob().payload, [], "Weeding")).toEqual({
      actionUID: 7,
      title: "Weeding",
      feedback: "Weeded the beds",
      media: [],
      details: {},
      location: undefined,
      timeSpentMinutes: 0,
    });
  });
});

describe("resolving a queued job's title", () => {
  it("keeps a title the job already has without reading the actions", async () => {
    const loadActions = vi.fn();
    const persist = vi.fn();

    await expect(
      resolveQueuedWorkTitle(workJob({ title: "Weeding" }), 11155111, { loadActions, persist })
    ).resolves.toBe("Weeding");
    expect(loadActions).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it("finds the action's title for an untitled job and keeps it on the job", async () => {
    const job = workJob();
    const persist = vi.fn().mockResolvedValue(undefined);
    const loadActions = vi.fn().mockResolvedValue([action(3, "Composting"), action(7, "Weeding")]);

    await expect(resolveQueuedWorkTitle(job, 11155111, { loadActions, persist })).resolves.toBe(
      "Weeding"
    );
    expect(loadActions).toHaveBeenCalledWith(11155111);
    expect(job.payload.title).toBe("Weeding");
    expect(persist).toHaveBeenCalledWith(job);
  });

  it("replaces a placeholder an older build stored as the title", async () => {
    for (const placeholder of ["Action 7", "Unknown Action"]) {
      const job = workJob({ title: placeholder });
      const loadActions = vi.fn().mockResolvedValue([action(7, "Weeding")]);

      await expect(
        resolveQueuedWorkTitle(job, 11155111, { loadActions, persist: vi.fn() })
      ).resolves.toBe("Weeding");
      expect(job.payload.title).toBe("Weeding");
    }
  });

  it("sends with the fallback, and stores nothing, when the action cannot be found", async () => {
    const job = workJob();
    const persist = vi.fn();

    await expect(
      resolveQueuedWorkTitle(job, 11155111, {
        loadActions: vi.fn().mockResolvedValue([action(3, "Composting")]),
        persist,
      })
    ).resolves.toBe("Action 7");
    await expect(
      resolveQueuedWorkTitle(job, 11155111, {
        loadActions: vi.fn().mockRejectedValue(new Error("indexer unavailable")),
        persist,
      })
    ).resolves.toBe("Action 7");
    expect(job.payload.title).toBeUndefined();
    expect(persist).not.toHaveBeenCalled();
  });
});
