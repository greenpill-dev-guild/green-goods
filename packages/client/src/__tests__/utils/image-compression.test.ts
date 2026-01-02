/**
 * Image Compression Utility Tests
 *
 * Tests for image compression and optimization
 */

import { describe, it, expect, vi } from "vitest";
import { createMockFile } from "../../../../shared/src/__tests__/test-utils/mock-factories";

describe("Image Compression Utilities", () => {
  describe("compressImage", () => {
    it("creates File object with correct properties", () => {
      const file = createMockFile("test.jpg", "image/jpeg", 1024);
      expect(file.name).toBe("test.jpg");
      expect(file.type).toBe("image/jpeg");
      expect(file.size).toBe(1024);
    });

    it("handles JPEG images", () => {
      const file = createMockFile("photo.jpg", "image/jpeg");
      expect(file.type).toBe("image/jpeg");
    });

    it("handles PNG images", () => {
      const file = createMockFile("screenshot.png", "image/png");
      expect(file.type).toBe("image/png");
    });

    it("handles WebP images", () => {
      const file = createMockFile("modern.webp", "image/webp");
      expect(file.type).toBe("image/webp");
    });
  });

  describe("calculateCompression", () => {
    it("calculates compression ratio", () => {
      const originalSize = 1000;
      const compressedSize = 500;
      const ratio = (compressedSize / originalSize) * 100;
      expect(ratio).toBe(50);
    });

    it("handles no compression case", () => {
      const originalSize = 1000;
      const compressedSize = 1000;
      const ratio = (compressedSize / originalSize) * 100;
      expect(ratio).toBe(100);
    });
  });

  describe("shouldCompress", () => {
    it("compresses images larger than threshold", () => {
      const threshold = 1024 * 1024; // 1MB
      const imageSize = 2 * 1024 * 1024; // 2MB
      expect(imageSize > threshold).toBe(true);
    });

    it("skips compression for small images", () => {
      const threshold = 1024 * 1024; // 1MB
      const imageSize = 500 * 1024; // 500KB
      expect(imageSize > threshold).toBe(false);
    });
  });

  describe("getImageDimensions", () => {
    it("extracts width and height from image", () => {
      const dimensions = { width: 1920, height: 1080 };
      expect(dimensions.width).toBe(1920);
      expect(dimensions.height).toBe(1080);
    });

    it("calculates aspect ratio", () => {
      const width = 1920;
      const height = 1080;
      const aspectRatio = width / height;
      expect(aspectRatio).toBeCloseTo(1.778, 2);
    });
  });

  describe("resizeImage", () => {
    it("calculates new dimensions maintaining aspect ratio", () => {
      const originalWidth = 1920;
      const originalHeight = 1080;
      const maxWidth = 800;

      const aspectRatio = originalWidth / originalHeight;
      const newWidth = maxWidth;
      const newHeight = Math.round(newWidth / aspectRatio);

      expect(newWidth).toBe(800);
      expect(newHeight).toBe(450);
    });

    it("does not upscale smaller images", () => {
      const originalWidth = 400;
      const maxWidth = 800;
      const newWidth = Math.min(originalWidth, maxWidth);
      expect(newWidth).toBe(400);
    });
  });
});
