import { beforeEach, describe, expect, it, vi } from "vitest";
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

beforeEach(() => {
  mocks.file.mockReset();
  mocks.json.mockReset().mockResolvedValue({ cid: "metadata-cid" });
});
const draft = (media: File[], audioNotes: File[] = []): WorkDraft => ({
  actionUID: 1,
  title: "Work",
  feedback: "Done",
  details: {},
  timeSpentMinutes: 30,
  media,
  audioNotes,
});
const image = (name: string) => new File([name], `${name}.jpg`, { type: "image/jpeg" });

describe("durable upload checkpoints", () => {
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
    const reloaded = files.map(
      (file) => new File([file.name.slice(0, -4)], file.name, { type: file.type })
    );
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
