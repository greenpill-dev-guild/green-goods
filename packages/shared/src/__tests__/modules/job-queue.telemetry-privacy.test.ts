/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";

const telemetryMocks = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  track: vi.fn(),
}));

vi.mock("../../modules/app/error-tracking", () => ({
  addBreadcrumb: telemetryMocks.addBreadcrumb,
}));

vi.mock("../../modules/app/posthog", () => ({
  track: telemetryMocks.track,
}));

vi.mock("../../modules/data/ipfs", () => ({
  getIpfsInitStatus: () => ({
    status: "initialized",
    error: null,
    clientReady: true,
  }),
}));

vi.mock("../../utils/storage/quota", () => ({
  getStorageQuota: async () => ({
    used: 1_000,
    quota: 10_000,
    percentUsed: 10,
    isLow: false,
    isCritical: false,
  }),
}));

import { draftDB } from "../../modules/job-queue/draft-db";
import { jobQueueDB } from "../../modules/job-queue/db";
import {
  FAILED_DELETE_ALERT_THRESHOLD,
  JobMaintenance,
} from "../../modules/job-queue/job-maintenance";

const sensitiveJobId = "job-sensitive-id";
const sensitiveDraftId = "draft-sensitive-id";
const sensitiveFileName = "garden-0x2222222222222222222222222222222222222222.jpg";
const sensitiveError = "upload failed for 0x1111111111111111111111111111111111111111";

const forbiddenPropertyNames = new Set([
  "breadcrumbs",
  "context_id",
  "error",
  "error_message",
  "error_name",
  "file_name",
  "garden_address",
  "job_id",
  "session_id",
  "tx_hash",
  "user_address",
  "user_agent",
]);

function collectPropertyNames(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectPropertyNames);
  if (!value || typeof value !== "object") return [];

  return Object.entries(value).flatMap(([key, child]) => [key, ...collectPropertyNames(child)]);
}

function brokenFile(): File {
  const file = new File(["content"], sensitiveFileName, { type: "image/jpeg" });
  Object.defineProperty(file, "arrayBuffer", {
    configurable: true,
    value: vi.fn().mockRejectedValue(new Error(sensitiveError)),
  });
  return file;
}

function serializableFile(): File {
  const file = new File(["content"], sensitiveFileName, { type: "image/jpeg" });
  Object.defineProperty(file, "arrayBuffer", {
    configurable: true,
    value: vi.fn().mockResolvedValue(new TextEncoder().encode("content").buffer),
  });
  return file;
}

function assertPrivateTelemetry(): void {
  for (const [, properties, options] of telemetryMocks.track.mock.calls) {
    const propertyNames = collectPropertyNames(properties);
    expect(propertyNames.filter((key) => forbiddenPropertyNames.has(key))).toEqual([]);
    expect(JSON.stringify(properties)).not.toContain(sensitiveJobId);
    expect(JSON.stringify(properties)).not.toContain(sensitiveDraftId);
    expect(JSON.stringify(properties)).not.toContain(sensitiveFileName);
    expect(JSON.stringify(properties)).not.toContain(sensitiveError);
    expect(options).toEqual({ includeSessionId: false });
  }
}

describe("job queue telemetry privacy across storage and maintenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(global.URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:private"),
    });
    Object.defineProperty(global.URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("sanitizes job and draft file-storage failures", async () => {
    await expect(
      jobQueueDB.addJob({
        kind: "work",
        payload: { media: [brokenFile()] },
        chainId: 11155111,
        userAddress: "0x1111111111111111111111111111111111111111",
      })
    ).rejects.toThrow(sensitiveError);

    await expect(draftDB.addImageToDraft(sensitiveDraftId, brokenFile())).rejects.toThrow(
      sensitiveError
    );

    expect(telemetryMocks.track).toHaveBeenCalledWith(
      "job_queue_file_serialization_failed",
      expect.objectContaining({ job_kind: "work", media_kind: "image" }),
      { includeSessionId: false }
    );
    expect(telemetryMocks.track).toHaveBeenCalledWith(
      "job_queue_draft_file_serialization_failed",
      expect.objectContaining({ media_kind: "image" }),
      { includeSessionId: false }
    );
    assertPrivateTelemetry();
  });

  it("sanitizes maintenance threshold and cleanup events", async () => {
    const maintenanceDB = {
      deleteJob: vi.fn(),
      getJob: vi.fn(async () => undefined),
      loadFailedDeleteIds: vi.fn(async () => [sensitiveJobId]),
      saveFailedDeleteIds: vi.fn(async () => undefined),
    };
    const thresholdMaintenance = new JobMaintenance(
      maintenanceDB as unknown as ConstructorParameters<typeof JobMaintenance>[0]
    );
    thresholdMaintenance.failedDeleteCount = FAILED_DELETE_ALERT_THRESHOLD - 1;
    await thresholdMaintenance.trackFailedDelete(sensitiveJobId);

    const cleanupMaintenance = new JobMaintenance(
      maintenanceDB as unknown as ConstructorParameters<typeof JobMaintenance>[0]
    );
    await cleanupMaintenance.cleanupOrphanedSyncedJobs();

    expect(telemetryMocks.track).toHaveBeenCalledWith(
      "job_queue_delete_failures_threshold",
      expect.objectContaining({ failed_count: FAILED_DELETE_ALERT_THRESHOLD }),
      { includeSessionId: false }
    );
    expect(telemetryMocks.track).toHaveBeenCalledWith(
      "job_queue_orphan_cleanup",
      expect.objectContaining({ cleaned: 1 }),
      { includeSessionId: false }
    );
    assertPrivateTelemetry();
  });

  it("keeps successful serialization breadcrumbs free of job identifiers", async () => {
    const id = await jobQueueDB.addJob({
      kind: "work",
      payload: {
        media: [serializableFile()],
      },
      chainId: 11155111,
      userAddress: "0x1111111111111111111111111111111111111111",
    });

    expect(telemetryMocks.addBreadcrumb).toHaveBeenCalledWith(
      "job_files_serialized",
      expect.not.objectContaining({ job_id: expect.anything() })
    );
    for (const [, properties] of telemetryMocks.addBreadcrumb.mock.calls) {
      expect(JSON.stringify(properties)).not.toContain(id);
      expect(JSON.stringify(properties)).not.toContain(sensitiveFileName);
    }

    await jobQueueDB.deleteJob(id);
  });
});
