/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  submitApprovalToQueue,
  submitWorkToQueue,
  validateWorkSubmissionContext,
  type WorkSubmissionDependencies,
} from "../../modules/work/work-submission";
import { parseContractError } from "../../utils/errors/contract-errors";
import {
  createMockAction,
  createMockWork,
  createMockWorkApprovalDraft,
  createMockWorkDraft,
  MOCK_ADDRESSES,
} from "../test-utils/mock-factories";

// Test user address for scoped queue operations
const TEST_USER_ADDRESS = MOCK_ADDRESSES.user;

const addJob = vi.fn<WorkSubmissionDependencies["queue"]["addJob"]>();
const requestBackgroundSync =
  vi.fn<WorkSubmissionDependencies["backgroundSync"]["requestBackgroundSync"]>();
const dependencies: WorkSubmissionDependencies = {
  queue: { addJob },
  backgroundSync: { requestBackgroundSync },
  newClientWorkId: () => "client-work-1",
};

// Helper to create mock files
function createMockFile(name: string, size: number = 1024): File {
  const content = new Array(size).fill("a").join("");
  return new File([content], name, { type: "image/jpeg" });
}

describe("modules/work-submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addJob.mockResolvedValue("job-1");
    requestBackgroundSync.mockResolvedValue(true);
  });

  it("validates submission context and returns errors", () => {
    const errors = validateWorkSubmissionContext(null, null, []);
    expect(errors.length).toBeGreaterThan(0);
  });

  describe("validateWorkSubmissionContext with minRequired", () => {
    it("passes with no images when default minRequired is 0", () => {
      const errors = validateWorkSubmissionContext("0xGarden", 1, []);
      expect(errors).toEqual([]);
    });

    it("passes when images are present with default minRequired of 0", () => {
      const errors = validateWorkSubmissionContext("0xGarden", 1, [createMockFile("img1.jpg")]);
      expect(errors).toEqual([]);
    });

    it("fails when images are below explicit minRequired of 1", () => {
      const errors = validateWorkSubmissionContext("0xGarden", 1, [], { minRequired: 1 });
      expect(errors).toContain("At least one image is required");
    });

    it("passes when images meet custom minRequired of 2", () => {
      const errors = validateWorkSubmissionContext(
        "0xGarden",
        1,
        [createMockFile("img1.jpg"), createMockFile("img2.jpg")],
        { minRequired: 2 }
      );
      expect(errors).toEqual([]);
    });

    it("fails when images below custom minRequired of 2", () => {
      const errors = validateWorkSubmissionContext("0xGarden", 1, [createMockFile("img1.jpg")], {
        minRequired: 2,
      });
      expect(errors).toContain("At least 2 images are required");
    });

    it("passes when minRequired is 0 (not required)", () => {
      const errors = validateWorkSubmissionContext("0xGarden", 1, [], { minRequired: 0 });
      expect(errors).toEqual([]);
    });

    it("passes when images exceed minRequired of 3", () => {
      const errors = validateWorkSubmissionContext(
        "0xGarden",
        1,
        [
          createMockFile("img1.jpg"),
          createMockFile("img2.jpg"),
          createMockFile("img3.jpg"),
          createMockFile("img4.jpg"),
        ],
        { minRequired: 3 }
      );
      expect(errors).toEqual([]);
    });

    it("fails for minRequired of 5 with only 3 images", () => {
      const errors = validateWorkSubmissionContext(
        "0xGarden",
        1,
        [createMockFile("img1.jpg"), createMockFile("img2.jpg"), createMockFile("img3.jpg")],
        { minRequired: 5 }
      );
      expect(errors).toContain("At least 5 images are required");
    });

    it("still validates garden and actionUID with any minRequired", () => {
      const errors = validateWorkSubmissionContext(
        null,
        null,
        [createMockFile("img1.jpg"), createMockFile("img2.jpg")],
        { minRequired: 2 }
      );
      expect(errors).toContain("Garden must be selected");
      expect(errors).toContain("Action must be selected");
    });
  });

  it("submits work to queue and returns offline tx hash", async () => {
    const draft = createMockWorkDraft({ feedback: "ok", title: undefined });
    const tx = await submitWorkToQueue(
      draft,
      MOCK_ADDRESSES.garden,
      1,
      [createMockAction({ id: "11155111-1", title: "Act" })],
      11155111,
      [],
      TEST_USER_ADDRESS,
      dependencies
    );
    expect(tx.txHash.startsWith("0xoffline_")).toBe(true);
    expect(tx.clientWorkId).toBe("client-work-1");
    expect(addJob).toHaveBeenCalled();
    expect(addJob.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        title: "Act",
      })
    );
    expect(requestBackgroundSync).toHaveBeenCalledOnce();
  });

  it("queues approval jobs", async () => {
    const result = await submitApprovalToQueue(
      createMockWorkApprovalDraft({
        workUID: "0xwork",
        actionUID: 1,
        approved: true,
        confidence: 2,
        verificationMethod: 1,
      }),
      createMockWork({ gardenerAddress: MOCK_ADDRESSES.gardener }),
      11155111,
      TEST_USER_ADDRESS,
      dependencies
    );
    expect(result.jobId).toBe("job-1");
    expect(result.txHash.startsWith("0xoffline_")).toBe(true);
  });

  it("classifies job errors via parseContractError", () => {
    // formatJobError was deleted in 2026-05-11 when user-messages.ts was
    // collapsed into the single parseContractError classifier. Job-error
    // formatting now goes through the same path as every other error.
    expect(parseContractError("permission denied").message.toLowerCase()).toContain("authorized");
    expect(parseContractError("unknown").isKnown).toBe(false);
  });
});
