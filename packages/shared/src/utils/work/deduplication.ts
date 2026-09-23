/**
 * Work Deduplication Utilities
 *
 * Shared utilities for deduplicating work submissions across online/offline sources.
 *
 * @module utils/work/deduplication
 */

/**
 * Deduplicate items by ID (removes duplicates, keeps first occurrence)
 */
export function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/**
 * Extract clientWorkId from work metadata
 */
export function extractClientWorkId(metadata?: string | null): string | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata);
    return typeof parsed?.clientWorkId === "string" && parsed.clientWorkId.length > 0
      ? parsed.clientWorkId
      : null;
  } catch {
    return null;
  }
}

/**
 * Merge online and offline works, deduplicating by clientWorkId
 *
 * Online works take precedence. Offline works are filtered out if they match
 * an online work's clientWorkId.
 *
 * @param onlineWorks - Works fetched from blockchain/indexer
 * @param offlineWorks - Pending local works from job queue
 * @returns Merged and deduplicated work array, sorted by creation time (newest first)
 */
export function mergeAndDeduplicateByClientId<
  T extends {
    metadata?: string;
    createdAt: number;
    gardenerAddress?: string;
    gardenAddress?: string;
  },
>(onlineWorks: T[], offlineWorks: T[]): T[] {
  const identity = (work: T) => {
    const clientWorkId = extractClientWorkId(work.metadata);
    return clientWorkId
      ? `${work.gardenAddress?.toLowerCase() ?? ""}:${work.gardenerAddress?.toLowerCase() ?? ""}:${clientWorkId}`
      : null;
  };
  // Build set of scoped identities from online works
  const onlineClientIds = new Set(onlineWorks.map(identity).filter(Boolean));

  // Filter out offline works that have been uploaded (matching clientWorkId)
  const dedupedOffline = offlineWorks.filter((work) => {
    const key = identity(work);
    return !key || !onlineClientIds.has(key);
  });

  // Merge and sort by creation time (newest first)
  return [...onlineWorks, ...dedupedOffline].sort((a, b) => b.createdAt - a.createdAt);
}
