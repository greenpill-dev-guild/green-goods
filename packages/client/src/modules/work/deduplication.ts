/**
 * @fileoverview Work Deduplication System for Green Goods Application
 *
 * This module provides comprehensive deduplication mechanisms to prevent
 * duplicate work submissions in the Green Goods ecosystem. Key features include:
 *
 * - Content-based hashing for duplicate detection
 * - Local and remote duplicate checking
 * - Configurable deduplication policies
 * - Similarity analysis and fuzzy matching
 * - Batch processing for efficiency
 * - Time-window based duplicate detection
 *
 * The DeduplicationManager ensures data integrity by preventing users from
 * accidentally submitting the same work multiple times, while allowing for
 * legitimate similar submissions when appropriate.
 *
 * @author Green Goods Team
 * @version 1.0.0
 */

/**
 * CURRENT STATUS (Temporarily Disabled):
 * - Deduplication is not required right now and remote API does not exist.
 * - The implementation remains for future use, but all checks are no-ops.
 * - performComprehensiveCheck() returns a non-duplicate result and does not
 *   perform any network calls or local matching.
 *
 * To re-enable:
 * - Remove the early returns in performComprehensiveCheck() and
 *   checkRemoteDuplicate(), and wire up a real API endpoint if needed.
 */

/**
 * Configuration options for deduplication behavior
 */
export interface DuplicationConfig {
  /** Base URL for API endpoints */
  apiBaseUrl: string;
  /** Time window for duplicate detection in milliseconds */
  timeWindow: number;
  /** Whether to include images in duplicate detection */
  includeImages: boolean;
  /** Hash algorithm to use for content fingerprinting */
  hashAlgorithm: "simple" | "sha256";
  /** Fields to ignore when generating content hashes */
  ignoreFields: string[];
}

/**
 * Result of a duplicate check operation
 */
export interface DuplicateCheckResult {
  /** Whether a duplicate was found */
  isDuplicate: boolean;
  /** ID of the existing work item if duplicate found */
  existingWorkId?: string;
  /** Similarity score (0-1) between items */
  similarity?: number;
  /** Type of conflict detected */
  conflictType?: "exact" | "similar" | "none";
}

/**
 * Result of local duplicate detection
 */
export interface LocalDuplicateResult {
  /** Whether a local duplicate exists */
  isDuplicate: boolean;
  /** Array of existing work item IDs that match */
  existingItems: string[];
  /** Content hash used for comparison */
  contentHash: string;
}

/**
 * Manages work deduplication using content hashing and similarity analysis.
 *
 * This class provides both local and remote deduplication capabilities:
 * - Local cache for fast duplicate detection
 * - Remote API integration for distributed duplicate checking
 * - Configurable hashing algorithms and policies
 * - Batch processing for large datasets
 * - Similarity scoring for fuzzy matching
 *
 * The deduplication process works by:
 * 1. Generating content hashes from work data
 * 2. Checking local cache for exact matches
 * 3. Querying remote API for distributed duplicates
 * 4. Analyzing similarity scores for near-duplicates
 *
 * @example
 * ```typescript
 * const deduplicationManager = new DeduplicationManager({
 *   timeWindow: 24 * 60 * 60 * 1000, // 24 hours
 *   includeImages: true,
 *   hashAlgorithm: 'simple'
 * });
 *
 * // Check for duplicates before submission
 * const result = await deduplicationManager.performComprehensiveCheck(workData);
 * if (result.isDuplicate) {
 *   console.log(`Duplicate found: ${result.existingWorkId}`);
 * } else {
 *   // Safe to submit
 *   await submitWork(workData);
 *   deduplicationManager.addToLocalCache(workId, workData);
 * }
 * ```
 */
export class DeduplicationManager {
  private config: DuplicationConfig;
  private localHashes: Map<string, string[]> = new Map(); // hash -> workIds[]

  /**
   * Creates a new DeduplicationManager instance with specified configuration
   *
   * @param config - Partial configuration object (uses defaults for missing values)
   */
  constructor(config: Partial<DuplicationConfig> = {}) {
    this.config = {
      apiBaseUrl: "/api",
      timeWindow: 24 * 60 * 60 * 1000, // 24 hours
      includeImages: false, // Disabled by default while dedup is off
      hashAlgorithm: "simple",
      ignoreFields: ["id", "createdAt", "updatedAt", "timestamp", "lastModified"],
      ...config,
    };
  }

