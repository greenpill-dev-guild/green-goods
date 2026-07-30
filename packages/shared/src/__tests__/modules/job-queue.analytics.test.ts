import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job, WorkJobPayload } from "../../types/job-queue";

const analyticsMocks = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  track: vi.fn(),
}));

vi.mock("../../modules/app/error-tracking", () => ({
  addBreadcrumb: analyticsMocks.addBreadcrumb,
}));

vi.mock("../../modules/app/posthog", () => ({
  track: analyticsMocks.track,
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

import {
  trackJobCreated,
  trackJobPermanentlyFailed,
  trackJobProcessed,
  trackJobProcessingError,
  trackStorageWarning,
} from "../../modules/job-queue/job-analytics";

const userAddress = "0x1111111111111111111111111111111111111111";
const gardenAddress = "0x2222222222222222222222222222222222222222";
const transactionHash = `0x${"3".repeat(64)}`;

const job: Job<WorkJobPayload> = {
  id: "job-1",
  kind: "work",
  payload: {
    actionUID: 42,
    feedback: "done",
    gardenAddress,
  },
  createdAt: 1,
  attempts: 5,
  synced: false,
  chainId: 11155111,
  userAddress,
  lastError: `failed for ${gardenAddress}`,
};

const forbiddenPropertyNames = new Set([
  "breadcrumbs",
  "error",
  "garden_address",
  "job_id",
  "last_error",
  "session_id",
  "tx_hash",
  "user_address",
]);

function collectPropertyNames(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectPropertyNames);
  if (!value || typeof value !== "object") return [];

  return Object.entries(value).flatMap(([key, child]) => [key, ...collectPropertyNames(child)]);
}

describe("job queue analytics privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits only non-identifying lifecycle properties without a session ID", async () => {
    trackJobCreated("work", true, 11155111);
    await trackJobProcessingError(job, 50, 11155111, 5);
    trackJobPermanentlyFailed(job);
    trackJobProcessed("work", 50, 2);

    expect(analyticsMocks.track).toHaveBeenCalledTimes(4);
    for (const [, properties, options] of analyticsMocks.track.mock.calls) {
      const propertyNames = collectPropertyNames(properties);
      expect(propertyNames.filter((key) => forbiddenPropertyNames.has(key))).toEqual([]);
      expect(JSON.stringify(properties)).not.toContain(userAddress);
      expect(JSON.stringify(properties)).not.toContain(gardenAddress);
      expect(JSON.stringify(properties)).not.toContain(transactionHash);
      expect(options).toEqual({ includeSessionId: false });
    }
  });

  it("keeps queue breadcrumbs free of local job and address identifiers", () => {
    trackJobCreated("work", true, 11155111);

    for (const [, properties] of analyticsMocks.addBreadcrumb.mock.calls) {
      expect(collectPropertyNames(properties)).not.toContain("job_id");
      expect(collectPropertyNames(properties)).not.toContain("garden_address");
      expect(JSON.stringify(properties)).not.toContain(userAddress);
      expect(JSON.stringify(properties)).not.toContain(gardenAddress);
    }
  });

  it("suppresses session IDs on storage-health events", () => {
    trackStorageWarning(
      "work",
      {
        used: 9_500,
        quota: 10_000,
        percentUsed: 95,
        isLow: true,
        isCritical: true,
      },
      true
    );

    expect(analyticsMocks.track).toHaveBeenCalledWith(
      "job_queue_storage_critical",
      expect.any(Object),
      { includeSessionId: false }
    );
  });
});
