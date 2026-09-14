/** @vitest-environment jsdom */
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { worksKeys } from "../../config/query-keys/work";
import { planOfflineContent } from "../../modules/offline-content/policy";
import {
  OfflineScheduler,
  type OfflineSchedulerPorts,
} from "../../modules/offline-content/scheduler";
import {
  getOfflineProgress,
  resetOfflineProgress,
  subscribeOfflineProgress,
  updateOfflineProgress,
} from "../../modules/offline-content/store";
import type { Garden } from "../../types/domain";
import type { EASWork } from "../../types/eas-responses";

const chainId = 11155111;
const account = "0x1111111111111111111111111111111111111111";
const neighbour = "0x9999999999999999999999999999999999999999";
const gardenA = "0xAAAA00000000000000000000000000000000aAaA";
const gardenB = "0xBBBB00000000000000000000000000000000bBbB";
const visited = "0xCCCC00000000000000000000000000000000cCcC";

function garden(id: string, members: string[], chain = chainId): Garden {
  return {
    id,
    chainId: chain,
    gardeners: members,
    stewards: [],
    owners: [],
    bannerImage: cid(`banner-${id.slice(2, 6)}`),
  } as unknown as Garden;
}

function work(
  id: string,
  gardenId: string,
  gardener: string,
  extra: Partial<EASWork> = {}
): EASWork {
  return {
    id,
    gardenAddress: gardenId,
    gardenerAddress: gardener,
    actionUID: 1,
    title: id,
    feedback: "",
    metadata: "{}",
    media: [cid(id)],
    createdAt: 1,
    ...extra,
  } as EASWork;
}

/** A CID-shaped reference, so the real IPFS resolver maps it onto the gateway. */
const cid = (name: string) => `bafy${name.toLowerCase().replace(/[^a-z0-9]/g, "")}`.padEnd(32, "0");
const photo = (name: string) =>
  `https://greengoods.mypinata.cloud/ipfs/${cid(name)}?img-width=800&img-format=auto`;

