import { Domain } from "@green-goods/shared/types/domain";
import { describe, expect, it, vi } from "vitest";
import type { GardenSettingsField, SettingsDraft } from "./gardenSettingsDraft";
import {
  createBannerUploader,
  gardenSettingsChanges,
  runGardenSettingsSave,
} from "./gardenSettingsRun";
import type { GardenSettingsSaveRun } from "./gardenSettingsSave";

const { mockUploadFileToIPFS } = vi.hoisted(() => ({ mockUploadFileToIPFS: vi.fn() }));

vi.mock("@green-goods/shared/modules/data/ipfs/upload", () => ({
  uploadFileToIPFS: mockUploadFileToIPFS,
}));
vi.mock("@green-goods/shared/utils/work/image-compression", () => ({
  imageCompressor: { shouldCompress: () => false },
}));
vi.mock("@green-goods/shared/modules/data/ipfs/resolve", () => ({
  resolveIPFSUrl: (cid: string) => `https://ipfs.example/${cid}`,
}));

const HASH = `0x${"ab".repeat(32)}` as const;
const FILE = new File(["banner"], "banner.png", { type: "image/png" });
const VALUES: SettingsDraft = {
  name: " Tech and Sun ",
  description: "Restoring the river bank.",
  location: "Lisbon",
  openJoining: true,
  limitGardeners: true,
  maxGardeners: "25",
  capRead: true,
  domains: [Domain.SOLAR],
  bannerFile: null,
  bannerRemoved: false,
};

type SaveInput = Parameters<typeof runGardenSettingsSave>[0];

function harness(
  overrides: Partial<SaveInput> = {},
  fields: GardenSettingsField[] = ["name", "description"]
) {
  const runs: GardenSettingsSaveRun[] = [];
  const writeField = vi.fn<SaveInput["writeField"]>(async () => HASH);
  const onLanded = vi.fn<SaveInput["onLanded"]>();
  const sendBatch = vi.fn<NonNullable<SaveInput["sendBatch"]>>(async () => ({
    status: "saved",
    transactionHash: HASH,
  }));
  const uploadBanner = vi.fn<SaveInput["uploadBanner"]>(async () => "https://ipfs.example/banner");
  const onUploadFailed = vi.fn<SaveInput["onUploadFailed"]>();
  const input: SaveInput = {
    fields,
    values: VALUES,
    sendBatch,
    uploadBanner,
    writeField,
    onRun: (run) => runs.push(run),
    onLanded,
    onUploadFailed,
    ...overrides,
  };
  return { input, runs, writeField, onLanded };
}

describe("gardenSettingsChanges", () => {
  it("writes what each field writes on its own", () => {
    expect(
      gardenSettingsChanges(
        ["name", "openJoining", "maxGardeners", "domains", "banner"],
        VALUES,
        "https://ipfs.example/banner"
      )
    ).toEqual([
      { field: "name", value: "Tech and Sun" },
      { field: "openJoining", value: true },
      { field: "maxGardeners", value: 25 },
      { field: "domains", value: [Domain.SOLAR] },
      { field: "banner", value: "https://ipfs.example/banner" },
    ]);
  });
});

