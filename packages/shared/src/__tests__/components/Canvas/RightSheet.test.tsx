// packages/shared/src/__tests__/components/Canvas/RightSheet.test.tsx
import { Globals } from "@react-spring/web";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
import { IntlProvider } from "react-intl";
import { RightSheet } from "../../../components/Canvas/RightSheet";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <IntlProvider locale="en" messages={{ "app.common.close": "Close" }}>
      {ui}
    </IntlProvider>
  );
}

describe("RightSheet", () => {
  it("renders children when open", () => {
    renderWithIntl(
      <RightSheet open onClose={vi.fn()} title="Settings">
        <div data-testid="content">Settings form</div>
      </RightSheet>
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    renderWithIntl(
      <RightSheet open={false} onClose={vi.fn()} title="Settings">
        <div data-testid="content">Settings form</div>
      </RightSheet>
    );
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    renderWithIntl(
      <RightSheet open onClose={onClose} title="Settings">
        <div>Content</div>
      </RightSheet>
    );
    fireEvent.click(screen.getByTestId("right-sheet-close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders with right-sheet test id", () => {
    renderWithIntl(
      <RightSheet open onClose={vi.fn()} title="Notifications">
        <div>Content</div>
      </RightSheet>
    );
    expect(screen.getByTestId("right-sheet")).toBeInTheDocument();
  });

  it("portals bounded sheets into the provided container", () => {
    const portalContainer = document.createElement("div");
    document.body.appendChild(portalContainer);

    renderWithIntl(
      <RightSheet open onClose={vi.fn()} title="Settings" container={portalContainer}>
        <div>Content</div>
      </RightSheet>
    );

    const dialog = screen.getByTestId("right-sheet-dialog");
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

    expect(screen.getByTestId("right-sheet")).toHaveStyle({
      borderRadius: "var(--radius-sheet, 24px)",
      bottom: "0px",
      height: "auto",
      maxHeight: "100%",
      right: "var(--admin-sheet-side-inset, 1rem)",
    });
  });

  it("traps focus and handles Escape in bounded mode", async () => {
    const portalContainer = document.createElement("div");
    document.body.appendChild(portalContainer);
    const onClose = vi.fn();

    renderWithIntl(
      <RightSheet open onClose={onClose} title="Settings" container={portalContainer}>
        <button type="button">Inner action</button>
      </RightSheet>
    );

    const dialog = screen.getByTestId("right-sheet-dialog");
    const closeButton = screen.getByTestId("right-sheet-close");
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

describe("RightSheet open transition", () => {
  beforeAll(() => {
    Globals.assign({ skipAnimation: true });
  });

  afterAll(() => {
    Globals.assign({ skipAnimation: false });
  });

  it("reaches the open pose when opened after mount despite trailing re-renders", async () => {
    // Mirrors the LeftSheet regression: per-commit re-application of the
    // spring's declared update must assert the current pose, not the initial
    // closed pose, or commits landing after the open transition park the
    // sheet offscreen.
    const onClose = vi.fn();
    const view = renderWithIntl(
      <RightSheet open={false} onClose={onClose} title="Settings">
        <div>Content</div>
      </RightSheet>
    );
    expect(screen.queryByTestId("right-sheet")).not.toBeInTheDocument();

    const rerenderOpen = () =>
      view.rerender(
        <IntlProvider locale="en" messages={{ "app.common.close": "Close" }}>
          <RightSheet open onClose={onClose} title="Settings">
            <div>Content</div>
          </RightSheet>
        </IntlProvider>
      );

    rerenderOpen(); // closed -> open transition
    rerenderOpen(); // trailing commits that race the open animation
    rerenderOpen();

    const panel = await screen.findByTestId("right-sheet");
    await waitFor(() => {
      expect(panel.style.transform).toBe("translateX(calc(0% + 0px))");
    });
    expect(screen.getByTestId("right-sheet-dialog")).toHaveAttribute("data-state", "open");
  });
});