  /**
   * Generates a content-based hash for work data using feedback as core element
   *
   * This method creates a deterministic hash from the specified content fields:
   * - gardenAddress: The garden where work is submitted
   * - feedback: The core work content (primary hashing element)
   * - type: The type of work submission
   * - imageHashes: Unique identifiers for associated images
   * - actionIdWithChain: Action ID prefixed with chain ID for uniqueness
   *
   * @param workData - The work data object to hash
   * @returns A unique content hash string
   */
  generateContentHash(workData: any): string {
    const data = workData.data || {};

    // Generate image hashes for unique image identification
    const imageHashes = this.config.includeImages
      ? this.generateImageHashes(workData.images || [])
      : [];

    // Get chainId from various possible sources
    const chainId = workData.chainId || data.chainId || this.getDefaultChainId();

    // Create hash from the specified core content fields
    const contentForHash = {
      gardenAddress: data.gardenAddress || workData.gardenAddress || "",
      feedback: data.feedback || workData.feedback || "",
      type: workData.type || "work",
      imageHashes: imageHashes,
      actionIdWithChain: `${chainId}:${data.actionUID || workData.actionUID || 0}`,
    };

    // Create stable JSON string with sorted keys
    const hashInput = JSON.stringify(contentForHash, Object.keys(contentForHash).sort());

    return this.generateSafeHash(hashInput);
  }

  /**
   * Generates hashes for image files
   *
   * This method creates unique identifiers for image files based on their properties.
   * For File objects, it uses name, size, type, and last modified date.
   * For URLs or other formats, it uses the string representation.
   *
   * @param images - Array of images (File objects, URLs, or other formats)
   * @returns Array of image hashes sorted for consistency
   * @private
   */
  private generateImageHashes(images: any[]): string[] {
    if (!images || images.length === 0) {
      return [];
    }

    const imageHashes = images.map((image, index) => {
      try {
        if (image instanceof File) {
          // Generate hash from file properties (synchronous)
          const hashInput = `${image.name}-${image.size}-${image.type}-${image.lastModified || 0}`;
          return this.generateSafeHash(hashInput);
        } else if (typeof image === "string") {
          // For URL strings, use the URL itself
          return this.generateSafeHash(image);
        } else if (image && typeof image === "object") {
          // For objects with url/id properties
          const hashInput = image.url || image.id || image.src || JSON.stringify(image);
          return this.generateSafeHash(hashInput);
        } else {
          // Fallback: use string representation
          return this.generateSafeHash(String(image));
        }
      } catch (error) {
        console.warn(`Failed to hash image at index ${index}:`, error);
        // Fallback hash for failed image processing
        return this.generateSafeHash(`image-${index}-fallback`);
      }
    });

    return imageHashes.sort(); // Sort for consistency
  }

  /**
   * Gets the default chain ID from environment or fallback
   *
   * @returns Default chain ID (Base Sepolia: 84532)
   * @private
   */
  private getDefaultChainId(): number {
    // Try to get from environment variable first
    const envChainId = import.meta.env.VITE_CHAIN_ID;
    if (envChainId && !isNaN(Number(envChainId))) {
      return Number(envChainId);
    }

    // Fallback to Base Sepolia
    return 84532;
  }

  /**
   * Generates a safe, collision-resistant hash from input string
   *
   * This method uses a combination of character-based hashing, length
   * encoding, and checksums to create a hash that minimizes collisions
   * while remaining deterministic and fast to compute.
   *
   * @param input - The string to hash
   * @returns A collision-resistant hash string
   * @private
   */
  private generateSafeHash(input: string): string {
    // Use a proper hash function instead of base64 encoding
    // This ensures different inputs always produce different outputs
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Create a longer, more unique hash
    const hashStr = Math.abs(hash).toString(16).padStart(8, "0");

    // Add input length and a simple checksum for better uniqueness
    const length = input.length.toString(16).padStart(4, "0");
    const checksum = (input.length * 31 + hash) & 0xffffffff;
    const checksumStr = Math.abs(checksum).toString(16).padStart(8, "0");

    return hashStr + length + checksumStr;
  }

  // private generateSHA256Hash(input: string): string {
  //   // For production, use Web Crypto API
  //   // This is a simplified version for testing
  //   let hash = 0;
  //   for (let i = 0; i < input.length; i++) {
  //     const char = input.charCodeAt(i);
  //     hash = (hash << 5) - hash + char;
  //     hash = hash & hash; // Convert to 32-bit integer
  //   }
  //   // Use longer hash for better uniqueness
  //   return Math.abs(hash).toString(16).padStart(16, "0");
  // }

