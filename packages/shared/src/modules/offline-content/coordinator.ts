import { hashKey } from "@tanstack/react-query";
import type { EASWork } from "../../types/eas-responses";
import { OFFLINE_REFRESH_MS, serializeReadingData, type PreparationTarget } from "./policy";
import {
  getOfflineContentSnapshot,
  updateDownloadManifest,
  evictPreparedContent,
  releasePreparedContent,
} from "./store";
import { track } from "../app/posthog";
import { gardenPreparationKey } from "./types";
import { PreparedContentWriter, type PreparedRead } from "./cache-writer";

function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(serializeReadingData(value)).byteLength;
}

export class OfflineDownloadCoordinator extends PreparedContentWriter {
  private running: Promise<void> | undefined;
  async prepareEssentials(
    scope: string,
    reads: PreparedRead[],
    photos: string[],
    supplementalPhotos: string[] = [],
    requiredReadsAvailable = true
  ): Promise<void> {
    this.abort = new AbortController();
    this.check();
    const owner = `essential:${scope}`;
    // Protect exactly the active profile and its fallback, not every historical avatar.
    await updateDownloadManifest((manifest) => ({
      ...manifest,
      activeScope: scope,
      essentialReady: false,
      essentialFailures: 1,
      essentialAssets: [...new Set([...photos, ...supplementalPhotos])],
      essentialQueries: reads.map((read) => hashKey(read.key)),
      assets: Object.fromEntries(
        Object.entries(manifest.assets).map(([url, asset]) => [
          url,
          {
            ...asset,
            protected: photos.includes(url),
            owners: asset.owners.filter((id) => !id.startsWith("essential:")),
          },
        ])
      ),
      queries: Object.fromEntries(
        Object.entries(manifest.queries).map(([hash, query]) => [
          hash,
          {
            ...query,
            protected: reads.some((read) => hashKey(read.key) === hash),
            owners: query.owners.filter((id) => !id.startsWith("essential:")),
          },
        ])
      ),
    }));
    let failures = requiredReadsAvailable ? 0 : 1;
    for (const read of reads) {
      try {
        await this.read(owner, read.key, read.data, true);
      } catch {
        failures++;
      }
    }
    for (const photo of photos) {
      try {
        await this.media(owner, photo, true);
      } catch {
        failures++;
      }
    }
    for (const photo of supplementalPhotos) {
      try {
        await this.media(owner, photo);
      } catch {
        failures++;
      }
    }
    await updateDownloadManifest((manifest) => ({
      ...manifest,
      essentialReady: failures === 0 && reads.length > 0,
      essentialFailures: failures,
      essentialUpdatedAt: failures ? manifest.essentialUpdatedAt : Date.now(),
      storageFailure: failures > 0,
    }));
  }
  prepare(account: string, targets: PreparationTarget[]): Promise<void> {
    if (this.running) return this.running;
    this.abort = new AbortController();
    this.running = this.run(account, targets).finally(() => {
      this.running = undefined;
    });
    return this.running;
  }
  private async run(account: string, targets: PreparationTarget[]): Promise<void> {
    const selectedIds = new Set<string>();
    const priorities = new Map(
      targets.map((target) => [
        gardenPreparationKey(target.address, target.chainId, account),
        target,
      ])
    );
    await updateDownloadManifest((manifest) => ({
      ...manifest,
      gardens: Object.fromEntries(
        Object.entries(manifest.gardens).map(([key, garden]) => {
          const target = priorities.get(key);
          return [
            key,
            {
              ...garden,
              priority: target?.priority ?? 3,
              visitedAt: target?.visitedAt ?? garden.visitedAt,
            },
          ];
        })
      ),
    }));
    for (const target of targets) {
      if (!this.ports.canRun() || this.abort.signal.aborted) break;
      const owner = gardenPreparationKey(target.address, target.chainId, account);
      const prior = getOfflineContentSnapshot().gardens[owner];
      const remaining = 500 - selectedIds.size;
      const limit = Math.min(target.limit, remaining);
      if (
        prior?.state === "ready" &&
        prior.requestedLimit === limit &&
        Date.now() - (prior.updatedAt ?? 0) < OFFLINE_REFRESH_MS
      ) {
        prior.workIds.forEach((id) => selectedIds.add(id));
        continue;
      }
      await updateDownloadManifest((manifest) => ({
        ...manifest,
        gardens: {
          ...manifest.gardens,
          [owner]: {
            ...prior,
            ...target,
            account: account.toLowerCase(),
            state: "preparing",
            workIds: prior?.workIds ?? [],
            requestedLimit: limit,
            truncated: false,
            queries: prior?.queries ?? [],
            assets: prior?.assets ?? [],
            failures: 0,
          },
        },
      }));
      const queries = new Set<string>();
      const assets = new Set<string>();
      let failures = 0;
      let works: EASWork[] | undefined;
      try {
        this.check();
        if (limit === 0) throw new Error("History preparation limit reached");
        works = await this.ports.getWorks(target.address, limit, target.chainId);
        this.check();
        works.forEach((work) => selectedIds.add(work.id));
        if (
          !(await evictPreparedContent(
            this.ports.client,
            0,
            undefined,
            owner,
            works.map((work) => work.id)
          ))
        )
          throw new Error("History preparation limit reached");
        queries.add(
          await this.read(owner, this.ports.workKey(target.address, target.chainId), works)
        );
        try {
          const approvals = await this.ports.getApprovals(works, target.chainId, target.address);
          queries.add(await this.read(owner, approvals.key, approvals.data));
        } catch {
          failures++;
        }
        for (const photo of this.ports.gardenPhotos?.(target.address) ?? []) {
          try {
            assets.add(await this.media(owner, photo));
          } catch {
            failures++;
          }
        }
        // Each worker performs one network request at a time; two workers total.
        let cursor = 0;
        const worker = async () => {
          while (cursor < works!.length) {
            const work = works![cursor++];
            try {
              this.check();
              const details = await this.ports.getDetails(work, this.abort.signal);
              this.check();
              for (const read of details.reads)
                queries.add(await this.read(owner, read.key, read.data));
              for (const photo of details.photos) {
                try {
                  assets.add(await this.media(owner, photo));
                } catch {
                  failures++;
                }
              }
            } catch {
              failures++;
            }
          }
        };
        await Promise.all([worker(), worker()]);
      } catch {
        failures++;
      }
      // On interruption retain prior verified content; successful refreshes retire
      // stale owner references only after the replacement data has committed.
      if (failures) {
        prior?.queries.forEach((hash) => queries.add(hash));
        prior?.assets.forEach((url) => assets.add(url));
      }
      let completed = failures === 0 && this.ports.canRun() && !this.abort.signal.aborted;
      const updated = {
        ...getOfflineContentSnapshot().gardens[owner],
        state: completed ? ("ready" as const) : ("partial" as const),
        workIds: works?.map((work) => work.id) ?? prior?.workIds ?? [],
        queries: [...queries],
        assets: [...assets],
        failures,
        truncated: (works?.length === limit && limit > 0) || limit < target.limit,
        updatedAt: completed ? Date.now() : prior?.updatedAt,
      };
      const growth = Math.max(
        0,
        jsonBytes(updated) - jsonBytes(getOfflineContentSnapshot().gardens[owner])
      );
      if (!(await evictPreparedContent(this.ports.client, growth, undefined, owner))) {
        completed = false;
        updated.state = "partial";
        updated.failures++;
      }
      await updateDownloadManifest((manifest) => ({
        ...manifest,
        gardens: { ...manifest.gardens, [owner]: updated },
      }));
      if (completed) await releasePreparedContent(this.ports.client, owner, queries, assets);
      // If even this garden's manifest cannot fit, retire its browsing coverage.
      await evictPreparedContent(this.ports.client);
    }
    const coverage = Object.values(getOfflineContentSnapshot().gardens);
    track("offline_preparation_completed", {
      prepared_gardens: coverage.filter((garden) => garden.state === "ready").length,
      incomplete_gardens: coverage.filter((garden) => garden.state !== "ready").length,
      prepared_work_count: new Set(coverage.flatMap((garden) => garden.workIds)).size,
    });
  }
}
