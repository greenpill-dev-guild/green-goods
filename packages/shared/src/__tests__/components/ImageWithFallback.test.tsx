/**
 * ImageWithFallback Gateway Fallback Tests
 *
 * Verifies that when an IPFS image fails to load, the component tries
 * alternate gateways (w3s.link -> storacha.link -> dweb.link) before
 * showing the fallback icon. This is the fix for #404.
 */

import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImageWithFallback } from "../../components/Display/ImageWithFallback";

describe("ImageWithFallback — gateway fallback (#404)", () => {
  afterEach(() => cleanup());

  it("renders the image with the provided src", () => {
    render(
      createElement(ImageWithFallback, { src: "https://w3s.link/ipfs/QmTest123", alt: "test" })
    );
    const img = screen.getByAltText("test");
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toBe("https://w3s.link/ipfs/QmTest123");
  });

  it("tries storacha.link on first error for IPFS URL", () => {
    render(
      createElement(ImageWithFallback, { src: "https://w3s.link/ipfs/QmTest123", alt: "test" })
    );
    const img = screen.getByAltText("test");

    // Simulate image load error
    fireEvent.error(img);

    // Should now try storacha.link
    expect(img.getAttribute("src")).toBe("https://storacha.link/ipfs/QmTest123");
  });

  it("tries dweb.link after storacha.link fails", () => {
    render(
      createElement(ImageWithFallback, { src: "https://w3s.link/ipfs/QmTest123", alt: "test" })
    );
    const img = screen.getByAltText("test");

    // First failure → storacha.link
    fireEvent.error(img);
    expect(img.getAttribute("src")).toBe("https://storacha.link/ipfs/QmTest123");

    // Second failure → dweb.link
    fireEvent.error(img);
    expect(img.getAttribute("src")).toBe("https://dweb.link/ipfs/QmTest123");
  });

  it("shows fallback icon after all gateways exhausted", () => {
    const onErrorCallback = vi.fn();
    render(
      createElement(ImageWithFallback, {
        src: "https://w3s.link/ipfs/QmTest123",
        alt: "test image",
        onErrorCallback,
      })
    );
    const img = screen.getByAltText("test image");

    // Exhaust all gateways: w3s (original) → storacha → dweb → fallback
    fireEvent.error(img); // → storacha
    fireEvent.error(img); // → dweb
    fireEvent.error(img); // → all exhausted, show fallback

    // Image should be replaced by fallback div
    expect(screen.queryByAltText("test image")).not.toBeInTheDocument();
    expect(screen.getByLabelText("test image")).toBeInTheDocument(); // aria-label on fallback div
    expect(onErrorCallback).toHaveBeenCalledOnce();
  });

  it("does not attempt gateway fallback for non-IPFS URLs", () => {
    const onErrorCallback = vi.fn();
    render(
      createElement(ImageWithFallback, {
        src: "https://example.com/photo.jpg",
        alt: "regular image",
        onErrorCallback,
      })
    );
    const img = screen.getByAltText("regular image");

    // Error on non-IPFS URL should go straight to fallback
    fireEvent.error(img);

    expect(screen.queryByAltText("regular image")).not.toBeInTheDocument();
    expect(screen.getByLabelText("regular image")).toBeInTheDocument();
    expect(onErrorCallback).toHaveBeenCalledOnce();
  });

  it("shows fallback immediately for empty src", () => {
    render(createElement(ImageWithFallback, { src: "", alt: "empty" }));
    // Should show fallback right away
    expect(screen.getByLabelText("empty")).toBeInTheDocument();
  });

  it("sanitizes javascript: protocol URLs", () => {
    render(createElement(ImageWithFallback, { src: "javascript:alert(1)", alt: "xss" }));
    // Should show fallback (XSS URL is rejected)
    expect(screen.getByLabelText("xss")).toBeInTheDocument();
  });
});