describe("runGardenSettingsSave under one signature", () => {
  it("moves every row together and lands them together", async () => {
    const { input, runs, onLanded } = harness();

    await runGardenSettingsSave(input);

    expect(input.writeField).not.toHaveBeenCalled();
    expect(input.sendBatch).toHaveBeenCalledTimes(1);
    expect(runs.map((run) => run.status)).toEqual(["running", "complete"]);
    expect(runs[0].progress).toEqual({
      name: { state: "waiting", hash: null },
      description: { state: "waiting", hash: null },
    });
    expect(runs[1].progress).toEqual({
      name: { state: "saved", hash: HASH },
      description: { state: "saved", hash: HASH },
    });
    expect(runs[1].oneSignature).toBe(true);
    expect(onLanded.mock.calls.map(([field]) => field)).toEqual(["name", "description"]);
  });

  it("uploads the banner before anyone signs, and sends its address", async () => {
    const { input, runs } = harness({ values: { ...VALUES, bannerFile: FILE } }, [
      "name",
      "banner",
    ]);

    await runGardenSettingsSave(input);

    expect(runs[0].progress).toEqual({
      name: { state: "queued", hash: null },
      banner: { state: "uploading", hash: null },
    });
    expect(input.uploadBanner).toHaveBeenCalledWith(FILE);
    expect(input.sendBatch).toHaveBeenCalledWith([
      { field: "name", value: "Tech and Sun" },
      { field: "banner", value: "https://ipfs.example/banner" },
    ]);
  });

  it("removes a banner with an empty address, with nothing to upload", async () => {
    const { input } = harness({ values: { ...VALUES, bannerRemoved: true } }, ["name", "banner"]);

    await runGardenSettingsSave(input);

    expect(input.uploadBanner).not.toHaveBeenCalled();
    expect(input.sendBatch).toHaveBeenCalledWith([
      { field: "name", value: "Tech and Sun" },
      { field: "banner", value: "" },
    ]);
  });

  it("sends nothing when the upload fails, and says so", async () => {
    const error = new Error("pinning down");
    const { input, runs } = harness(
      {
        values: { ...VALUES, bannerFile: FILE },
        uploadBanner: vi.fn().mockRejectedValue(error),
      },
      ["name", "banner"]
    );

    await runGardenSettingsSave(input);

    expect(input.sendBatch).not.toHaveBeenCalled();
    expect(input.onUploadFailed).toHaveBeenCalledWith(error);
    expect(runs.at(-1)).toMatchObject({
      status: "stopped",
      progress: { name: { state: "failed" }, banner: { state: "failed" } },
    });
  });

  it("lands nothing when the signature is declined or the group reverts", async () => {
    const { input, runs } = harness({
      sendBatch: vi.fn(async () => ({ status: "not-saved" }) as const),
    });

    await runGardenSettingsSave(input);

    expect(input.onLanded).not.toHaveBeenCalled();
    expect(runs.at(-1)).toMatchObject({
      status: "stopped",
      progress: { name: { state: "failed" }, description: { state: "failed" } },
    });
  });

  it("keeps an unknown outcome distinct from a failure, and lands nothing", async () => {
    const { input, runs } = harness({
      sendBatch: vi.fn(async () => ({ status: "unknown" }) as const),
    });

    await runGardenSettingsSave(input);

    expect(input.onLanded).not.toHaveBeenCalled();
    expect(input.writeField).not.toHaveBeenCalled();
    expect(runs.at(-1)).toMatchObject({
      status: "unconfirmed",
      progress: { name: { state: "unconfirmed" }, description: { state: "unconfirmed" } },
    });
  });

  it("goes one field at a time when the save does not fit in one batch", async () => {
    const { input, runs, writeField } = harness({
      sendBatch: vi.fn(async () => ({ status: "not-batchable" }) as const),
    });

    await runGardenSettingsSave(input);

    expect(writeField.mock.calls.map(([field]) => field)).toEqual(["name", "description"]);
    expect(runs.at(-1)?.status).toBe("complete");
    expect(runs.at(-1)?.oneSignature).toBeUndefined();
  });
});

describe("runGardenSettingsSave without a batch", () => {
  it("sends one change as today, even where batches are available", async () => {
    const { input } = harness({}, ["name"]);

    await runGardenSettingsSave(input);

    expect(input.sendBatch).not.toHaveBeenCalled();
    expect(input.writeField).toHaveBeenCalledTimes(1);
  });

  it("sends each field in turn on a rail nobody has listed", async () => {
    const { input, writeField } = harness({ sendBatch: undefined });

    await runGardenSettingsSave(input);

    expect(writeField.mock.calls.map(([field]) => field)).toEqual(["name", "description"]);
  });
});

describe("createBannerUploader", () => {
  it("uploads each file once, and tries again after a failed upload", async () => {
    mockUploadFileToIPFS
      .mockRejectedValueOnce(new Error("pinning down"))
      .mockResolvedValue({ cid: "bafybanner" });
    const { upload, uploadedUrlOf } = createBannerUploader();

    await expect(upload(FILE)).rejects.toThrow("pinning down");
    expect(uploadedUrlOf(FILE)).toBeNull();
    await expect(upload(FILE)).resolves.toBe("https://ipfs.example/bafybanner");
    expect(uploadedUrlOf(FILE)).toBe("https://ipfs.example/bafybanner");
    await expect(upload(FILE)).resolves.toBe("https://ipfs.example/bafybanner");
    expect(mockUploadFileToIPFS).toHaveBeenCalledTimes(2);

    await upload(new File(["other"], "other.png", { type: "image/png" }));
    expect(mockUploadFileToIPFS).toHaveBeenCalledTimes(3);
  });
});