  /**
   * Checks for duplicates via remote API
   *
   * This method queries the backend API to check for duplicates across
   * the entire system, including work submitted by other users. It uses
   * the content hash and time window to identify potential duplicates.
   *
   * @param workData - The work data to check for duplicates
   * @returns Promise resolving to true if a remote duplicate exists
   */
  async checkRemoteDuplicate(workData: any): Promise<boolean> {
    // No-op while deduplication is disabled
    void workData;
    return false;
  }

  /**
   * Checks for duplicates in the local cache
   *
   * This method provides fast duplicate detection by checking against
   * locally cached work hashes. It's the first line of defense against
   * duplicates and provides immediate feedback without network requests.
   *
   * @param workData - The work data to check for local duplicates
   * @returns Object containing duplicate status and matching item details
   */
  checkLocalDuplicate(workData: any): LocalDuplicateResult {
    const contentHash = this.generateContentHash(workData);
    const existingItems = this.localHashes.get(contentHash) || [];

    return {
      isDuplicate: existingItems.length > 0,
      existingItems,
      contentHash,
    };
  }

  /**
   * Adds a work item to the local deduplication cache
   *
   * This method should be called after successfully submitting work
   * to ensure future submissions can be checked against it. The cache
   * is used for fast local duplicate detection.
   *
   * @param workId - Unique identifier for the work item
   * @param workData - The work data object
   */
  addToLocalCache(workId: string, workData: any): void {
    const contentHash = this.generateContentHash(workData);
    const existing = this.localHashes.get(contentHash) || [];

    if (!existing.includes(workId)) {
      existing.push(workId);
      this.localHashes.set(contentHash, existing);
    }
  }

  /**
   * Removes a work item from the local deduplication cache
   *
   * This method should be called when work is deleted or invalidated
   * to ensure the cache remains accurate. It supports both targeted
   * removal (with workData) and general cleanup (without workData).
   *
   * @param workId - Unique identifier for the work item to remove
   * @param workData - Optional work data for targeted removal
   */
  removeFromLocalCache(workId: string, workData?: any): void {
    if (workData) {
      const contentHash = this.generateContentHash(workData);
      const existing = this.localHashes.get(contentHash) || [];
      const filtered = existing.filter((id) => id !== workId);

      if (filtered.length === 0) {
        this.localHashes.delete(contentHash);
      } else {
        this.localHashes.set(contentHash, filtered);
      }
    } else {
      // Remove from all hashes if workData not provided
      for (const [hash, workIds] of this.localHashes.entries()) {
        const filtered = workIds.filter((id) => id !== workId);
        if (filtered.length === 0) {
          this.localHashes.delete(hash);
        } else {
          this.localHashes.set(hash, filtered);
        }
      }
    }
  }

  /**
   * Normalizes data by removing ignored fields and standardizing structure
   *
   * This method recursively processes work data to create a normalized
   * representation suitable for hashing. It removes timestamps, IDs,
   * and other metadata that shouldn't affect duplicate detection.
   *
   * @param data - The data object to normalize
   * @returns Normalized data object
   * @private
   */
  private normalizeData(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data !== "object") {
      return data;
    }

    // Handle arrays properly - keep them as arrays
    if (Array.isArray(data)) {
      return data.map((item) => this.normalizeData(item));
    }

    const normalized: any = {};

    for (const [key, value] of Object.entries(data)) {
      // Skip ignored fields and nested timestamp fields
      if (
        this.config.ignoreFields.includes(key) ||
        ["createdAt", "updatedAt", "timestamp", "lastModified"].includes(key)
      ) {
        continue;
      }

      // Recursively normalize nested objects and arrays
      if (typeof value === "object" && value !== null) {
        const normalizedValue = this.normalizeData(value);
        // Only include if not empty after normalization
        if (Array.isArray(normalizedValue)) {
          if (normalizedValue.length > 0) {
            normalized[key] = normalizedValue;
          }
        } else if (typeof normalizedValue === "object") {
          if (Object.keys(normalizedValue).length > 0) {
            normalized[key] = normalizedValue;
          }
        } else {
          normalized[key] = normalizedValue;
        }
      } else {
        normalized[key] = value;
      }
    }

    // Add image count if including images
    if (this.config.includeImages && data.images) {
      normalized._imageCount = Array.isArray(data.images) ? data.images.length : 0;
    }

