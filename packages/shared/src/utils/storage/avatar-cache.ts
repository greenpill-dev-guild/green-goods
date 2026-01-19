/**
 * Local storage cache for ENS avatars to support offline viewing.
 * Caches avatar URLs by address for quick lookup.
 */

import { debugError, debugWarn } from "../debug";

const AVATAR_CACHE_KEY = "greengoods_ens_avatar_cache";
const CACHE_VERSION = 1;
const MAX_CACHE_SIZE = 100; // Maximum number of avatars to cache
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

interface AvatarCacheEntry {
  address: string;
  avatarUrl: string;
  cachedAt: number;
}

interface AvatarCache {
  version: number;
  entries: AvatarCacheEntry[];
}

function getCache(): AvatarCache {
  try {
    const cached = localStorage.getItem(AVATAR_CACHE_KEY);
    if (!cached) {
      return { version: CACHE_VERSION, entries: [] };
    }
    const parsed = JSON.parse(cached) as AvatarCache;
    if (parsed.version !== CACHE_VERSION) {
      debugWarn("Avatar cache version mismatch, clearing cache", {
        cachedVersion: parsed.version,
        expectedVersion: CACHE_VERSION,
      });
      return { version: CACHE_VERSION, entries: [] };
    }
    return parsed;
  } catch (error) {
    debugError("Failed to load avatar cache", error, { key: AVATAR_CACHE_KEY });
    return { version: CACHE_VERSION, entries: [] };
  }
}

function setCache(cache: AvatarCache): void {
  try {
    localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    debugError("Failed to save avatar cache", error, {
      key: AVATAR_CACHE_KEY,
      entryCount: cache.entries.length,
    });
  }
}

/**
 * Get a cached avatar URL for an address
 */
export function getCachedAvatar(address: string): string | null {
  const cache = getCache();
  const normalized = address.toLowerCase();
  const entry = cache.entries.find((e) => e.address === normalized);

  if (!entry) return null;

  // Check if cache is expired
  const now = Date.now();
  if (now - entry.cachedAt > CACHE_DURATION) {
    // Remove expired entry
    cache.entries = cache.entries.filter((e) => e.address !== normalized);
    setCache(cache);
    return null;
  }

  return entry.avatarUrl;
}

/**
 * Cache an avatar URL for an address
 */
export function cacheAvatar(address: string, avatarUrl: string): void {
  const cache = getCache();
  const normalized = address.toLowerCase();
  const now = Date.now();

  // Remove existing entry if present
  cache.entries = cache.entries.filter((e) => e.address !== normalized);

  // Add new entry at the beginning (most recent)
  cache.entries.unshift({
    address: normalized,
    avatarUrl,
    cachedAt: now,
  });

  // Trim cache if too large (keep most recent entries)
  if (cache.entries.length > MAX_CACHE_SIZE) {
    cache.entries = cache.entries.slice(0, MAX_CACHE_SIZE);
  }

  setCache(cache);
}

/**
 * Clear all cached avatars
 */
export function clearAvatarCache(): void {
  try {
    localStorage.removeItem(AVATAR_CACHE_KEY);
  } catch (error) {
    debugError("Failed to clear avatar cache", error, { key: AVATAR_CACHE_KEY });
  }
}

/**
 * Remove a specific avatar from cache
 */
export function removeCachedAvatar(address: string): void {
  const cache = getCache();
  const normalized = address.toLowerCase();
  cache.entries = cache.entries.filter((e) => e.address !== normalized);
  setCache(cache);
}
