// packages/shared/src/__tests__/components/Canvas/LeftSheet.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { IntlProvider } from "react-intl";
import { LeftSheet } from "../../../components/Canvas/LeftSheet";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <IntlProvider locale="en" messages={{ "app.common.close": "Close" }}>
      {ui}
    </IntlProvider>
  );
}

describe("LeftSheet", () => {
  it("renders children when open", () => {
    renderWithIntl(
      <LeftSheet open onClose={vi.fn()} title="Submit Work">
        <div data-testid="content">Form here</div>
      </LeftSheet>
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    renderWithIntl(
      <LeftSheet open={false} onClose={vi.fn()} title="Submit Work">
        <div data-testid="content">Form here</div>
      </LeftSheet>
    );
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    renderWithIntl(
      <LeftSheet open onClose={onClose} title="Submit Work">
        <div>Content</div>
      </LeftSheet>
    );
    fireEvent.click(screen.getByTestId("left-sheet-close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders with left-sheet test id", () => {
    renderWithIntl(
      <LeftSheet open onClose={vi.fn()} title="Actions">
        <div>Content</div>
      </LeftSheet>
    );
    expect(screen.getByTestId("left-sheet")).toBeInTheDocument();
  });

  it("portals bounded sheets into the provided container", () => {
    const portalContainer = document.createElement("div");
    document.body.appendChild(portalContainer);

    renderWithIntl(
      <LeftSheet open onClose={vi.fn()} title="Actions" container={portalContainer}>
        <div>Content</div>
      </LeftSheet>
    );

    const dialog = screen.getByTestId("left-sheet-dialog");
    expect(portalContainer).toContainElement(dialog);
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveStyle({
      height: "auto",
      inset:
        "var(--admin-sheet-top, calc(var(--admin-appbar-height, 3.5rem) + 0.5rem)) 0 var(--admin-sheet-bottom, 6.25rem) 0",
      maxHeight: "none",
      maxWidth: "none",
      pointerEvents: "auto",
      position: "absolute",
      width: "auto",
    });

    expect(screen.getByTestId("left-sheet")).toHaveStyle({
      borderRadius: "var(--radius-sheet, 24px)",
      bottom: "0px",
      height: "100%",
      left: "var(--admin-sheet-side-inset, 1rem)",
      maxHeight: "100%",
    });
  });

  it("traps focus and handles Escape in bounded mode", async () => {
    const portalContainer = document.createElement("div");
    document.body.appendChild(portalContainer);
    const onClose = vi.fn();

    renderWithIntl(
      <LeftSheet open onClose={onClose} title="Actions" container={portalContainer}>
        <button type="button">Inner action</button>
      </LeftSheet>
    );

    const dialog = screen.getByTestId("left-sheet-dialog");
    const closeButton = screen.getByTestId("left-sheet-close");
    const innerAction = screen.getByRole("button", { name: "Inner action" });

    await waitFor(() => expect(closeButton).toHaveFocus());

    innerAction.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    closeButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(innerAction).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("LeftSheet open transition", () => {
  it("reaches the open pose when opened after mount despite trailing re-renders", async () => {
    // Regression: the CSS slide pose is React-declared (closed → open on the
    // next frame via the enter effect). Trailing commits after the open
    // transition must not reset it back offscreen — the enter effect runs once
    // on open and the pose state persists across re-renders, so the sheet
    // settles at the open transform (previously parked at x=-100 on Hub →
    // Submit Work).
    const onClose = vi.fn();
    const view = renderWithIntl(
      <LeftSheet open={false} onClose={onClose} title="Submit Work">
        <div>Content</div>
      </LeftSheet>
    );
    expect(screen.queryByTestId("left-sheet")).not.toBeInTheDocument();

    const rerenderOpen = () =>
      view.rerender(
        <IntlProvider locale="en" messages={{ "app.common.close": "Close" }}>
          <LeftSheet open onClose={onClose} title="Submit Work">
            {/* Fresh children identity per render, mirroring the route-backed
                left-sheet config re-registering as content settles. */}
            <div>Content</div>
          </LeftSheet>
        </IntlProvider>
      );

    rerenderOpen(); // closed → open transition
    rerenderOpen(); // trailing commits that race the open animation
    rerenderOpen();

    const panel = await screen.findByTestId("left-sheet");
    await waitFor(() => {
      expect(panel.style.transform).toBe("translateX(calc(0% + 0px))");
    });
    expect(screen.getByTestId("left-sheet-dialog")).toHaveAttribute("data-state", "open");
  });
});
