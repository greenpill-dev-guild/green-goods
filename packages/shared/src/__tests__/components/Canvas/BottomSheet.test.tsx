// packages/shared/src/__tests__/components/Canvas/BottomSheet.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { IntlProvider } from "react-intl";
import { BottomSheet } from "../../../components/Canvas/BottomSheet";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <IntlProvider locale="en" messages={{ "app.common.close": "Close" }}>
      {ui}
    </IntlProvider>
  );
}

describe("BottomSheet", () => {
  it("renders children when open", () => {
    renderWithIntl(
      <BottomSheet open onClose={vi.fn()} title="Filters">
        <div data-testid="content">Filter form</div>
      </BottomSheet>
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    renderWithIntl(
      <BottomSheet open={false} onClose={vi.fn()} title="Filters">
        <div data-testid="content">Filter form</div>
      </BottomSheet>
    );
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    renderWithIntl(
      <BottomSheet open onClose={onClose} title="Filters">
        <div>Content</div>
      </BottomSheet>
    );
    fireEvent.click(screen.getByTestId("bottom-sheet-close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders with bottom-sheet test id", () => {
    renderWithIntl(
      <BottomSheet open onClose={vi.fn()} title="Filters">
        <div>Content</div>
      </BottomSheet>
    );
    expect(screen.getByTestId("bottom-sheet")).toBeInTheDocument();
  });
});

describe("BottomSheet open transition", () => {
  it("reaches the open pose when opened after mount despite trailing re-renders", async () => {
    // Mirrors the LeftSheet/RightSheet regression: the CSS slide pose is
    // React-declared and persists across re-renders, so trailing commits must
    // not park the sheet offscreen at y=100 (translateY(100%)) instead of
    // reaching the open pose.
    const onClose = vi.fn();
    const view = renderWithIntl(
      <BottomSheet open={false} onClose={onClose} title="Filters">
        <div>Content</div>
      </BottomSheet>
    );
    expect(screen.queryByTestId("bottom-sheet")).not.toBeInTheDocument();

    const rerenderOpen = () =>
      view.rerender(
        <IntlProvider locale="en" messages={{ "app.common.close": "Close" }}>
          <BottomSheet open onClose={onClose} title="Filters">
            <div>Content</div>
          </BottomSheet>
        </IntlProvider>
      );

    rerenderOpen(); // closed → open transition
    rerenderOpen(); // trailing commits that race the open animation
    rerenderOpen();

    const panel = await screen.findByTestId("bottom-sheet");
    await waitFor(() => {
      expect(panel.style.transform).toBe("translateY(0%)");
    });
    expect(screen.getByTestId("bottom-sheet-dialog")).toHaveAttribute("data-state", "open");
  });
});
