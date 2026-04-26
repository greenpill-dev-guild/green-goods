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
      maxHeight: "none",
      maxWidth: "none",
      pointerEvents: "auto",
      position: "absolute",
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
