// packages/shared/src/__tests__/components/Canvas/RightSheet.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
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
});
