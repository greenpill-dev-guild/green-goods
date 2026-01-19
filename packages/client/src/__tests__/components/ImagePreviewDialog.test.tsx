/**
 * ImagePreviewDialog Component Tests
 *
 * Tests for the image preview dialog component.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock ImageWithFallback to avoid image loading issues
vi.mock("@/components/Display", () => ({
  ImageWithFallback: ({ src, alt, style, ...props }: any) => (
    <img src={src} alt={alt} style={style} {...props} />
  ),
}));

vi.mock("@green-goods/shared/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

import { ImagePreviewDialog } from "../../components/Dialogs/ImagePreviewDialog";

const IMAGES = [
  "https://via.placeholder.co/300x300?text=1",
  "https://via.placeholder.co/300x300?text=2",
  "https://via.placeholder.co/300x300?text=3",
];

function TestHarness({ initialOpen = true }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="open-dialog">
        Open
      </button>
      <ImagePreviewDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        images={IMAGES}
        initialIndex={0}
      />
    </>
  );
}

describe("ImagePreviewDialog", () => {
  afterEach(() => {
    cleanup();
    // Ensure all dialogs are removed from DOM
    document.body.innerHTML = "";
  });

  it("renders when open with images", () => {
    render(<ImagePreviewDialog isOpen onClose={() => {}} images={IMAGES} initialIndex={0} />);

    expect(screen.getByTestId("image-preview-dialog")).toBeInTheDocument();
    expect(screen.getByAltText("Preview 1")).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <ImagePreviewDialog isOpen={false} onClose={() => {}} images={IMAGES} initialIndex={0} />
    );

    expect(screen.queryByTestId("image-preview-dialog")).not.toBeInTheDocument();
  });

  it("does not render when images array is empty", () => {
    render(<ImagePreviewDialog isOpen onClose={() => {}} images={[]} initialIndex={0} />);

    expect(screen.queryByTestId("image-preview-dialog")).not.toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<ImagePreviewDialog isOpen onClose={onClose} images={IMAGES} initialIndex={0} />);

    const closeBtn = screen.getByTestId("image-preview-close");
    await user.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when overlay is clicked", () => {
    const onClose = vi.fn();

    render(<ImagePreviewDialog isOpen onClose={onClose} images={IMAGES} initialIndex={0} />);

    fireEvent.click(screen.getByTestId("image-preview-dialog"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("navigates to next image with arrow button", async () => {
    const user = userEvent.setup();

    render(<ImagePreviewDialog isOpen onClose={() => {}} images={IMAGES} initialIndex={0} />);

    expect(screen.getByAltText("Preview 1")).toBeInTheDocument();

    const nextBtn = screen.getByRole("button", { name: /next image/i });
    await user.click(nextBtn);

    expect(screen.getByAltText("Preview 2")).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("navigates to previous image with arrow button", async () => {
    const user = userEvent.setup();

    render(<ImagePreviewDialog isOpen onClose={() => {}} images={IMAGES} initialIndex={1} />);

    expect(screen.getByAltText("Preview 2")).toBeInTheDocument();

    const prevBtn = screen.getByRole("button", { name: /previous image/i });
    await user.click(prevBtn);

    expect(screen.getByAltText("Preview 1")).toBeInTheDocument();
  });

  it("navigates via thumbnail clicks", async () => {
    const user = userEvent.setup();

    render(<ImagePreviewDialog isOpen onClose={() => {}} images={IMAGES} initialIndex={0} />);

    const thumb3 = screen.getByRole("button", { name: /go to image 3/i });
    await user.click(thumb3);

    expect(screen.getByAltText("Preview 3")).toBeInTheDocument();
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
  });

  it("zoom in button increases scale", async () => {
    const user = userEvent.setup();

    render(<ImagePreviewDialog isOpen onClose={() => {}} images={[IMAGES[0]]} initialIndex={0} />);

    const img = screen.getByAltText("Preview 1");
    // Initial scale is 1
    expect(img.style.transform).toContain("scale(1)");

    const zoomInBtn = screen.getByRole("button", { name: /zoom in/i });
    await user.click(zoomInBtn);

    // Scale should increase to 1.25
    expect(img.style.transform).toContain("scale(1.25)");
  });

  it("reset zoom button resets scale to 1", async () => {
    const user = userEvent.setup();

    render(<ImagePreviewDialog isOpen onClose={() => {}} images={[IMAGES[0]]} initialIndex={0} />);

    const img = screen.getByAltText("Preview 1");

    // Zoom in first
    const zoomInBtn = screen.getByRole("button", { name: /zoom in/i });
    await user.click(zoomInBtn);
    expect(img.style.transform).toContain("scale(1.25)");

    // Reset
    const resetBtn = screen.getByRole("button", { name: /reset zoom/i });
    await user.click(resetBtn);
    // Scale should reset to 1
    expect(img.style.transform).toContain("scale(1)");
    expect(img.style.transform).not.toContain("scale(1.25)");
  });

  it("hides prev button on first image", () => {
    render(<ImagePreviewDialog isOpen onClose={() => {}} images={IMAGES} initialIndex={0} />);

    expect(screen.queryByRole("button", { name: /previous image/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next image/i })).toBeInTheDocument();
  });

  it("hides next button on last image", () => {
    render(<ImagePreviewDialog isOpen onClose={() => {}} images={IMAGES} initialIndex={2} />);

    expect(screen.getByRole("button", { name: /previous image/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next image/i })).not.toBeInTheDocument();
  });

  it("hides navigation when only one image", () => {
    render(<ImagePreviewDialog isOpen onClose={() => {}} images={[IMAGES[0]]} initialIndex={0} />);

    expect(screen.queryByRole("button", { name: /previous image/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next image/i })).not.toBeInTheDocument();
    // Thumbnails also hidden for single image
    expect(screen.queryByRole("button", { name: /go to image/i })).not.toBeInTheDocument();
  });
});
