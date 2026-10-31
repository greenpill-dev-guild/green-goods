import type {
  GardenSettingsBatchOutcome,
  GardenSettingsChange,
} from "@green-goods/shared/hooks/garden/useUpdateGarden";
import { logger } from "@green-goods/shared/modules/app/logger";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import { uploadFileToIPFS } from "@green-goods/shared/modules/data/ipfs/upload";
import { isTransactionHash } from "@green-goods/shared/utils/eas/explorers";
import { imageCompressor } from "@green-goods/shared/utils/work/image-compression";
import {
  effectiveMaxGardeners,
  type GardenSettingsField,
  type SettingsDraft,
} from "./gardenSettingsDraft";
import type {
  GardenSettingsFieldProgress,
  GardenSettingsFieldState,
  GardenSettingsSaveRun,
} from "./gardenSettingsSave";

/**
 * Compresses and uploads a banner, once per file. An upload is outside any
 * batch, so a retry reuses the address the last attempt already paid for.
 */
export function createBannerUploader() {
  let last: { file: File; url: string } | null = null;
  return {
    upload: async (file: File): Promise<string> => {
      if (last?.file === file) return last.url;
      const { file: upload } = imageCompressor.shouldCompress(file, 1024)
        ? await imageCompressor.compressImage(file, { maxSizeMB: 0.8, maxWidthOrHeight: 2048 })
        : { file };
      const { cid } = await uploadFileToIPFS(upload);
      last = { file, url: resolveIPFSUrl(cid) };
      return last.url;
    },
    /** The address a file has uploaded to; null until it has. */
    uploadedUrlOf: (file: File) => (last?.file === file ? last.url : null),
  };
}

/** What each changed field writes, in `fields` order, with the banner already uploaded. */
export function gardenSettingsChanges(
  fields: readonly GardenSettingsField[],
  values: SettingsDraft,
  bannerUrl: string
): GardenSettingsChange[] {
  return fields.map((field): GardenSettingsChange => {
    switch (field) {
      case "name":
      case "description":
      case "location":
        return { field, value: values[field].trim() };
      case "openJoining":
        return { field, value: values.openJoining };
      case "maxGardeners":
        return { field, value: effectiveMaxGardeners(values) };
      case "domains":
        return { field, value: values.domains };
      case "banner":
        return { field, value: bannerUrl };
    }
  });
}

interface GardenSettingsSaveInput {
  fields: readonly GardenSettingsField[];
  /** The draft as it stood at Save; fields are locked until the run ends. */
  values: SettingsDraft;
  /** Present when several fields can go as one batch now. Never rejects. */
  sendBatch?: (changes: readonly GardenSettingsChange[]) => Promise<GardenSettingsBatchOutcome>;
  uploadBanner: (file: File) => Promise<string>;
  /** Sends one field and resolves with the transaction that carried it. */
  writeField: (
    field: GardenSettingsField,
    values: SettingsDraft,
    onUploaded: () => void
  ) => Promise<`0x${string}`>;
  onRun: (run: GardenSettingsSaveRun) => void;
  onLanded: (field: GardenSettingsField, values: SettingsDraft) => void;
  onUploadFailed: (error: unknown) => void;
}

type Progress = Partial<Record<GardenSettingsField, GardenSettingsFieldProgress>>;

const queued = (fields: readonly GardenSettingsField[]): Progress =>
  Object.fromEntries(fields.map((field) => [field, { state: "queued", hash: null }]));

/** Resolves false when nothing was sent and these fields must go one at a time instead. */
async function saveWithOneSignature(
  input: GardenSettingsSaveInput,
  sendBatch: NonNullable<GardenSettingsSaveInput["sendBatch"]>
): Promise<boolean> {
  const { fields, values, onRun } = input;
  const progress = queued(fields);
  const report = (status: GardenSettingsSaveRun["status"]) =>
    onRun({ status, fields, oneSignature: true, progress: { ...progress } });
  const markAll = (state: GardenSettingsFieldState, hash: `0x${string}` | null = null) => {
    for (const field of fields) progress[field] = { state, hash };
  };

  let bannerUrl = "";
  if (values.bannerFile && fields.includes("banner")) {
    progress.banner = { state: "uploading", hash: null };
    report("running");
    try {
      bannerUrl = await input.uploadBanner(values.bannerFile);
    } catch (error) {
      markAll("failed");
      report("stopped");
      logger.error("Garden settings upload failed", { error, source: "GardenSettingsEditor" });
      input.onUploadFailed(error);
      return true;
    }
  }

  markAll("waiting");
  report("running");
  const outcome = await sendBatch(gardenSettingsChanges(fields, values, bannerUrl));
  switch (outcome.status) {
    case "not-batchable":
      return false;
    case "saved":
      markAll("saved", outcome.transactionHash);
      for (const field of fields) input.onLanded(field, values);
      report("complete");
      return true;
    case "unknown":
      markAll("unconfirmed");
      report("unconfirmed");
      return true;
    case "not-saved":
      markAll("failed");
      report("stopped");
      return true;
  }
}

async function saveOneAtATime(input: GardenSettingsSaveInput): Promise<void> {
  const { fields, values, onRun } = input;
  const progress = queued(fields);
  const report = (status: GardenSettingsSaveRun["status"]) =>
    onRun({ status, fields, progress: { ...progress } });
  const mark = (
    field: GardenSettingsField,
    state: GardenSettingsFieldState,
    hash: `0x${string}` | null = null
  ) => {
    progress[field] = { state, hash };
    report(state === "failed" ? "stopped" : "running");
  };

  // Sequential on purpose: one wallet confirmation at a time, and a failure
  // stops the run with the rest of the draft intact.
  for (const field of fields) {
    let stage: GardenSettingsFieldState =
      field === "banner" && values.bannerFile ? "uploading" : "waiting";
    mark(field, stage);
    try {
      const hash = await input.writeField(field, values, () => {
        stage = "waiting";
        mark(field, stage);
      });
      // A Safe hands back a proposal, not a transaction: the field is sent,
      // not confirmed, and is not sent again, which would propose it twice.
      if (isTransactionHash(hash)) mark(field, "saved", hash);
      else mark(field, "proposed");
      input.onLanded(field, values);
    } catch (error) {
      mark(field, "failed");
      logger.error("Garden settings save failed", {
        error,
        field,
        source: "GardenSettingsEditor",
      });
      // Contract writes toast their own parsed errors; the image upload is
      // the one step with no toast of its own.
      if (stage === "uploading") input.onUploadFailed(error);
      return;
    }
  }
  report("complete");
}

/**
 * Runs one press of Save or Try Again. Two or more fields go under one signature
 * when the person's rail can do that; everything else goes one field at a time.
 */
export async function runGardenSettingsSave(input: GardenSettingsSaveInput): Promise<void> {
  if (input.sendBatch && input.fields.length > 1) {
    if (await saveWithOneSignature(input, input.sendBatch)) return;
  }
  await saveOneAtATime(input);
}
