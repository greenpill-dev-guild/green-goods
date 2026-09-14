import type { QueryClient } from "@tanstack/react-query";
import { worksKeys } from "../../config/query-keys/work";
import type { Garden, WorkMetadata } from "../../types/domain";
import type { EASWork } from "../../types/eas-responses";
import { resolveIPFSUrl } from "../data/ipfs/resolve";
import { parseInlineWorkMetadata } from "../work/read-work-metadata";
import { isKeptMediaUrl } from "./media";
import { displayImageUrl, type OfflinePlan } from "./policy";

export type OfflineTask =
  | { kind: "approvals" }
  | { kind: "list"; garden: string }
  | { kind: "details"; garden: string; work: EASWork }
  | { kind: "photo"; garden: string; url: string };

export function sameAddress(left?: string, right?: string): boolean {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

function photoUrls(work: EASWork, metadata?: WorkMetadata | null): string[] {
  const references = metadata?.attachments
    ? metadata.attachments
        .filter((attachment) => attachment.type?.startsWith("image/"))
        .map((attachment) => attachment.cid)
    : (work.media ?? []);
  return references
    .filter(Boolean)
    .map((reference) => displayImageUrl(resolveIPFSUrl(reference)))
    .filter(isKeptMediaUrl);
}

interface RunQueueContext {
  client: QueryClient;
  account: string;
  gardens: Garden[];
  /** Read on every step, so a garden opened mid-run moves to the front. */
  gardenInView(): string | undefined;
}

/**
 * One run's remaining work, its order and its progress. Work lists and details
 * are queued for every planned garden; photos only for the garden in view, the
 * account's own work and its avatar.
 */
export class OfflineRunQueue {
  private tasks: OfflineTask[];
  private readonly photos = new Set<string>();
  private readonly listed = new Map<string, EASWork[]>();
  private photoGarden: string | undefined;
  private total: number;
  private done = 0;
  private shownRatio = 0;
  bytes = 0;
  missing = 0;
  held = 0;

  constructor(
    private readonly context: RunQueueContext,
    plan: OfflinePlan,
    avatarUrl?: string
  ) {
    this.tasks = [
      { kind: "approvals" },
      ...plan.lists.map((garden) => ({ kind: "list" as const, garden })),
    ];
    this.total = this.tasks.length;
    if (avatarUrl && isKeptMediaUrl(avatarUrl)) this.addPhoto("", avatarUrl);
  }

  get isEmpty(): boolean {
    return this.tasks.length === 0;
  }

  /** Photos this run wants kept when the worker trims its cache. */
  get keptPhotos(): string[] {
    return [...this.photos];
  }

  /** Completed share of the run; never lower than it has already been shown. */
  get ratio(): number {
    const current = this.total > 0 ? Math.min(this.done / this.total, 1) : 1;
    this.shownRatio = Math.max(this.shownRatio, current);
    return this.shownRatio;
  }

  /**
   * The next tasks to run: up to `photoLimit` photos together, anything else one
   * at a time. Photos that may not download now are held back for a later run.
   */
  next({ photoLimit, photosAllowed }: { photoLimit: number; photosAllowed: boolean }) {
    this.followGardenInView();
    this.sort();
    if (this.tasks[0]?.kind === "photo" && !photosAllowed) {
      const photoCount = this.tasks.filter((task) => task.kind === "photo").length;
      this.held += photoCount;
      this.total -= photoCount;
      this.tasks = this.tasks.filter((task) => task.kind !== "photo");
    }
    if (this.tasks[0]?.kind !== "photo") return this.tasks.splice(0, 1);
    const firstOther = this.tasks.findIndex((task) => task.kind !== "photo");
    const photos = firstOther === -1 ? this.tasks.length : firstOther;
    return this.tasks.splice(0, Math.min(photos, photoLimit));
  }

  /** Interrupted by Pause or loss of connection: runs again, not counted as missing. */
  retry(task: OfflineTask): void {
    this.tasks.unshift(task);
  }

  failed(task: OfflineTask): void {
    this.done += 1;
    if (task.kind === "photo") this.missing += 1;
  }

  completed(task: OfflineTask, value: unknown): void {
    this.done += 1;
    if (task.kind === "list") {
      const works = (value as EASWork[] | undefined) ?? [];
      this.listed.set(task.garden.toLowerCase(), works);
      for (const work of works) this.addWork(task.garden, work);
    } else if (task.kind === "details" && this.inPhotoScope(task.garden, task.work)) {
      for (const url of photoUrls(task.work, value as WorkMetadata))
        this.addPhoto(task.garden, url);
    } else if (task.kind === "photo") {
      this.bytes += Number(value) || 0;
    }
  }

  private addPhoto(garden: string, url: string): void {
    if (this.photos.has(url)) return;
    this.photos.add(url);
    this.tasks.push({ kind: "photo", garden, url });
    this.total += 1;
  }

  private inPhotoScope(garden: string, work: EASWork): boolean {
    return (
      sameAddress(garden, this.context.gardenInView()) ||
      sameAddress(work.gardenerAddress, this.context.account)
    );
  }

  /** Metadata when already known: inline, or read before; `undefined` when it still needs a read. */
  private knownMetadata(work: EASWork): WorkMetadata | null | undefined {
    const raw = work.metadata?.trim();
    if (!raw) return null;
    return (
      parseInlineWorkMetadata(raw) ??
      this.context.client.getQueryData<WorkMetadata>(worksKeys.metadata(raw)) ??
      undefined
    );
  }

  private addWork(garden: string, work: EASWork): void {
    const metadata = this.knownMetadata(work);
    if (metadata === undefined) {
      this.tasks.push({ kind: "details", garden, work });
      this.total += 1;
    } else if (this.inPhotoScope(garden, work)) {
      for (const url of photoUrls(work, metadata)) this.addPhoto(garden, url);
    }
  }

  private followGardenInView(): void {
    const inView = this.context.gardenInView();
    if (!inView || sameAddress(inView, this.photoGarden)) return;
    this.photoGarden = inView;
    const garden = this.context.gardens.find((candidate) => sameAddress(candidate.id, inView));
    if (garden?.bannerImage) {
      const banner = displayImageUrl(resolveIPFSUrl(garden.bannerImage));
      if (isKeptMediaUrl(banner)) this.addPhoto(inView, banner);
    }
    const works = this.listed.get(inView.toLowerCase());
    if (works) {
      for (const work of works) this.addWork(inView, work);
    } else if (
      !this.tasks.some((task) => task.kind === "list" && sameAddress(task.garden, inView))
    ) {
      this.tasks.push({ kind: "list", garden: garden?.id ?? inView });
      this.total += 1;
    }
  }

  /** Garden in view first, then every joined list, the account's own work, then other details. */
  private sort(): void {
    const inView = this.context.gardenInView();
    const rank = (task: OfflineTask) => {
      if (task.kind === "approvals") return 0;
      const viewed = sameAddress(task.garden, inView);
      if (task.kind === "list") return viewed ? 1 : 3;
      if (task.kind === "photo") return viewed || task.garden === "" ? 2 : 4;
      return viewed ? 2 : sameAddress(task.work.gardenerAddress, this.context.account) ? 4 : 5;
    };
    this.tasks.sort((left, right) => rank(left) - rank(right));
  }
}
