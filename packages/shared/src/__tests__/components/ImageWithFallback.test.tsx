/**
 * ImageWithFallback Gateway Race Tests
 *
 * Verifies that IPFS images race all configured gateways in parallel,
 * non-IPFS images load directly, and fallback states work correctly.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the shared gateway list to make tests predictable
vi.mock("../../modules/data/ipfs", () => ({
  getIPFSFallbackGateways: () => [
    "https://gateway-a.link",
    "https://gateway-b.link",
    "https://gateway-c.link",
  ],
}));

import { ImageWithFallback } from "../../components/Display/ImageWithFallback";

/**
 * Mock Image class that simulates successful loads.
 * Setting src triggers onload asynchronously (next tick).
 */
class SucceedingImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = "";

  get src() {
    return this._src;
  }
  set src(url: string) {
    this._src = url;
    if (!url) return;
    setTimeout(() => this.onload?.(), 0);
  }
}

/**
 * Mock Image class that simulates failed loads.
 * Setting src triggers onerror asynchronously (next tick).
 */
class FailingImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = "";

  get src() {
    return this._src;
  }
  set src(url: string) {
    this._src = url;
    if (!url) return;
    setTimeout(() => this.onerror?.(), 0);
  }
}

describe("ImageWithFallback — parallel gateway race", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  describe("IPFS URLs (parallel race)", () => {
    beforeEach(() => {
      vi.stubGlobal("Image", SucceedingImage);
    });

    it("races gateways and renders winning URL for IPFS src", async () => {
      render(
        createElement(ImageWithFallback, {
          src: "https://gateway-a.link/ipfs/QmTest123",
          alt: "test",
        })
      );

      // Wait for the parallel race to resolve and img to appear
      await waitFor(() => {
        expect(screen.getByAltText("test")).toBeInTheDocument();
      });

      const img = screen.getByAltText("test");
      expect(img.getAttribute("src")).toMatch(/\/ipfs\/QmTest123/);
    });

    it("shows fallback when all gateways fail", async () => {
      vi.stubGlobal("Image", FailingImage);
      const onErrorCallback = vi.fn();

      // Use a unique CID to avoid the module-level resolvedUrlCache
      render(
        createElement(ImageWithFallback, {
          src: "https://gateway-a.link/ipfs/QmFailAllGateways999",
          alt: "test image",
          onErrorCallback,
        })
      );

      // Wait for all gateways to fail and fallback to appear
      await waitFor(() => {
        expect(screen.getByLabelText("test image")).toBeInTheDocument();
      });

      expect(screen.queryByAltText("test image")).not.toBeInTheDocument();
      expect(onErrorCallback).toHaveBeenCalledOnce();
    });

    it("renders backgroundFallback when all gateways fail", async () => {
      vi.stubGlobal("Image", FailingImage);

      render(
        createElement(ImageWithFallback, {
          src: "https://gateway-a.link/ipfs/QmFailed",
          alt: "with-bg",
          backgroundFallback: createElement("div", { "data-testid": "bg-fallback" }),
        })
      );

      await waitFor(() => {
        // backgroundFallback replaces the default icon fallback
        expect(screen.getByTestId("bg-fallback")).toBeInTheDocument();
      });
    });

    it("hides backgroundFallback once image loads successfully", async () => {
      render(
        createElement(ImageWithFallback, {
          src: "https://gateway-a.link/ipfs/QmLoadOk456",
          alt: "loaded-img",
          backgroundFallback: createElement("div", { "data-testid": "bg-fallback" }),
        })
      );

      // Fallback visible during loading
      await waitFor(() => {
        expect(screen.getByTestId("bg-fallback")).toBeInTheDocument();
      });

      // After gateway race resolves, img appears — fire its onload
      await waitFor(() => {
        expect(screen.getByAltText("loaded-img")).toBeInTheDocument();
      });
      fireEvent.load(screen.getByAltText("loaded-img"));

      // Fallback should now be removed from the DOM
      await waitFor(() => {
        expect(screen.queryByTestId("bg-fallback")).not.toBeInTheDocument();
      });
    });
  });

  describe("non-IPFS URLs (direct load)", () => {
    it("renders image immediately for non-IPFS URLs", () => {
      render(
        createElement(ImageWithFallback, {
          src: "https://example.com/photo.jpg",
          alt: "regular image",
        })
      );

      const img = screen.getByAltText("regular image");
      expect(img).toBeInTheDocument();
      expect(img.getAttribute("src")).toBe("https://example.com/photo.jpg");
    });

    it("shows fallback on error for non-IPFS URLs", () => {
      const onErrorCallback = vi.fn();
      render(
        createElement(ImageWithFallback, {
          src: "https://example.com/photo.jpg",
          alt: "regular image",
          onErrorCallback,
        })
      );

      fireEvent.error(screen.getByAltText("regular image"));

      expect(screen.queryByAltText("regular image")).not.toBeInTheDocument();
      expect(screen.getByLabelText("regular image")).toBeInTheDocument();
      expect(onErrorCallback).toHaveBeenCalledOnce();
    });
  });

  describe("edge cases", () => {
    it("shows fallback immediately for empty src", () => {
      render(createElement(ImageWithFallback, { src: "", alt: "empty" }));
      expect(screen.getByLabelText("empty")).toBeInTheDocument();
    });

    it("sanitizes javascript: protocol URLs", () => {
      render(createElement(ImageWithFallback, { src: "javascript:alert(1)", alt: "xss" }));
      expect(screen.getByLabelText("xss")).toBeInTheDocument();
    });
  });
});
