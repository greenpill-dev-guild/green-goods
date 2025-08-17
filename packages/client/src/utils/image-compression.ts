import imageCompression from "browser-image-compression";
import { track } from "@/modules/posthog";

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  maxIteration?: number;
  exifOrientation?: number;
  fileType?: string;
  initialQuality?: number;
  alwaysKeepResolution?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  quality?: number;
}

export interface CompressionStats {
  totalOriginalSize: number;
  totalCompressedSize: number;
  totalSaved: number;
  averageCompressionRatio: number;
  filesProcessed: number;
}

/**
 * Intelligent Image Compressor using browser-image-compression
 * Provides automatic compression with intelligent settings based on file size and content
 */
class ImageCompressor {
  private readonly defaultOptions: CompressionOptions = {
    maxSizeMB: 1,
    maxWidthOrHeight: 2048,
    useWebWorker: true,
    maxIteration: 10,
    initialQuality: 0.8,
    alwaysKeepResolution: false,
  };

  /**
   * Compress a single image with intelligent settings
   */
  async compressImage(
    file: File,
    customOptions?: CompressionOptions,
    onProgress?: (progress: number, fileName: string) => void
  ): Promise<CompressionResult> {
    const startTime = Date.now();
    const originalSize = file.size;

    try {
      // Get intelligent compression settings
      const options = this.getIntelligentSettings(file, customOptions);

      // Track compression start
      track("image_compression_started", {
        file_name: file.name,
        original_size: originalSize,
        target_size_mb: options.maxSizeMB,
        max_dimension: options.maxWidthOrHeight,
      });

      // Set up progress callback
      if (onProgress) {
        options.onProgress = (progress) => onProgress(progress, file.name);
      }

      // Compress the image
      const compressedFile = await imageCompression(file, options);
      const compressedSize = compressedFile.size;
      const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

      const result: CompressionResult = {
        file: compressedFile,
        originalSize,
        compressedSize,
        compressionRatio,
        quality: options.initialQuality,
      };

      // Track successful compression
      track("image_compression_completed", {
        file_name: file.name,
        original_size: originalSize,
        compressed_size: compressedSize,
        compression_ratio: compressionRatio,
        processing_time: Date.now() - startTime,
        quality_used: options.initialQuality,
      });

      return result;
    } catch (error) {
      track("image_compression_failed", {
        file_name: file.name,
        original_size: originalSize,
        error: error instanceof Error ? error.message : "Unknown error",
        processing_time: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Compress multiple images with progress tracking
   */
  async compressImages(
    files: File[],
    customOptions?: CompressionOptions,
    onProgress?: (progress: number, fileName: string) => void
  ): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];
    const totalFiles = files.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileProgress = (i / totalFiles) * 100;

      try {
        const result = await this.compressImage(file, customOptions, (progress, fileName) => {
          // Calculate overall progress: file progress + current file's progress within its slot
          const overallProgress = fileProgress + progress / totalFiles;
          onProgress?.(overallProgress, fileName);
        });

        results.push(result);
      } catch (error) {
        console.error(`Failed to compress ${file.name}:`, error);
        // Include original file if compression fails
        results.push({
          file,
          originalSize: file.size,
          compressedSize: file.size,
          compressionRatio: 0,
        });
      }
    }

    // Complete progress
    onProgress?.(100, "Compression complete");

    return results;
  }

  /**
   * Get intelligent compression settings based on file characteristics
   */
  private getIntelligentSettings(
    file: File,
    customOptions?: CompressionOptions
  ): CompressionOptions {
    const fileSizeMB = file.size / (1024 * 1024);

    // Base settings on file size
    let settings: CompressionOptions;

    if (fileSizeMB > 10) {
      // Large files: aggressive compression
      settings = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        initialQuality: 0.7,
      };
    } else if (fileSizeMB > 5) {
      // Medium-large files: moderate compression
      settings = {
        maxSizeMB: 1.5,
        maxWidthOrHeight: 2048,
        initialQuality: 0.75,
      };
    } else if (fileSizeMB > 2) {
      // Medium files: light compression
      settings = {
        maxSizeMB: 1,
        maxWidthOrHeight: 2048,
        initialQuality: 0.8,
      };
    } else {
      // Small files: minimal compression
      settings = {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 2048,
        initialQuality: 0.85,
      };
    }

    // Merge with defaults and custom options
    return {
      ...this.defaultOptions,
      ...settings,
      ...customOptions,
    };
  }

  /**
   * Progressive compression - try multiple quality levels until target is met
   */
  async progressiveCompress(
    file: File,
    targetSizeMB: number,
    onProgress?: (progress: number, fileName: string) => void
  ): Promise<CompressionResult> {
    const maxAttempts = 5;
    let quality = 0.9;
    let attempt = 0;

    while (attempt < maxAttempts) {
      try {
        const options: CompressionOptions = {
          maxSizeMB: targetSizeMB,
          initialQuality: quality,
          maxWidthOrHeight: 2048,
          useWebWorker: true,
        };

        const result = await this.compressImage(file, options, onProgress);

        // If we hit the target, return the result
        if (result.compressedSize <= targetSizeMB * 1024 * 1024) {
          return result;
        }

        // Reduce quality for next attempt
        quality -= 0.15;
        attempt++;
      } catch (error) {
        console.error(`Progressive compression attempt ${attempt + 1} failed:`, error);
        break;
      }
    }

    // Fallback to default compression if progressive fails
    return this.compressImage(file, { maxSizeMB: targetSizeMB });
  }

  /**
   * Check if a file should be compressed based on size threshold
   */
  shouldCompress(file: File, thresholdKB: number = 500): boolean {
    const fileSizeKB = file.size / 1024;
    return fileSizeKB > thresholdKB && file.type.startsWith("image/");
  }

  /**
   * Get compression statistics from results
   */
  getCompressionStats(results: CompressionResult[]): CompressionStats {
    const totalOriginalSize = results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalCompressedSize = results.reduce((sum, r) => sum + r.compressedSize, 0);
    const totalSaved = totalOriginalSize - totalCompressedSize;
    const averageCompressionRatio =
      results.reduce((sum, r) => sum + r.compressionRatio, 0) / results.length;

    return {
      totalOriginalSize,
      totalCompressedSize,
      totalSaved,
      averageCompressionRatio,
      filesProcessed: results.length,
    };
  }
}

// Export singleton instance
export const imageCompressor = new ImageCompressor();

// Utility functions
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function calculateCompressionRatio(originalSize: number, compressedSize: number): number {
  return ((originalSize - compressedSize) / originalSize) * 100;
}
