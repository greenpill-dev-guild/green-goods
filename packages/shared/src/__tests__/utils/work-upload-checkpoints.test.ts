import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkUploadCheckpoint, WorkDraft } from "../../types/domain";
const mocks = vi.hoisted(() => ({ file: vi.fn(), json: vi.fn() }));
vi.mock("../../modules/data/ipfs/upload", () => ({
  uploadFileToIPFS: mocks.file,
  uploadJSONToIPFS: mocks.json,
}));
vi.mock("../../config/blockchain", () => ({
  getEASConfig: () => ({
    WORK: {
      schema: "uint256 actionUID,string title,string feedback,string metadata,string[] media",
    },
  }),
}));
import { encodeWorkData } from "../../utils/eas/encoders";
import {
  InvalidWorkAttachmentError,
  PendingHeicConversionError,
} from "../../modules/work/work-attachments";
import { cleanPhoto, photoFile } from "../test-utils/photo-fixtures";
import { uploadConsent } from "../test-utils/upload-policy";

beforeEach(() => {
  mocks.file.mockReset();
  mocks.json.mockReset().mockResolvedValue({ cid: "metadata-cid" });
  // Photos are binary, so they are hashed with real WebCrypto, not the setup's text-only stand-in.
  vi.stubGlobal("crypto", { ...crypto, subtle: webcrypto.subtle });
});
afterEach(() => vi.unstubAllGlobals());
const draft = (media: File[], audioNotes: File[] = []): WorkDraft => ({
  uploadConsent: uploadConsent(),
  actionUID: 1,
  title: "Work",
  feedback: "Done",
  details: {},
  timeSpentMinutes: 30,
  media,
  audioNotes,
});
const image = (name: string) =>
  photoFile(cleanPhoto("image/jpeg", { label: name }), `${name}.jpg`, "image/jpeg");

