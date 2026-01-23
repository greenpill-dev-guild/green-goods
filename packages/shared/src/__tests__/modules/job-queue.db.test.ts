import { describe, it, expect, vi } from "vitest";

// Ensure fake-indexeddb is loaded before job-queue module
import "fake-indexeddb/auto";

// Import directly from db.ts to avoid EAS SDK dependency chain
import { jobQueueDB } from "../../modules/job-queue/db";

// Test user address for scoped queue operations
const TEST_USER_ADDRESS = "0xTestUser123";

/**
 * Creates a mock File with arrayBuffer support for Node.js test environment.
 * Node's File class may not have arrayBuffer() method in all environments.
 */
function createMockFile(content: string, name: string, type: string): File {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });

  // Ensure arrayBuffer is available (polyfill for test environments)
  if (!file.arrayBuffer) {
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => {
        const reader = new FileReader();
        return new Promise<ArrayBuffer>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = reject;
          reader.readAsArrayBuffer(blob);
        });
      },
    });
  }

  return file;
}

describe("modules/job-queue/db", () => {
  it("adds and retrieves a job, manages images URLs", async () => {
    // fake-indexeddb is already installed via setupTests
    // Polyfill URL.createObjectURL if missing
    if (!global.URL.createObjectURL) {
      (global.URL as unknown as Record<string, unknown>).createObjectURL = vi.fn(
        () => `blob:mock-${Math.random()}`
      );
      (global.URL as unknown as Record<string, unknown>).revokeObjectURL = vi.fn();
    }

    const mockFile = createMockFile("x", "x.jpg", "image/jpeg");

    const id = await jobQueueDB.addJob({
      kind: "work",
      payload: { media: [mockFile] },
      meta: { chainId: 84532 },
      chainId: 84532,
      userAddress: TEST_USER_ADDRESS,
    } as Parameters<typeof jobQueueDB.addJob>[0]);

    expect(typeof id).toBe("string");
    const job = await jobQueueDB.getJob(id);
    expect(job?.kind).toBe("work");
    expect(job?.userAddress).toBe(TEST_USER_ADDRESS);

    const images = await jobQueueDB.getImagesForJob(id);
    expect(images.length).toBe(1);

    await jobQueueDB.deleteJob(id);
    const after = await jobQueueDB.getJob(id);
    expect(after).toBeUndefined();
  });
});
