/**
 * ImageWithFallback gateway tests
 *
 * IPFS images request one gateway at a time and move to the next only on failure,
 * non-IPFS images load directly, and fallback states work correctly.
 */

import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../modules/data/ipfs/resolve", () => ({
  getIPFSFallbackGateways: () => [
    "https://gateway-a.link",
    "https://gateway-b.link",
    "https://gateway-c.link",
  ],
}));

import { ImageWithFallback } from "../../components/Display/ImageWithFallback";

describe("ImageWithFallback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    onlineManager.setOnline(true);
    cleanup();
  });

  describe("IPFS URLs (one gateway at a time)", () => {
    it("requests only the configured primary gateway first", () => {
      render(
        createElement(ImageWithFallback, {
          src: "https://gateway-c.link/ipfs/QmPrimaryFirst",
          alt: "test",
        })
      );

      expect(screen.getAllByRole("img", { hidden: true })).toHaveLength(1);
      expect(screen.getByAltText("test").getAttribute("src")).toBe(
        "https://gateway-a.link/ipfs/QmPrimaryFirst"
      );
    });

    it("moves to the next gateway when the current one fails", () => {
      render(
        createElement(ImageWithFallback, {
          src: "https://gateway-a.link/ipfs/QmNextGateway",
          alt: "next",
        })
      );

      fireEvent.error(screen.getByAltText("next"));

      expect(screen.getByAltText("next").getAttribute("src")).toBe(
        "https://gateway-b.link/ipfs/QmNextGateway"
      );
    });

    it("shows fallback after every gateway fails", () => {
      const onErrorCallback = vi.fn();
      render(
        createElement(ImageWithFallback, {
          src: "https://gateway-a.link/ipfs/QmFailAllGateways999",
          alt: "test image",
          onErrorCallback,
        })
      );

      for (let attempt = 0; attempt < 3; attempt += 1) {
        fireEvent.error(screen.getByAltText("test image"));
      }

      expect(screen.queryByAltText("test image")).not.toBeInTheDocument();
      expect(screen.getByLabelText("test image")).toBeInTheDocument();
      expect(onErrorCallback).toHaveBeenCalledOnce();
    });

    it("renders backgroundFallback when all gateways fail", () => {
      render(
        createElement(ImageWithFallback, {
          src: "https://gateway-a.link/ipfs/QmFailed",
          alt: "with-bg",
          backgroundFallback: createElement("div", { "data-testid": "bg-fallback" }),
        })
      );

      for (let attempt = 0; attempt < 3; attempt += 1) {
        fireEvent.error(screen.getByAltText("with-bg"));
      }

      expect(screen.getByTestId("bg-fallback")).toBeInTheDocument();
    });

    it("hides backgroundFallback once image loads successfully", async () => {
      render(
        createElement(ImageWithFallback, {
          src: "https://gateway-a.link/ipfs/QmLoadOk456",
          alt: "loaded-img",
          backgroundFallback: createElement("div", { "data-testid": "bg-fallback" }),
        })
      );

      expect(screen.getByTestId("bg-fallback")).toBeInTheDocument();
      fireEvent.load(screen.getByAltText("loaded-img"));

      await waitFor(() => {
        expect(screen.queryByTestId("bg-fallback")).not.toBeInTheDocument();
      });
    });

    it("reopens from the gateway that worked without replaying the reveal", async () => {
      const cid = "QmCachedNoReveal789";
      const { unmount } = render(
        createElement(ImageWithFallback, {
          src: `https://gateway-a.link/ipfs/${cid}`,
          alt: "cached-img",
        })
      );
      fireEvent.error(screen.getByAltText("cached-img"));
      fireEvent.load(screen.getByAltText("cached-img"));
      await waitFor(() => {
        expect(screen.getByAltText("cached-img")).toHaveClass("image-reveal");
      });
      unmount();

      render(
        createElement(ImageWithFallback, {
          src: `https://gateway-a.link/ipfs/${cid}`,
          alt: "cached-img",
        })
      );

      const cachedImg = screen.getByAltText("cached-img");
      expect(cachedImg.getAttribute("src")).toBe(`https://gateway-b.link/ipfs/${cid}`);
      expect(cachedImg).not.toHaveClass("opacity-0");
      expect(cachedImg).not.toHaveClass("image-reveal");
    });

    it("tries again when the connection returns after an offline failure", () => {
      act(() => onlineManager.setOnline(false));
      render(
        createElement(ImageWithFallback, {
          src: "https://gateway-a.link/ipfs/QmOfflineRetry",
          alt: "offline",
        })
      );
      for (let attempt = 0; attempt < 3; attempt += 1) {
        fireEvent.error(screen.getByAltText("offline"));
      }
      expect(screen.queryByAltText("offline")).not.toBeInTheDocument();

      act(() => onlineManager.setOnline(true));

      expect(screen.getByAltText("offline").getAttribute("src")).toBe(
        "https://gateway-a.link/ipfs/QmOfflineRetry"
      );
    });

    it("does not retry a failure that happened while online", () => {
      render(
        createElement(ImageWithFallback, {
          src: "https://gateway-a.link/ipfs/QmMissingOnline",
          alt: "missing",
        })
      );
      for (let attempt = 0; attempt < 3; attempt += 1) {
        fireEvent.error(screen.getByAltText("missing"));
      }
      act(() => onlineManager.setOnline(false));
      act(() => onlineManager.setOnline(true));

      expect(screen.queryByAltText("missing")).not.toBeInTheDocument();
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

  describe("src prop changes", () => {
    it("updates rendered image when non-IPFS src prop changes", () => {
      const { rerender } = render(
        createElement(ImageWithFallback, {
          src: "https://example.com/first.jpg",
          alt: "swap",
        })
      );

      expect(screen.getByAltText("swap").getAttribute("src")).toBe("https://example.com/first.jpg");

      rerender(
        createElement(ImageWithFallback, {
          src: "https://example.com/second.jpg",
          alt: "swap",
        })
      );

      expect(screen.getByAltText("swap").getAttribute("src")).toBe(
        "https://example.com/second.jpg"
      );
    });
  });
});
