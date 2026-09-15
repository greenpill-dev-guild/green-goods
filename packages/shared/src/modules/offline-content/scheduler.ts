import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { worksKeys } from "../../config/query-keys/work";
import type { Garden, WorkMetadata } from "../../types/domain";
import type { EASWork, EASWorkApproval } from "../../types/eas-responses";
import { OFFLINE_REFRESH_MS, planOfflineContent } from "./policy";
import { OfflineRunQueue, type OfflineTask, sameAddress } from "./run-queue";
import { getOfflineProgress, updateOfflineProgress } from "./store";
import type { OfflinePauseReason } from "./types";

export interface OfflineMediaPort {
  isCached(url: string): Promise<boolean>;
  download(url: string, signal: AbortSignal): Promise<number>;
  sweep(keep: string[]): Promise<{ bytes: number } | undefined>;
  protect(keep: string[]): Promise<boolean>;
  retireLegacy(): Promise<void>;
}

export interface OfflineSchedulerPorts {
  client: QueryClient;
  chainId: number;
  account(): string | undefined;
  gardens(): Garden[] | undefined;
  avatarUrl(): string | undefined;
  online(): boolean;
  visible(): boolean;
  dataSaver(): boolean;
  cellular(): boolean;
  mediaReady(): boolean;
  /** The same reads the screens use, so every download fills the screens' own queries. */
  fetchWorks(garden: string): Promise<EASWork[]>;
  fetchApprovals(): Promise<EASWorkApproval[]>;
  readMetadata(metadata: string, signal?: AbortSignal): Promise<WorkMetadata>;
  media: OfflineMediaPort;
  /** Writes one filled read to the reading cache; rejects when storage refuses. */
  persistQuery(queryKey: QueryKey): Promise<void>;
  sleep(ms: number): Promise<void>;
  idle(): Promise<void>;
  now(): number;
}

/** How often a download waiting behind the screen checks again. */
const FOREGROUND_RECHECK_MS = 500;
/** A waiting run rechecks its conditions even if no event wakes it. */
const WAKE_RECHECK_MS = 30_000;

class RunStopped extends Error {}

/**
 * Downloads offline content without competing with the screen. Every task waits
 * until nothing in the app is fetching and the browser is idle, the garden in
 * view moves to the front of the queue, photos pause under Data Saver, and each
 * read is written to the reading cache once it has landed.
 */
export class OfflineScheduler {
  private activeGarden?: string;
  private userPaused = false;
  private dataSaverOverride = false;
  private running = false;
  private rerun = false;
  private refreshRequested = false;
  private stopped = false;
  private wakers: Array<() => void> = [];
  private downloads = new AbortController();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastRunAt = 0;
  private legacyRetired = false;

  constructor(private readonly ports: OfflineSchedulerPorts) {}

  get lastRun(): number {
    return this.lastRunAt;
  }

  setActiveGarden(garden?: string): void {
    if (sameAddress(garden, this.activeGarden) || (!garden && !this.activeGarden)) return;
    this.activeGarden = garden;
    this.wake();
  }

