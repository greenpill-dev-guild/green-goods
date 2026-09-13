import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";
import { openDB } from "idb";
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

describe("complete draft snapshots", () => {
  const account = "0x3333333333333333333333333333333333333333";
  it("restores fields and audio, retains attachment IDs, and persists empty removals", async () => {
    const photo = image("photo.jpg", "bytes");
    const audio = new File(["voice"], "voice.webm", { type: "audio/webm" });
    const first = await draftDB.saveSnapshot(
      account,
      11155111,
      "snapshot",
      { feedback: "first", tags: ["soil"], location: { lat: 1.23456, lng: 2.34567 } },
      [photo],
      [audio]
    );
    const attachments = await draftDB.getImagesForDraft("snapshot");
    expect(attachments.map((entry) => entry.kind)).toEqual(["media", "audio"]);
    await draftDB.saveSnapshot(
      account,
      11155111,
      "snapshot",
      { feedback: "second", tags: [], location: undefined },
      attachments.filter((entry) => entry.kind === "media").map((entry) => entry.file),
      attachments.filter((entry) => entry.kind === "audio").map((entry) => entry.file)
    );
    expect((await draftDB.getImagesForDraft("snapshot")).map((entry) => entry.id)).toEqual(
      attachments.map((entry) => entry.id)
    );
    const next = await draftDB.getDraft("snapshot");
    expect(next).toMatchObject({
      feedback: "second",
      revision: 2,
      clientWorkId: first.clientWorkId,
      tags: [],
    });
    expect(next?.location).toBeUndefined();
    expect(await draftDB.getActiveDraft(account, 11155111)).toBe("snapshot");
    await draftDB.saveSnapshot(
      account,
      11155111,
      "snapshot",
      { feedback: "no attachments" },
      [],
      []
    );
    expect(await draftDB.getImagesForDraft("snapshot")).toEqual([]);
    await draftDB.deleteDraft("snapshot");
    expect(await draftDB.getActiveDraft(account, 11155111)).toBeNull();
  });
  it("does not modify fields or files when a new attachment cannot be read", async () => {
    await draftDB.saveSnapshot(
      account,
      11155111,
      "failure",
      { feedback: "saved" },
      [image("good.jpg", "good")],
      []
    );
    const revoked = image("revoked.jpg", "bad");
    revoked.arrayBuffer = async () => {
      throw new DOMException("revoked", "NotReadableError");
    };
    await expect(
      draftDB.saveSnapshot(account, 11155111, "failure", { feedback: "new" }, [revoked], [])
    ).rejects.toThrow();
    expect((await draftDB.getDraft("failure"))?.feedback).toBe("saved");
    expect((await draftDB.getImagesForDraft("failure"))[0]?.file.name).toBe("good.jpg");
    await draftDB.deleteDraft("failure");
  });
  it("never deletes one of twenty drafts to save another", async () => {
    for (let index = 0; index < 20; index++)
      await draftDB.saveSnapshot(
        account,
        11155111,
        `limit-${index}`,
        { feedback: "saved" },
        [],
        []
      );
    await expect(draftDB.saveSnapshot(account, 11155111, "limit-21", {}, [], [])).rejects.toThrow(
      "draft-limit"
    );
    expect(await draftDB.getDraftCount(account, 11155111)).toBe(20);
    await draftDB.saveSnapshot(account, 11155111, "limit-0", { feedback: "updated" }, [], []);
    for (let index = 0; index < 20; index++) await draftDB.deleteDraft(`limit-${index}`);
  });
  it("cancels stale saves before committing and refuses another account's ID", async () => {
    await expect(
      draftDB.saveSnapshot(account, 11155111, "cancelled", {}, [], [], () => false)
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(await draftDB.getDraft("cancelled")).toBeUndefined();
    await draftDB.saveSnapshot(account, 11155111, "owned", { feedback: "owner" }, [], []);
    await expect(
      draftDB.saveSnapshot(
        "0x4444444444444444444444444444444444444444",
        11155111,
        "owned",
        {},
        [],
        []
      )
    ).rejects.toThrow("draft-owner");
    await draftDB.deleteDraft("owned");
  });
  it("retains unreadable legacy evidence until explicit removal", async () => {
    const owner = "0x1111111111111111111111111111111111111111";
    const id = await draftDB.createDraft(owner, 11155111, { feedback: "keep" });
    const raw = await openDB("green-goods-drafts");
    await raw.put("draft_images", {
      id: "unreadable",
      draftId: id,
      createdAt: 1,
      fileData: { name: "lost.jpg", type: "image/jpeg" },
    });
    const missing: Array<{ id: string; name: string }> = [];
    expect(await draftDB.getImagesForDraft(id, (item) => missing.push(item))).toEqual([]);
    expect(missing).toEqual([expect.objectContaining({ id: "unreadable", name: "lost.jpg" })]);
    await draftDB.saveSnapshot(owner, 11155111, id, { feedback: "edit" }, [], [], () => true, [
      "unreadable",
    ]);
    expect(await raw.get("draft_images", "unreadable")).toBeDefined();
    await draftDB.saveSnapshot(owner, 11155111, id, { feedback: "edit" }, [], []);
    expect(await raw.get("draft_images", "unreadable")).toBeUndefined();
    raw.close();
    await draftDB.deleteDraft(id);
  });
});

it("restores bytes without allocating preview URLs and persists recovery gaps", async () => {
  const owner = "0x7777777777777777777777777777777777777777";
  const id = "preview-recovery-proof";
  const allocate = vi.spyOn(URL, "createObjectURL");
  const missing = [{ id: "lost", name: "lost.jpg", kind: "media" as const, order: 1 }];
  await draftDB.saveSnapshot(
    owner,
    11155111,
    id,
    {},
    [image("first.jpg", "first"), image("last.jpg", "last")],
    [],
    () => true,
    missing
  );
  for (let n = 0; n < 5; n++) expect(await draftDB.getImagesForDraft(id)).toHaveLength(2);
  expect(allocate).not.toHaveBeenCalled();
  const record = await draftDB.getDraft(id);
  expect(record?.missingAttachments).toEqual(missing);
  expect(record?.attachmentCount).toBe(3);
  expect(record?.thumbnail?.attachmentId).toBeTruthy();
  await draftDB.saveSnapshot(owner, 11155111, id, {}, [], [], () => true, []);
  expect((await draftDB.getDraft(id))?.missingAttachments).toEqual([]);
  await draftDB.deleteDraft(id);
  allocate.mockRestore();
});
