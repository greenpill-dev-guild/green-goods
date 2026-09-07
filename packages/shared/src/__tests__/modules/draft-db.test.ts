import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";
import { draftDB } from "../../modules/job-queue/draft-db";

function image(name: string, contents: string): File {
  return new File([contents], name, { type: "image/jpeg" });
}

describe("modules/job-queue/draft-db", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists action details and time before Review", async () => {
    const draftId = await draftDB.createDraft(
      "0x1111111111111111111111111111111111111111",
      11155111,
      {
        gardenAddress: "0x2222222222222222222222222222222222222222",
        actionUID: 1,
        feedback: "",
        details: { capacity: 10, sessionType: "Workshop" },
        timeSpentMinutes: 90,
        currentStep: "details",
      }
    );

    await expect(draftDB.getDraft(draftId)).resolves.toEqual(
      expect.objectContaining({
        details: { capacity: 10, sessionType: "Workshop" },
        timeSpentMinutes: 90,
        currentStep: "details",
      })
    );

    await draftDB.deleteDraft(draftId);
  });

  it("keeps the previous images when an atomic replacement fails", async () => {
    const draftId = await draftDB.createDraft(
      "0x1111111111111111111111111111111111111111",
      11155111,
      {
        gardenAddress: "0x2222222222222222222222222222222222222222",
        actionUID: 1,
        feedback: "Existing draft",
      }
    );
    await draftDB.setImagesForDraft(draftId, [image("existing.jpg", "existing")]);

    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");

    await expect(
      draftDB.setImagesForDraft(draftId, [
        image("replacement-a.jpg", "replacement-a"),
        image("replacement-b.jpg", "replacement-b"),
      ])
    ).rejects.toBeDefined();

    const remaining = await draftDB.getImagesForDraft(draftId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.file.name).toBe("existing.jpg");

    await draftDB.deleteDraft(draftId);
  });
});
