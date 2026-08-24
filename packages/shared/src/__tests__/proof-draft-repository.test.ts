import { describe, expect, it, vi } from "vitest";
import { createProofDraftRepository } from "../modules/commitment-pooling/proof-draft-repository";

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
