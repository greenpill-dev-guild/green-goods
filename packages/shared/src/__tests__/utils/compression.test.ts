import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  compress,
  decompress,
  compressJSON,
  decompressJSON,
  getCompressionRatio,
  isCompressionSupported,
} from "../../utils/compression";

describe("Compression Utilities", () => {
  // Check if we're in an environment with compression support
  const hasCompressionSupport =
    typeof globalThis.CompressionStream !== "undefined" &&
    typeof globalThis.DecompressionStream !== "undefined";

  describe("isCompressionSupported", () => {
    it("returns boolean indicating compression support", () => {
      expect(typeof isCompressionSupported()).toBe("boolean");
    });
  });

  describe("when compression is supported", () => {
    beforeEach(() => {
      if (!hasCompressionSupport) {
        // Skip tests that require compression support
        return;
      }
    });

    it.skipIf(!hasCompressionSupport)(
      "compress and decompress should round-trip text",
      async () => {
        const original = "Hello, World! ".repeat(100);
        const compressed = await compress(original);
        const decompressed = await decompress(compressed);
        expect(decompressed).toBe(original);
      }
    );

    it.skipIf(!hasCompressionSupport)(
      "compressed data should be smaller than original for repetitive content",
      async () => {
        const original = "Hello, World! ".repeat(1000);
        const compressed = await compress(original);
        expect(compressed.byteLength).toBeLessThan(original.length);
      }
    );

    it.skipIf(!hasCompressionSupport)(
      "compressJSON and decompressJSON should round-trip objects",
      async () => {
        const original = {
          name: "Green Goods",
          version: 1,
          features: ["offline", "pwa", "blockchain"],
          nested: { deep: { value: 42 } },
        };
        const compressedBlob = await compressJSON(original);

        // Convert Blob to ArrayBuffer for decompressJSON
        // Use FileReader for jsdom compatibility (Blob.arrayBuffer() not available in all environments)
        const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(compressedBlob);
        });

        const decompressed = await decompressJSON<typeof original>(buffer);
        expect(decompressed).toEqual(original);
      }
    );

    it.skipIf(!hasCompressionSupport)("should handle ArrayBuffer input", async () => {
      const encoder = new TextEncoder();
      const original = encoder.encode("Test data for compression");
      const compressed = await compress(original.buffer);
      const decompressed = await decompress(compressed);
      expect(decompressed).toBe("Test data for compression");
    });

    it.skipIf(!hasCompressionSupport)("should support different compression formats", async () => {
      const original = "Test deflate compression";
      const compressed = await compress(original, "deflate");
      const decompressed = await decompress(compressed, "deflate");
      expect(decompressed).toBe(original);
    });
  });

  describe("when compression is not supported", () => {
    let originalCompressionStream: typeof CompressionStream | undefined;
    let originalDecompressionStream: typeof DecompressionStream | undefined;

    beforeEach(() => {
      // Save original values
      originalCompressionStream = globalThis.CompressionStream;
      originalDecompressionStream = globalThis.DecompressionStream;
      // Remove compression support
      // @ts-expect-error - intentionally removing for test
      delete globalThis.CompressionStream;
      // @ts-expect-error - intentionally removing for test
      delete globalThis.DecompressionStream;
    });

    afterEach(() => {
      // Restore original values
      if (originalCompressionStream) {
        globalThis.CompressionStream = originalCompressionStream;
      }
      if (originalDecompressionStream) {
        globalThis.DecompressionStream = originalDecompressionStream;
      }
    });

    it("isCompressionSupported returns false", () => {
      expect(isCompressionSupported()).toBe(false);
    });

    it("compress throws an error", async () => {
      await expect(compress("test")).rejects.toThrow("CompressionStream API not supported");
    });

    it("decompress throws an error", async () => {
      await expect(decompress(new ArrayBuffer(0))).rejects.toThrow(
        "DecompressionStream API not supported"
      );
    });
  });

  describe("getCompressionRatio", () => {
    it("calculates correct compression ratio", () => {
      expect(getCompressionRatio(1000, 250)).toBe(75); // 75% smaller
      expect(getCompressionRatio(100, 50)).toBe(50); // 50% smaller
      expect(getCompressionRatio(100, 100)).toBe(0); // No compression
    });

    it("handles edge case of zero original size", () => {
      expect(getCompressionRatio(0, 0)).toBe(0);
    });

    it("handles case where compressed is larger", () => {
      expect(getCompressionRatio(100, 120)).toBe(-20); // 20% larger
    });
  });
});
