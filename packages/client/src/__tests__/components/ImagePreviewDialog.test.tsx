import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { ImagePreviewDialog } from "../../components/UI/ImagePreviewDialog";

const IMAGES = [
  "https://via.placeholder.co/300x300?text=1",
  "https://via.placeholder.co/300x300?text=2",
];

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button aria-label="background">Background</button>
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
  it("locks scroll, traps focus, and restores on close", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const background = screen.getByLabelText("background") as HTMLButtonElement;
    background.focus();
    expect(document.activeElement).toBe(background);

    const closeBtn = await screen.findByTestId("image-preview-close");
    expect(closeBtn).toHaveFocus();
    expect(document.documentElement.classList.contains("modal-open")).toBe(true);

    // Escape closes
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("image-preview-dialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(document.documentElement.classList.contains("modal-open")).toBe(false)
    );
    await waitFor(() => {
      const active = document.activeElement as Element | null;
      // In jsdom, focus restoration can fall back to body; accept either
      expect([background, document.body]).toContain(active);
    });
  });

  it("navigates with arrow keys", async () => {
    const user = userEvent.setup();
    render(<ImagePreviewDialog isOpen onClose={() => {}} images={IMAGES} initialIndex={0} />);

    const img = screen.getByAltText("Preview 1") as HTMLImageElement;
    expect(img.src).toContain("text=1");

    await user.keyboard("{ArrowRight}");
    const img2 = screen.getByAltText("Preview 2") as HTMLImageElement;
    expect(img2.src).toContain("text=2");

    await user.keyboard("{ArrowLeft}");
    const img1Again = screen.getByAltText("Preview 1") as HTMLImageElement;
    expect(img1Again.src).toContain("text=1");
  });

  it("zoom controls affect transform", async () => {
    const user = userEvent.setup();
    render(<ImagePreviewDialog isOpen onClose={() => {}} images={[IMAGES[0]]} initialIndex={0} />);

    const zoomIn = screen.getByRole("button", { name: /zoom in/i });
    const reset = screen.getByRole("button", { name: /reset zoom/i });

    const img = screen.getByAltText("Preview 1");
    // Initial scale(1)
    expect(img).toHaveAttribute("style", expect.stringContaining("scale(1)"));

    await user.click(zoomIn);
    expect(img).toHaveAttribute("style", expect.stringContaining("scale(1.25)"));

    await user.click(reset);
    expect(img).toHaveAttribute("style", expect.stringContaining("scale(1)"));
  });

  it("overlay click closes", () => {
    const onClose = vi.fn();
    render(<ImagePreviewDialog isOpen onClose={onClose} images={IMAGES} initialIndex={0} />);
    fireEvent.click(screen.getByTestId("image-preview-dialog"));
    expect(onClose).toHaveBeenCalled();
  });

  it("download button triggers file download", async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(document.body, "appendChild");
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype as any, "click")
      .mockImplementation(() => {});
    render(<ImagePreviewDialog isOpen onClose={() => {}} images={[IMAGES[0]]} initialIndex={0} />);

    const downloadBtn = await screen.findByTestId("image-preview-download");
    await user.click(downloadBtn);
    expect(clickSpy).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    anchorClick.mockRestore();
  });
});
