/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PreparationResult } from "../../../modules/work/prepare-queued-work";
import {
  createUploadPreparation,
  uploadPreparationStore,
  type UploadPreparation,
  type UploadPreparationPorts,
} from "../../../modules/work/upload-preparation";
import type { Job } from "../../../types/job-queue";

function queued(id: string, meta: Job["meta"] = {}): Job {
  return {
    id,
    kind: "work",
    chainId: 42161,
    payload: { actionUID: 1, gardenAddress: "0xgarden", feedback: "" },
    meta,
    createdAt: 1,
    attempts: 0,
    synced: false,
    userAddress: "0xuser",
  } as Job;
}

function harness(jobs: Job[], overrides: Partial<UploadPreparationPorts> = {}) {
  const store = new Map(jobs.map((job) => [job.id, job]));
  const held = new Set<string>();
  const order: string[] = [];
  let clock = 1_000_000;
  const ports: UploadPreparationPorts = {
    userAddress: "0xuser",
    chainId: 42161,
    isConfirmedOnline: () => true,
    isVisible: () => true,
    isDataSaverOn: () => false,
    listJobs: async () => [...store.values()],
    getJob: async (id) => store.get(id),
    acquire: async (ids) =>
      new Map(
        ids
          .filter((id) => !held.has(id))
          .map((id) => {
            held.add(id);
            return [
              id,
              {
                token: id,
                assertOwned: vi.fn(),
                release: vi.fn(async () => {
                  held.delete(id);
                }),
              },
            ] as const;
          })
      ),
    hold: () => () => undefined,
    prepare: vi.fn(async (job: Job): Promise<PreparationResult> => {
      order.push(job.id);
      job.meta = { ...job.meta, preparation: { status: "ready", checkedAt: "now" } };
      return "ready";
    }),
    recover: vi.fn(async () => []),
    now: () => clock,
    ...overrides,
  };
  return {
    ports,
    held,
    order,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

async function settled(preparation: UploadPreparation) {
  preparation.schedule();
  // Let the pass finish: each step awaits a resolved promise.
  await vi.waitFor(() => expect(uploadPreparationStore.getSnapshot().activeJobId).toBeNull());
  await new Promise((resolve) => setTimeout(resolve, 0));
}

let preparation: UploadPreparation | undefined;
afterEach(() => {
  preparation?.stop();
});

describe("preparing queued items in the background", () => {
  it("prepares queued items one at a time, each under its own claim, after recovering once", async () => {
    const { ports, held, order } = harness([queued("a"), queued("b")]);
    preparation = createUploadPreparation(ports);

    await settled(preparation);
    await settled(preparation);

    expect(order).toEqual(["a", "b"]);
    expect(held.size).toBe(0);
    expect(ports.recover).toHaveBeenCalledOnce();
  });

  it("waits, and says why, while it cannot run", async () => {
    for (const [override, reason] of [
      [{ isConfirmedOnline: () => false }, "unconfirmed"],
      [{ isVisible: () => false }, "hidden"],
      [{ isDataSaverOn: () => true }, "data-saver"],
    ] as const) {
      const { ports, order } = harness([queued("a")], override);
      preparation = createUploadPreparation(ports);

      await settled(preparation);

      expect(order).toEqual([]);
      expect(uploadPreparationStore.getSnapshot().paused).toBe(reason);
      preparation.stop();
    }
  });

  it("prepares under Data Saver once the person asks", async () => {
    const { ports, order } = harness([queued("a")], { isDataSaverOn: () => true });
    preparation = createUploadPreparation(ports);

    await settled(preparation);
    expect(order).toEqual([]);
    preparation.prepareNow();

    await vi.waitFor(() => expect(order).toEqual(["a"]));
  });

  it("holds back while an upload runs, and resumes when it ends", async () => {
    const { ports, order } = harness([queued("a")]);
    preparation = createUploadPreparation(ports);
    const release = preparation.suspend();

    await settled(preparation);
    expect(order).toEqual([]);
    expect(uploadPreparationStore.getSnapshot().paused).toBe("uploading");

    release();
    await vi.waitFor(() => expect(order).toEqual(["a"]));
  });

  it("leaves an item another holder claimed", async () => {
    const { ports, held, order } = harness([queued("a"), queued("b")]);
    held.add("a");
    preparation = createUploadPreparation(ports);

    await settled(preparation);

    expect(order).toEqual(["b"]);
  });

  it("backs off an item whose answer never arrived", async () => {
    const { ports, advance } = harness([queued("a")], {
      prepare: vi.fn(async (): Promise<PreparationResult> => "retry-later"),
    });
    preparation = createUploadPreparation(ports);

    await settled(preparation);
    await settled(preparation);
    expect(ports.prepare).toHaveBeenCalledOnce();

    advance(30_001);
    await settled(preparation);
    expect(ports.prepare).toHaveBeenCalledTimes(2);
  });

  it("checks a blocked item again once a session, and leaves ready items alone", async () => {
    const blocked = queued("blocked", {
      preparation: { status: "blocked", reason: "NotGardenMember", checkedAt: "earlier" },
    });
    const ready = queued("ready", { preparation: { status: "ready", checkedAt: "earlier" } });
    const { ports, order } = harness([blocked, ready], {
      prepare: vi.fn(async (job: Job): Promise<PreparationResult> => {
        order.push(job.id);
        return "blocked";
      }),
    });
    preparation = createUploadPreparation(ports);

    await settled(preparation);
    await settled(preparation);

    expect(order).toEqual(["blocked"]);
  });
});
