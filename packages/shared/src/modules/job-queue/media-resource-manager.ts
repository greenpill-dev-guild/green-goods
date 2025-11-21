/**
 * Centralized Media Resource Manager
 * Handles creation and cleanup of object URLs to prevent memory leaks
 */
class MediaResourceManager {
  private urlMap = new Map<string, string[]>();
  private globalUrls = new Set<string>();
  private urlCache = new Map<string, { file: File; url: string }>();

  /**
   * Create object URLs for files and track them for cleanup
   */
  createUrls(files: File[], trackingId?: string): string[] {
    const urls = files.map((file) => URL.createObjectURL(file));

    // Track URLs globally
    urls.forEach((url) => this.globalUrls.add(url));

    // Track URLs by ID if provided
    if (trackingId) {
      const existingUrls = this.urlMap.get(trackingId) || [];
      this.urlMap.set(trackingId, [...existingUrls, ...urls]);
    }

    return urls;
  }

  /**
   * Create a single object URL for a file
   */
  createUrl(file: File, trackingId?: string): string {
    const url = URL.createObjectURL(file);
    this.globalUrls.add(url);

    if (trackingId) {
      const existingUrls = this.urlMap.get(trackingId) || [];
      this.urlMap.set(trackingId, [...existingUrls, url]);
    }

    return url;
  }

  /**
   * Get or create URL - returns cached URL if file already has one
   * Prevents memory leaks from creating duplicate URLs on re-renders
   */
  getOrCreateUrl(file: File, trackingId: string): string {
    const cacheKey = `${trackingId}-${file.name}-${file.size}-${file.lastModified}`;
    const cached = this.urlCache.get(cacheKey);

    if (cached && cached.file === file) {
      return cached.url;
    }

    const url = this.createUrl(file, trackingId);
    this.urlCache.set(cacheKey, { file, url });

    return url;
  }

  /**
   * Cleanup URLs associated with a specific tracking ID
   */
  cleanupUrls(trackingId: string): void {
    const urls = this.urlMap.get(trackingId);
    if (urls) {
      urls.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
          this.globalUrls.delete(url);
        } catch (error) {
          // Silently handle revocation errors (URL might already be revoked)
          console.debug("Failed to revoke URL:", url, error);
        }
      });
      this.urlMap.delete(trackingId);
    }

    // Clear cache entries for this tracking ID
    for (const [key] of this.urlCache.entries()) {
      if (key.startsWith(trackingId)) {
        this.urlCache.delete(key);
      }
    }
  }

  /**
   * Cleanup a specific URL
   */
  cleanupUrl(url: string): void {
    try {
      URL.revokeObjectURL(url);
      this.globalUrls.delete(url);

      // Remove from tracking maps
      for (const [id, urls] of this.urlMap.entries()) {
        const index = urls.indexOf(url);
        if (index !== -1) {
          urls.splice(index, 1);
          if (urls.length === 0) {
            this.urlMap.delete(id);
          }
          break;
        }
      }
    } catch (error) {
      console.debug("Failed to revoke URL:", url, error);
    }
  }

  /**
   * Cleanup all tracked URLs
   */
  cleanupAll(): void {
    // Cleanup all globally tracked URLs
    for (const url of this.globalUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        console.debug("Failed to revoke URL during cleanup:", url, error);
      }
    }

    this.globalUrls.clear();
    this.urlMap.clear();
  }

  /**
   * Get cleanup statistics for debugging
   */
  getStats(): { totalUrls: number; trackedIds: number } {
    return {
      totalUrls: this.globalUrls.size,
      trackedIds: this.urlMap.size,
    };
  }

  /**
   * Cleanup stale URLs older than specified age
   */
  cleanupStale(_maxAgeMs: number = 60 * 60 * 1000): void {
    // This would require tracking creation timestamps
    // For now, we'll implement a simple cleanup of all URLs
    // In a production app, you'd want to track creation times
    console.debug("Performing stale URL cleanup");
    this.cleanupAll();
  }
}

// Export singleton instance
export const mediaResourceManager = new MediaResourceManager();

// Cleanup on page unload to prevent memory leaks
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    mediaResourceManager.cleanupAll();
  });
}
