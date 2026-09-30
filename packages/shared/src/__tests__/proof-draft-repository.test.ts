import "fake-indexeddb/auto";
import { draftDB } from "../modules/job-queue/draft-db";
import { proofDraftRepository } from "../modules/commitment-pooling/proof-draft-repository";
import { describe, expect, it, vi } from "vitest";
import { createProofDraftRepository } from "../modules/commitment-pooling/proof-draft-repository";
import { useCommitmentProofDraftStore } from "../stores/useCommitmentProofDraftStore";

describe("ProofDraftRepository", () => {
  it("loads and saves files through the draft port", async () => {
    const image = new File(["image"], "proof.jpg", { type: "image/jpeg" });
    const getImagesForDraft = vi.fn().mockResolvedValue([{ file: image }]);
    const setImagesForDraft = vi.fn().mockResolvedValue(undefined);
    const repository = createProofDraftRepository({
      drafts: { getImagesForDraft, setImagesForDraft },
      media: { getOrCreateUrl: vi.fn(), cleanupUrls: vi.fn() },
    });

    await expect(repository.load("draft-1")).resolves.toEqual([image]);
    await repository.save("draft-1", [image]);

    expect(getImagesForDraft).toHaveBeenCalledWith("draft-1");
    expect(setImagesForDraft).toHaveBeenCalledWith("draft-1", [image]);
  });

  it("clears after an in-flight attachment save instead of resurrecting its files", async () => {
    let finish!: () => void;
    const setImagesForDraft = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          })
      )
      .mockResolvedValue(undefined);
    const getImagesForDraft = vi.fn().mockResolvedValue([]);
    const repository = createProofDraftRepository({
      drafts: { getImagesForDraft, setImagesForDraft },
      media: { getOrCreateUrl: vi.fn(), cleanupUrls: vi.fn() },
    });
    const save = repository.save("proof-key", [new File(["bytes"], "photo.jpg")]);
    await Promise.resolve();
    await Promise.resolve();
    const reopened = repository.load("proof-key");
    expect(getImagesForDraft).not.toHaveBeenCalled();
    const clear = repository.clear("proof-key");
    expect(setImagesForDraft).toHaveBeenCalledTimes(1);
    finish();
    await Promise.all([save, clear, reopened]);
    expect(setImagesForDraft).toHaveBeenLastCalledWith("proof-key", []);
  });

  it("owns preview URL creation and revocation", async () => {
    const image = new File(["image"], "proof.jpg", { type: "image/jpeg" });
    const getOrCreateUrl = vi.fn().mockReturnValue("blob:proof");
    const cleanupUrls = vi.fn();
    const setImagesForDraft = vi.fn().mockResolvedValue(undefined);
    const repository = createProofDraftRepository({
      drafts: { getImagesForDraft: vi.fn(), setImagesForDraft },
      media: { getOrCreateUrl, cleanupUrls },
    });

    expect(repository.previewUrls("proof", [image])).toEqual(["blob:proof"]);
    repository.revoke("proof");
    await repository.clear("draft-1");

    expect(getOrCreateUrl).toHaveBeenCalledWith(image, "proof");
    expect(setImagesForDraft).toHaveBeenCalledWith("draft-1", []);
    expect(cleanupUrls).toHaveBeenCalledWith("proof");
    expect(cleanupUrls).toHaveBeenCalledWith("draft-1");
  });
});

describe("proof attachment persistence", () => {
  it("round-trips photo/audio without a Work record and clears only its proof scope", async () => {
    const key = "proof:42161:0x1111111111111111111111111111111111111111:901";
    const other = "proof:42161:0x1111111111111111111111111111111111111111:902";
    const photo = new File(["photo bytes"], "photo.jpg", { type: "image/jpeg" });
    const audio = new File(["voice bytes"], "voice.webm", { type: "audio/webm" });
    await proofDraftRepository.save(key, [photo, audio]);
    await proofDraftRepository.save(other, [photo]);
    const restored = await proofDraftRepository.load(key);
    expect(restored.map((file) => [file.name, file.type])).toEqual([
      ["photo.jpg", "image/jpeg"],
      ["voice.webm", "audio/webm"],
    ]);
    expect(await restored[0].text()).toBe("photo bytes");
    expect(await restored[1].text()).toBe("voice bytes");
    await expect(draftDB.getDraft(key)).resolves.toBeUndefined();
    await proofDraftRepository.clear(key);
    await expect(proofDraftRepository.load(key)).resolves.toEqual([]);
    expect(await proofDraftRepository.load(other)).toHaveLength(1);
    await proofDraftRepository.clear(other);
    await expect(draftDB.setImagesForDraft("missing-work", [photo])).rejects.toThrow("not found");
    await expect(draftDB.setImagesForProof("missing-work", [photo])).rejects.toThrow(
      "Invalid proof draft key"
    );
  });

  it("dates a draft's last edit when its words or files change, not when they are saved again", () => {
    const key = "proof:42161:0x1111111111111111111111111111111111111111:903";
    const store = useCommitmentProofDraftStore.getState();
    const words = { note: "Beds cleared", links: [], credited: null, clientEvidenceId: "e-903" };
    const read = () => useCommitmentProofDraftStore.getState().drafts[key];
    store.saveDraft(key, words, 1_000);
    // Reopened with words only: the same words, no files, and the garden it opens under.
    store.saveDraft(key, { ...words, garden: "0xgarden" }, 1_200);
    store.recordFiles(key, { photos: 0, videos: 0, voiceNotes: 0 }, 1_500);
    expect(read()).toMatchObject({ updatedAt: 1_000, garden: "0xgarden" });

    store.recordFiles(key, { photos: 1, videos: 0, voiceNotes: 0 }, 2_000);
    expect(read()?.updatedAt).toBe(2_000);
    // The composer reopening saves what it read back; that is not an edit.
    store.recordFiles(key, { photos: 1, videos: 0, voiceNotes: 0 }, 3_000);
    expect(read()?.updatedAt).toBe(2_000);
    store.recordFiles(key, { photos: 1, videos: 0, voiceNotes: 1 }, 4_000);
    expect(read()?.updatedAt).toBe(4_000);
    // New words are an edit, and keep the files and the garden.
    store.saveDraft(key, { ...words, note: "Beds cleared and mulched" }, 5_000);
    expect(read()).toMatchObject({
      updatedAt: 5_000,
      garden: "0xgarden",
      files: { voiceNotes: 1 },
    });

    store.clearDraft(key);
  });
});