describe("durable upload checkpoints", () => {
  it("uploads nothing without current, account-bound consent, even with a saved published checkpoint", async () => {
    const data = { ...draft([image("one")]), uploadConsent: undefined };
    await expect(
      encodeWorkData(data, 11155111, {
        checkpoint: {
          submittedAt: "now",
          files: {},
          published: { data: "0x1234", metadata: { old: true }, media: ["old"] },
        },
      })
    ).rejects.toThrow("upload-policy-required");
    await expect(
      encodeWorkData(draft([image("one")]), 11155111, {
        uploaderAddress: "0x2222222222222222222222222222222222222222",
      })
    ).rejects.toThrow("upload-policy-required");
    expect(mocks.file).not.toHaveBeenCalled();
    expect(mocks.json).not.toHaveBeenCalled();
  });
  it("exposes the exact published metadata and ordered media for a confirmed preview", async () => {
    const onEncoded = vi.fn();
    const data = draft([image("one"), image("two")]);
    mocks.file.mockImplementation(async (file: File) => ({ cid: `cid-${file.name}` }));
    await encodeWorkData(data, 11155111, { clientWorkId: "sent", onEncoded });
    expect(onEncoded).toHaveBeenCalledWith({
      metadata: mocks.json.mock.calls[0][0],
      media: ["cid-one.jpg", "cid-two.jpg"],
    });
    expect(onEncoded.mock.calls[0][0].metadata).toMatchObject({
      clientWorkId: "sent",
      timeSpentMinutes: 30,
      attachments: [
        { cid: "cid-one.jpg", type: "image/jpeg" },
        { cid: "cid-two.jpg", type: "image/jpeg" },
      ],
    });
    onEncoded.mockClear();
    mocks.json.mockRejectedValue(new Error("metadata failed"));
    await expect(encodeWorkData(data, 11155111, { onEncoded })).rejects.toThrow("metadata failed");
    expect(onEncoded).not.toHaveBeenCalled();
  });

  it("keeps documents out of the attestation's media and lists them in the metadata", async () => {
    const onEncoded = vi.fn();
    const certificate = new File(["%PDF-1.7"], "Install certificate.pdf", {
      type: "application/pdf",
    });
    mocks.file.mockImplementation(async (file: File) => ({ cid: `cid-${file.name}` }));
    await encodeWorkData(draft([certificate, image("panels")]), 11155111, { onEncoded });
    const { metadata, media } = onEncoded.mock.calls[0][0];
    expect(media).toEqual(["cid-panels.jpg"]);
    expect(metadata.attachments).toEqual([{ cid: "cid-panels.jpg", type: "image/jpeg" }]);
    expect(metadata.documents).toEqual([
      {
        cid: "cid-Install certificate.pdf",
        type: "application/pdf",
        name: "Install certificate.pdf",
        size: 8,
      },
    ]);
    // The document is pinned as it was picked.
    expect(mocks.file.mock.calls.map(([file]) => file)).toContain(certificate);
  });

  it("reuses successes after partial failure and reload, then reuses metadata", async () => {
    const files = [image("one"), image("two"), image("three"), image("four"), image("five")];
    let saved: WorkUploadCheckpoint | undefined;
    mocks.file.mockImplementation(async (file: File) => {
      if (file.name === "three.jpg") throw new Error("408 timeout");
      return { cid: `cid-${file.name}` };
    });
    await expect(
      encodeWorkData(draft(files), 11155111, {
        onCheckpoint: async (value) => {
          saved = structuredClone(value);
        },
      })
    ).rejects.toThrow("408");
    expect(Object.keys(saved!.files)).toHaveLength(4);
    mocks.file.mockClear().mockResolvedValue({ cid: "cid-three.jpg" });
    const reloaded = files.map((file) => image(file.name.slice(0, -4)));
    await encodeWorkData(draft(reloaded), 11155111, {
      checkpoint: saved,
      onCheckpoint: async (value) => {
        saved = structuredClone(value);
      },
    });
    expect(mocks.file).toHaveBeenCalledTimes(1);
    expect(mocks.file.mock.calls[0][0].name).toBe("three.jpg");
    mocks.file.mockClear();
    mocks.json.mockClear();
    await encodeWorkData(draft(reloaded), 11155111, { checkpoint: saved });
    expect(mocks.file).not.toHaveBeenCalled();
    expect(mocks.json).not.toHaveBeenCalled();
  });
  it("never uploads a HEIC photo that has not converted, and waits instead of failing", async () => {
    const heic = new File(["heic"], "garden.heic", { type: "image/heic" });
    const attempt = encodeWorkData(draft([image("photo"), heic]), 11155111, {});

    await expect(attempt).rejects.toBeInstanceOf(PendingHeicConversionError);
    expect(mocks.file).not.toHaveBeenCalled();
    expect(mocks.json).not.toHaveBeenCalled();

    const sheet = new File(["PK"], "yields.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await expect(encodeWorkData(draft([heic, sheet]), 11155111, {})).rejects.toBeInstanceOf(
      InvalidWorkAttachmentError
    );
  });
  it("retains photos and successful audio when another recording fails", async () => {
    const media = [image("photo")];
    const audio = [
      new File(["one"], "one.webm", { type: "audio/webm" }),
      new File(["two"], "two.webm", { type: "audio/webm" }),
    ];
    let saved: WorkUploadCheckpoint | undefined;
    mocks.file.mockImplementation(async (file: File) => {
      if (file.name === "two.webm") throw new Error("timeout");
      return { cid: file.name };
    });
    await expect(
      encodeWorkData(draft(media, audio), 11155111, {
        onCheckpoint: async (value) => {
          saved = value;
        },
      })
    ).rejects.toThrow();
    mocks.file.mockClear().mockResolvedValue({ cid: "two.webm" });
    await encodeWorkData(draft(media, audio), 11155111, { checkpoint: saved });
    expect(mocks.file).toHaveBeenCalledTimes(1);
  });
  it("retries metadata without reuploading bytes and publishes rounded location", async () => {
    let saved: WorkUploadCheckpoint | undefined;
    mocks.file.mockResolvedValue({ cid: "photo" });
    mocks.json.mockRejectedValueOnce(new Error("metadata timeout"));
    const data = { ...draft([image("photo")]), location: { lat: 10.123456, lng: 20.987654 } };
    await expect(
      encodeWorkData(data, 11155111, {
        onCheckpoint: async (value) => {
          saved = value;
        },
      })
    ).rejects.toThrow();
    mocks.file.mockClear();
    await encodeWorkData(data, 11155111, { checkpoint: saved });
    expect(mocks.file).not.toHaveBeenCalled();
    expect(mocks.json.mock.calls.at(-1)?.[0].location).toEqual({ lat: 10.123, lng: 20.988 });
  });
  it("does not proceed when confirmed upload progress cannot be persisted", async () => {
    mocks.file.mockResolvedValue({ cid: "photo" });
    await expect(
      encodeWorkData(draft([image("photo")]), 11155111, {
        onCheckpoint: async (checkpoint) => {
          if (Object.keys(checkpoint.files).length) throw new Error("storage failed");
        },
      })
    ).rejects.toThrow("storage failed");
    expect(mocks.json).not.toHaveBeenCalled();
  });
});
