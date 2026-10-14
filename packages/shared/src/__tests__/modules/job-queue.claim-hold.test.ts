/**
 * @vitest-environment node
 *
 * The processor keeps a job's execution claim alive for the whole send. A
 * wallet or passkey prompt can stay open past the claim's lifetime, and a
 * lapsed claim would let another tab discard or resend a job whose transaction
 * may still go out.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acquire: vi.fn(),
  hold: vi.fn(),
  order: [] as string[],
}));

vi.mock("../../modules/work/work-confirmation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../modules/work/work-confirmation")>()),
  acquireWorkJobs: (...args: unknown[]) => mocks.acquire(...args),
}));

vi.mock("../../modules/job-queue/work-claims", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../modules/job-queue/work-claims")>()),
  holdWorkClaims: (...args: unknown[]) => mocks.hold(...args),
}));

import { createJobQueue } from "../../modules/job-queue/queue";
import { createJobQueueDependencies } from "../test-utils/job-queue-fakes";

function claim() {
  return {
    token: "claim-token",
    assertOwned: vi.fn(async () => undefined),
    release: vi.fn(async () => {
      mocks.order.push("release");
    }),
  };
}

describe("processJob and its execution claim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.order = [];
    mocks.hold.mockImplementation(() => () => {
      mocks.order.push("stop holding");
    });
  });

  it("holds the claim for the whole send and stops holding before it lets go", async () => {
    const held = claim();
    mocks.acquire.mockResolvedValue(held);
    const queue = createJobQueue(createJobQueueDependencies());

    await queue.processJob("missing-job", { transactionSender: null });

    expect(mocks.acquire).toHaveBeenCalledWith(["missing-job"]);
    expect(mocks.hold).toHaveBeenCalledWith([held]);
    expect(mocks.order).toEqual(["stop holding", "release"]);
  });

  it("holds nothing when another send already has the claim", async () => {
    mocks.acquire.mockResolvedValue(null);
    const queue = createJobQueue(createJobQueueDependencies());

    await expect(queue.processJob("busy-job", { transactionSender: null })).resolves.toMatchObject({
      success: false,
      skipped: true,
      error: "already-processing",
    });
    expect(mocks.hold).not.toHaveBeenCalled();
  });
});
