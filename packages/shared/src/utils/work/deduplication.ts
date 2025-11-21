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
    return parsed.clientWorkId || null;
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
export function mergeAndDeduplicateByClientId<T extends { metadata?: string; createdAt: number }>(
  onlineWorks: T[],
  offlineWorks: T[]
): T[] {
  // Build set of clientWorkIds from online works
  const onlineClientIds = new Set(
    onlineWorks.map((w) => extractClientWorkId(w.metadata)).filter(Boolean)
  );

  // Filter out offline works that have been uploaded (matching clientWorkId)
  const dedupedOffline = offlineWorks.filter((work) => {
    const clientWorkId = extractClientWorkId(work.metadata);
    return !clientWorkId || !onlineClientIds.has(clientWorkId);
  });

  // Merge and sort by creation time (newest first)
  return [...onlineWorks, ...dedupedOffline].sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Deduplicate works using fuzzy matching (actionUID + time proximity)
 *
 * Used when clientWorkId is not available. Considers works duplicates if they have
 * the same actionUID and were created within a 5-minute window.
 *
 * @param onlineWorks - Works fetched from blockchain/indexer
 * @param offlineWorks - Pending local works from job queue
 * @param timeWindowMs - Time window for fuzzy matching (default: 5 minutes)
 * @returns Deduplicated offline works (online works are always kept)
 */
export function deduplicateByFuzzyMatch<T extends { actionUID: number; createdAt: number }>(
  onlineWorks: T[],
  offlineWorks: T[],
  timeWindowMs = 5 * 60 * 1000
): T[] {
  return offlineWorks.filter((offlineWork) => {
    const isDuplicate = onlineWorks.some((onlineWork) => {
      const timeDiff = Math.abs(onlineWork.createdAt - offlineWork.createdAt);
      return onlineWork.actionUID === offlineWork.actionUID && timeDiff < timeWindowMs;
    });
    return !isDuplicate;
  });
}