function harness(options: { gardens?: Garden[]; account?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const conditions = { online: true, visible: true, dataSaver: false, mediaReady: true };
  const events: string[] = [];
  const saved = new Set<string>();
  const works: Record<string, EASWork[]> = {
    [gardenA.toLowerCase()]: [
      work("a-neighbour", gardenA, neighbour),
      work("a-own", gardenA, account, { metadata: "bafy-a-own", media: [] }),
    ],
    [gardenB.toLowerCase()]: [
      work("b-neighbour", gardenB, neighbour, { metadata: "bafy-b-neighbour", media: [] }),
      work("b-own", gardenB, account),
    ],
  };
  const ports: OfflineSchedulerPorts = {
    client,
    chainId,
    account: () => options.account ?? account,
    gardens: () =>
      options.gardens ?? [
        garden(gardenA, [account]),
        garden(gardenB, [account]),
        garden(visited, [neighbour]),
      ],
    avatarUrl: () => undefined,
    online: () => conditions.online,
    visible: () => conditions.visible,
    dataSaver: () => conditions.dataSaver,
    cellular: () => false,
    mediaReady: () => conditions.mediaReady,
    fetchWorks: vi.fn(async (gardenId: string) => {
      events.push(`list:${gardenId.toLowerCase()}`);
      return works[gardenId.toLowerCase()] ?? [];
    }),
    fetchApprovals: vi.fn(async () => {
      events.push("approvals");
      return [];
    }),
    readMetadata: vi.fn(async (raw: string) => {
      events.push(`details:${raw}`);
      return { attachments: [{ cid: cid(raw), type: "image/jpeg" }] } as never;
    }),
    media: {
      isCached: vi.fn(async (url: string) => saved.has(url)),
      download: vi.fn(async (url: string) => {
        events.push(`photo:${url}`);
        saved.add(url);
        return 1_000;
      }),
      sweep: vi.fn(async () => ({ bytes: 42_000_000 })),
      retireLegacy: vi.fn(async () => {}),
    },
    persist: vi.fn(async () => {}),
    sleep: vi.fn(async () => {}),
    idle: vi.fn(async () => {}),
    now: () => 1_000,
  };
  return { client, conditions, events, ports, saved, works };
}

beforeEach(() => resetOfflineProgress());
afterEach(() => {
  vi.useRealTimers();
  resetOfflineProgress();
});

describe("offline plan", () => {
  it("keeps every joined garden's lists, with the garden in view first in the list's spelling", () => {
    const gardens = [
      garden(gardenA, [account]),
      garden(gardenB, [account.toUpperCase().replace("0X", "0x")]),
      garden(visited, [neighbour]),
      garden("0xDDDD00000000000000000000000000000000dDdD", [account], 42161),
    ];

    expect(planOfflineContent(gardens, account, chainId)).toEqual({ lists: [gardenA, gardenB] });
    expect(planOfflineContent(gardens, account, chainId, gardenB.toLowerCase())).toEqual({
      lists: [gardenB, gardenA],
      photoGarden: gardenB,
    });
    expect(planOfflineContent(gardens, account, chainId, visited.toLowerCase())).toEqual({
      lists: [visited, gardenA, gardenB],
      photoGarden: visited,
    });
  });
});

describe("offline scheduler", () => {
  it("prepares lists and details everywhere, photos only for the garden in view and own work", async () => {
    const { client, events, ports } = harness();
    const scheduler = new OfflineScheduler(ports);
    scheduler.setActiveGarden(gardenA.toLowerCase());

    await scheduler.run();

    expect(ports.fetchWorks).toHaveBeenCalledTimes(2);
    expect(ports.readMetadata).toHaveBeenCalledWith("bafy-a-own", expect.anything());
    expect(ports.readMetadata).toHaveBeenCalledWith("bafy-b-neighbour", expect.anything());
    const photos = events.filter((event) => event.startsWith("photo:"));
    expect(photos).toEqual(
      expect.arrayContaining([
        `photo:${photo("a-neighbour")}`,
        `photo:${photo("bafy-a-own")}`,
        `photo:${photo("banner-AAAA")}`,
        `photo:${photo("b-own")}`,
      ])
    );
    expect(photos).not.toContain(`photo:${photo("bafy-b-neighbour")}`);
    expect(client.getQueryData(worksKeys.online(gardenB, chainId))).toHaveLength(2);
    expect(client.getQueryData(worksKeys.metadata("bafy-b-neighbour"))).toBeDefined();
    expect(getOfflineProgress()).toMatchObject({
      state: "ready",
      runRatio: 1,
      runBytes: photos.length * 1_000,
      savedBytes: 42_000_000,
      missingPhotos: 0,
    });
  });

  it("reuses lists a screen fetched moments ago instead of downloading them again", async () => {
    const { client, ports, works } = harness();
    client.setQueryData(worksKeys.online(gardenA, chainId), works[gardenA.toLowerCase()]);
    client.setQueryData(worksKeys.approvals(undefined, chainId), []);

    await new OfflineScheduler(ports).run();

    expect(ports.fetchApprovals).not.toHaveBeenCalled();
    expect(ports.fetchWorks).toHaveBeenCalledTimes(1);
    expect(ports.fetchWorks).toHaveBeenCalledWith(gardenB);
  });

  it("waits while the screen is fetching before starting each download", async () => {
    const { client, events, ports } = harness();
    vi.spyOn(client, "isFetching").mockReturnValueOnce(1).mockReturnValueOnce(1).mockReturnValue(0);
    vi.mocked(ports.sleep).mockImplementation(async () => {
      events.push("waited");
    });

    await new OfflineScheduler(ports).run();

    expect(events.slice(0, 3)).toEqual(["waited", "waited", "approvals"]);
    expect(ports.idle).toHaveBeenCalled();
  });

  it("moves a garden opened mid-run to the front and adds its photos", async () => {
    const { events, ports } = harness({
      gardens: [garden(gardenB, [account]), garden(gardenA, [account])],
    });
    const scheduler = new OfflineScheduler(ports);
    vi.mocked(ports.fetchWorks).mockImplementation(async (gardenId: string) => {
      events.push(`list:${gardenId.toLowerCase()}`);
      if (gardenId === gardenB) scheduler.setActiveGarden(gardenA);
      return harness().works[gardenId.toLowerCase()];
    });

    await scheduler.run();

    const listA = events.indexOf(`list:${gardenA.toLowerCase()}`);
    expect(listA).toBeGreaterThan(-1);
    expect(listA).toBeLessThan(events.indexOf("details:bafy-b-neighbour"));
    expect(events).toContain(`photo:${photo("a-neighbour")}`);
  });

  it("keeps lists current under Data Saver, holds photos, and downloads them on Resume", async () => {
    const { conditions, ports } = harness();
    conditions.dataSaver = true;
    const scheduler = new OfflineScheduler(ports);

    await scheduler.run();

    expect(ports.fetchWorks).toHaveBeenCalledTimes(2);
    expect(ports.media.download).not.toHaveBeenCalled();
    expect(getOfflineProgress()).toMatchObject({ state: "paused", pauseReason: "dataSaver" });

    scheduler.resume();

    await vi.waitFor(() => expect(getOfflineProgress().state).toBe("ready"));
    expect(ports.media.download).toHaveBeenCalled();
  });

  it("pauses while offline and continues on reconnect", async () => {
    const { conditions, ports } = harness();
    conditions.online = false;
    const scheduler = new OfflineScheduler(ports);

    const run = scheduler.run();
    await vi.waitFor(() =>
      expect(getOfflineProgress()).toMatchObject({ state: "paused", pauseReason: "offline" })
    );
    expect(ports.fetchApprovals).not.toHaveBeenCalled();

    conditions.online = true;
    scheduler.environmentChanged();
    await run;

    expect(ports.fetchWorks).toHaveBeenCalledTimes(2);
    expect(getOfflineProgress().state).toBe("ready");
  });

  it("retries a photo interrupted by Pause instead of counting it missing", async () => {
    const { ports, saved } = harness({ gardens: [garden(gardenA, [account])] });
    const scheduler = new OfflineScheduler(ports);
    let interrupted = false;
    vi.mocked(ports.media.download).mockImplementation(async (url, signal) => {
      if (!interrupted) {
        interrupted = true;
        const aborted = new Promise<never>((_, reject) =>
          signal.addEventListener("abort", () => reject(new DOMException("Paused", "AbortError")))
        );
        scheduler.pause();
        return aborted;
      }
      saved.add(url);
      return 500;
    });

    const run = scheduler.run();
    await vi.waitFor(() =>
      expect(getOfflineProgress()).toMatchObject({ state: "paused", pauseReason: "user" })
    );
    scheduler.resume();
    await run;

    expect(getOfflineProgress()).toMatchObject({ state: "ready", missingPhotos: 0 });
  });

  it("reports photos that could not be downloaded and keeps the old worker's copies", async () => {
    const { ports } = harness({ gardens: [garden(gardenB, [account])] });
    vi.mocked(ports.media.download).mockRejectedValueOnce(new Error("Photo download failed (500)"));

    await new OfflineScheduler(ports).run();

    expect(getOfflineProgress()).toMatchObject({ state: "incomplete", missingPhotos: 1 });
    expect(ports.media.retireLegacy).not.toHaveBeenCalled();
  });

  it("writes the reading cache once per interval, not once per record", async () => {
    const { ports } = harness();

    await new OfflineScheduler(ports).run();

    expect(ports.persist).toHaveBeenCalledTimes(1);
  });

  it("lets another account on the same phone reuse downloaded lists and photos", async () => {
    const first = harness();
    const firstScheduler = new OfflineScheduler(first.ports);
    firstScheduler.setActiveGarden(gardenA);
    await firstScheduler.run();
    const downloads = vi.mocked(first.ports.media.download).mock.calls.length;

    const steward = "0x2222222222222222222222222222222222222222";
    const second = new OfflineScheduler({
      ...first.ports,
      account: () => steward,
      gardens: () => [garden(gardenA, [account, steward])],
    });
    second.setActiveGarden(gardenA);
    await second.run();

    expect(first.ports.fetchWorks).toHaveBeenCalledTimes(2);
    expect(vi.mocked(first.ports.media.download).mock.calls.length).toBe(downloads);
  });

  it("retires photos prepared by the previous worker once, after a complete run", async () => {
    const { ports } = harness();
    const scheduler = new OfflineScheduler(ports);

    await scheduler.run();
    await scheduler.run();

    expect(ports.media.retireLegacy).toHaveBeenCalledTimes(1);
  });

  it("does not download photos through a worker that cannot keep them", async () => {
    const { conditions, ports } = harness();
    conditions.mediaReady = false;

    await new OfflineScheduler(ports).run();

    expect(ports.media.download).not.toHaveBeenCalled();
    expect(ports.media.sweep).not.toHaveBeenCalled();
    expect(getOfflineProgress().state).toBe("ready");
  });
});

describe("offline progress store", () => {
  it("announces state changes at once and coalesces byte updates", () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    const unsubscribe = subscribeOfflineProgress(listener);

    updateOfflineProgress({ state: "downloading" });
    expect(listener).toHaveBeenCalledTimes(1);

    updateOfflineProgress({ runBytes: 1_000 });
    updateOfflineProgress({ runBytes: 2_000, runRatio: 0.5 });
    expect(listener).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(250);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getOfflineProgress()).toMatchObject({ runBytes: 2_000, runRatio: 0.5 });
    unsubscribe();
  });
});