  /** Starts a run after `delayMs`; a later call replaces an earlier pending start. */
  schedule(delayMs = 0, options: { refresh?: boolean } = {}): void {
    if (this.stopped) return;
    if (options.refresh) this.refreshRequested = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.run(), delayMs);
  }

  pause(): void {
    this.userPaused = true;
    this.abortDownloads();
    if (this.running) this.showPaused("user");
    this.wake();
  }

  /** Resuming under Data Saver downloads photos anyway until the app closes. */
  resume(): void {
    this.userPaused = false;
    if (this.ports.dataSaver()) this.dataSaverOverride = true;
    this.wake();
    if (!this.running) this.schedule(0);
  }

  /** Connectivity, visibility, Data Saver or the worker changed. */
  environmentChanged(): void {
    if (!this.ports.online()) {
      this.abortDownloads();
      if (this.running) this.showPaused("offline");
    }
    this.wake();
    if (!this.running) this.schedule(0);
  }

  stop(): void {
    this.stopped = true;
    clearTimeout(this.timer);
    this.abortDownloads();
    this.wake();
  }

  async run(): Promise<void> {
    if (this.stopped) return;
    if (this.running) {
      this.rerun = true;
      return;
    }
    this.running = true;
    try {
      do {
        this.rerun = false;
        const refresh = this.refreshRequested;
        this.refreshRequested = false;
        await this.runOnce(refresh);
      } while (this.rerun && !this.stopped);
    } catch (error) {
      if (!(error instanceof RunStopped)) throw error;
    } finally {
      this.running = false;
    }
  }

  private async runOnce(refresh: boolean): Promise<void> {
    const { ports } = this;
    const account = ports.account();
    const gardens = ports.gardens();
    if (!account || !gardens) return;
    const queue = new OfflineRunQueue(
      { client: ports.client, account, gardens, gardenInView: () => this.activeGarden },
      planOfflineContent(gardens, account, ports.chainId, this.activeGarden),
      ports.avatarUrl()
    );
    const staleTime = refresh ? 0 : OFFLINE_REFRESH_MS;
    updateOfflineProgress({
      state: "downloading",
      pauseReason: undefined,
      runBytes: 0,
      runRatio: 0,
      missingPhotos: 0,
      failedReads: 0,
      storageFull: false,
    });

    while (!queue.isEmpty) {
      await this.waitForTurn();
      const batch = queue.next({
        photoLimit: ports.cellular() ? 1 : 2,
        photosAllowed: ports.mediaReady() && (!ports.dataSaver() || this.dataSaverOverride),
      });
      if (batch.some((task) => task.kind === "photo") && ports.mediaReady()) {
        await ports.media.protect(queue.plannedPhotos);
      }
      const results = await Promise.all(
        batch.map((task) =>
          this.execute(task, staleTime).then(
            (value) => ({ task, value }),
            (error: unknown) => ({ task, error })
          )
        )
      );
      for (const result of results) {
        if (!("error" in result)) queue.completed(result.task, result.value);
        else if (this.stopped || (result.error as Error | undefined)?.name === "AbortError") {
          queue.retry(result.task);
        } else queue.failed(result.task, result.error);
      }
      updateOfflineProgress({
        state: "downloading",
        pauseReason: undefined,
        runBytes: queue.bytes,
        runRatio: queue.ratio,
      });
    }
    await this.finish(queue);
  }

  private async finish(queue: OfflineRunQueue): Promise<void> {
    const { ports } = this;
    this.lastRunAt = ports.now();
    let savedBytes = getOfflineProgress().savedBytes;
    if (ports.mediaReady()) {
      const stats = await ports.media.sweep(queue.keptPhotos);
      if (stats) savedBytes = stats.bytes;
      if (!queue.missing && !queue.held && !this.legacyRetired) {
        await ports.media.retireLegacy();
        this.legacyRetired = true;
      }
    }
    const waitingForDataSaver =
      queue.held > 0 && ports.mediaReady() && ports.dataSaver() && !this.dataSaverOverride;
    const waitingForWorker = queue.held > 0 && !ports.mediaReady();
    const storageFull = queue.storageRejected || getOfflineProgress().storageFull;
    const incomplete = queue.missing > 0 || queue.failedReads > 0 || storageFull;
    updateOfflineProgress({
      state: incomplete
        ? "incomplete"
        : waitingForDataSaver || waitingForWorker
          ? "paused"
          : "ready",
      pauseReason: waitingForDataSaver ? "dataSaver" : waitingForWorker ? "worker" : undefined,
      runBytes: queue.bytes,
      runRatio: 1,
      savedBytes,
      missingPhotos: queue.missing,
      failedReads: queue.failedReads,
      storageFull,
      completedAt: ports.now(),
    });
  }

  /** A read counts as prepared only once its record is in the reading cache. */
  private async fetchAndPersist<T>(queryKey: QueryKey, fetch: () => Promise<T>): Promise<T> {
    const value = await fetch();
    await this.ports.persistQuery(queryKey);
    return value;
  }

  private execute(task: OfflineTask, staleTime: number): Promise<unknown> {
    const { client, chainId } = this.ports;
    switch (task.kind) {
      case "approvals": {
        const queryKey = worksKeys.approvals(undefined, chainId);
        return this.fetchAndPersist(queryKey, () =>
          client.fetchQuery({
            queryKey,
            queryFn: () => this.ports.fetchApprovals(),
            networkMode: "online",
            staleTime,
          })
        );
      }
      case "list": {
        const queryKey = worksKeys.online(task.garden, chainId);
        return this.fetchAndPersist(queryKey, () =>
          client.fetchQuery({
            queryKey,
            queryFn: () => this.ports.fetchWorks(task.garden),
            networkMode: "online",
            staleTime,
          })
        );
      }
      case "details": {
        const metadata = task.work.metadata.trim();
        const queryKey = worksKeys.metadata(metadata);
        return this.fetchAndPersist(queryKey, () =>
          client.fetchQuery({
            queryKey,
            queryFn: ({ signal }) => this.ports.readMetadata(metadata, signal),
            networkMode: "online",
            staleTime: Number.POSITIVE_INFINITY,
          })
        );
      }
      case "photo":
        return this.ports.media
          .isCached(task.url)
          .then((cached) =>
            cached ? 0 : this.ports.media.download(task.url, this.downloads.signal)
          );
    }
  }

  private async waitForTurn(): Promise<void> {
    const { ports } = this;
    for (;;) {
      if (this.stopped) throw new RunStopped();
      if (!ports.online()) {
        this.showPaused("offline");
        await this.untilWoken();
      } else if (this.userPaused) {
        this.showPaused("user");
        await this.untilWoken();
      } else if (!ports.visible()) {
        await this.untilWoken();
      } else if (ports.client.isFetching() > 0 || ports.client.isMutating() > 0) {
        await ports.sleep(FOREGROUND_RECHECK_MS);
      } else {
        await ports.idle();
        if (this.stopped) throw new RunStopped();
        if (ports.online() && !this.userPaused && ports.visible() && !ports.client.isFetching()) {
          return;
        }
      }
    }
  }

  private showPaused(reason: OfflinePauseReason): void {
    const current = getOfflineProgress();
    if (current.state !== "paused" || current.pauseReason !== reason) {
      updateOfflineProgress({ state: "paused", pauseReason: reason });
    }
  }

  private untilWoken(): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(done, WAKE_RECHECK_MS);
      function done() {
        clearTimeout(timer);
        resolve();
      }
      this.wakers.push(done);
    });
  }

  private wake(): void {
    const wakers = this.wakers;
    this.wakers = [];
    for (const waker of wakers) waker();
  }

  private abortDownloads(): void {
    this.downloads.abort();
    this.downloads = new AbortController();
  }
}