    return normalized;
  }

  /**
   * Performs comprehensive duplicate checking using both local and remote sources
   *
   * This method combines local cache checking with remote API validation
   * to provide thorough duplicate detection. It first checks the local
   * cache for fast results, then validates against the remote system.
   *
   * @param workData - The work data to check for duplicates
   * @returns Promise resolving to comprehensive duplicate check results
   */
  async performComprehensiveCheck(workData: any): Promise<DuplicateCheckResult> {
    // No-op: deduplication is currently disabled; always allow submission
    void workData;
    return {
      isDuplicate: false,
      conflictType: "none",
    };
  }

  /**
   * Clears all entries from the local deduplication cache
   *
   * This method removes all cached hashes, effectively resetting the
   * local duplicate detection system. Use with caution as it may allow
   * previously detected local duplicates to be submitted again.
   */
  clearLocalCache(): void {
    this.localHashes.clear();
  }

  /**
   * Generates statistics about the local deduplication cache
   *
   * @returns Object containing cache statistics and metrics
   */
  getLocalCacheStats(): {
    uniqueHashes: number;
    totalWorkItems: number;
    averageItemsPerHash: number;
  } {
    const uniqueHashes = this.localHashes.size;
    const totalWorkItems = Array.from(this.localHashes.values()).reduce(
      (sum, items) => sum + items.length,
      0
    );
    const averageItemsPerHash = uniqueHashes > 0 ? totalWorkItems / uniqueHashes : 0;

    return {
      uniqueHashes,
      totalWorkItems,
      averageItemsPerHash,
    };
  }

  /**
   * Updates the deduplication configuration
   *
   * @param newConfig - Partial configuration to merge with current settings
   */
  setConfig(newConfig: Partial<DuplicationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Retrieves the current deduplication configuration
   *
   * @returns Copy of the current configuration
   */
  getConfig(): DuplicationConfig {
    return { ...this.config };
  }

  /**
   * Checks multiple work items for duplicates in batch
   *
   * This method processes multiple work items efficiently by batching
   * API requests and processing items in parallel where possible.
   *
   * @param workItems - Array of work items to check
   * @returns Promise resolving to Map of work IDs to duplicate check results
   */
  async checkMultipleDuplicates(workItems: any[]): Promise<Map<string, DuplicateCheckResult>> {
    const results = new Map<string, DuplicateCheckResult>();

    // Process in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < workItems.length; i += batchSize) {
      const batch = workItems.slice(i, i + batchSize);
      const batchPromises = batch.map(async (work) => {
        const result = await this.performComprehensiveCheck(work);
        return [work.id, result] as [string, DuplicateCheckResult];
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(([workId, result]) => {
        results.set(workId, result);
      });
    }

    return results;
  }

  /**
   * Finds work items with similar content based on hash similarity
   *
   * This method performs fuzzy matching to find work items that are
   * similar but not exact duplicates. Useful for identifying related
   * submissions or potential near-duplicates.
   *
   * @param workData - The work data to find similar items for
   * @param threshold - Similarity threshold (0-1, default: 0.8)
   * @returns Array of work IDs with similar content
   */
  findSimilarWork(workData: any, threshold: number = 0.8): string[] {
    const targetHash = this.generateContentHash(workData);
    const similar: string[] = [];

    for (const [hash, workIds] of this.localHashes.entries()) {
      if (hash !== targetHash) {
        // Simple similarity check - in production, use more sophisticated algorithms
        const similarity = this.calculateHashSimilarity(targetHash, hash);
        if (similarity >= threshold) {
          similar.push(...workIds);
        }
      }
    }

    return similar;
  }

  /**
   * Calculates similarity between two hash strings
   *
   * This method provides a simple character-based similarity score
   * between two hash strings. In production, this could be replaced
   * with more sophisticated similarity algorithms.
   *
   * @param hash1 - First hash string
   * @param hash2 - Second hash string
   * @returns Similarity score between 0 and 1
   * @private
   */
  private calculateHashSimilarity(hash1: string, hash2: string): number {
    if (hash1 === hash2) return 1.0;

    // Simple character-based similarity
    let matches = 0;
    const minLength = Math.min(hash1.length, hash2.length);

    for (let i = 0; i < minLength; i++) {
      if (hash1[i] === hash2[i]) {
        matches++;
      }
    }

    return matches / Math.max(hash1.length, hash2.length);
  }
}

/**
 * Default DeduplicationManager instance for use throughout the application
 *
 * This singleton instance provides consistent deduplication behavior
 * across the entire application and maintains a centralized cache.
 */
export const defaultDeduplicationManager = new DeduplicationManager();
