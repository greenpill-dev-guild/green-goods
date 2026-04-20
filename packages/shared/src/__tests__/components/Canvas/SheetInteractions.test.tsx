/**
 * Focused Canvas sheet interaction tests.
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BottomSheet } from "../../../components/Canvas/BottomSheet";
import { LeftSheet } from "../../../components/Canvas/LeftSheet";
import { RightSheet } from "../../../components/Canvas/RightSheet";

function renderWithIntl(ui: ReactElement) {
  return render(
    <IntlProvider locale="en" messages={{ "app.common.close": "Close" }}>
      {ui}
    </IntlProvider>
  );
}

function installPointerPolyfills() {
  if (!window.PointerEvent) {
    Object.defineProperty(window, "PointerEvent", {
      configurable: true,
      value: MouseEvent,
    });
  }

  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: vi.fn(() => true),
  });
}

type SheetCase = {
  name: string;
  dialogTestId: string;
  overlayTestId: string;
  dragTargetTestId: string;
  renderSheet: (onClose: () => void, title: string) => ReactElement;
  dragPastThreshold: (target: HTMLElement) => void;
};

const sheetCases: SheetCase[] = [
  {
    name: "LeftSheet",
    dialogTestId: "left-sheet-dialog",
    overlayTestId: "left-sheet-overlay",
    dragTargetTestId: "left-sheet",
    renderSheet: (onClose, title) => (
      <LeftSheet open onClose={onClose} title={title}>
        <p>Sheet content</p>
      </LeftSheet>
    ),
    dragPastThreshold: (target) => {
      fireEvent.pointerDown(target, {
        pointerId: 1,
        pointerType: "mouse",
        clientX: 0,
        clientY: 0,
        buttons: 1,
      });
      fireEvent.pointerMove(target, {
        pointerId: 1,
        pointerType: "mouse",
        clientX: -140,
        clientY: 0,
        buttons: 1,
      });
      fireEvent.pointerUp(target, {
        pointerId: 1,
        pointerType: "mouse",
        clientX: -140,
        clientY: 0,
      });
    },
  },
  {
    name: "RightSheet",
    dialogTestId: "right-sheet-dialog",
    overlayTestId: "right-sheet-overlay",
    dragTargetTestId: "right-sheet",
    renderSheet: (onClose, title) => (
      <RightSheet open onClose={onClose} title={title}>
        <p>Sheet content</p>
      </RightSheet>
    ),
    dragPastThreshold: (target) => {
      fireEvent.pointerDown(target, {
        pointerId: 1,
        pointerType: "mouse",
        clientX: 0,
        clientY: 0,
        buttons: 1,
      });
      fireEvent.pointerMove(target, {
        pointerId: 1,
        pointerType: "mouse",
        clientX: 140,
        clientY: 0,
        buttons: 1,
      });
      fireEvent.pointerUp(target, {
        pointerId: 1,
        pointerType: "mouse",
        clientX: 140,
        clientY: 0,
      });
    },
  },
  {
    name: "BottomSheet",
    dialogTestId: "bottom-sheet-dialog",
    overlayTestId: "bottom-sheet-overlay",
    dragTargetTestId: "bottom-sheet-drag-handle",
    renderSheet: (onClose, title) => (
      <BottomSheet open onClose={onClose} title={title}>
        <p>Sheet content</p>
      </BottomSheet>
    ),
    dragPastThreshold: (target) => {
      fireEvent.pointerDown(target, {
        pointerId: 1,
        pointerType: "mouse",
        clientX: 0,
        clientY: 0,
        buttons: 1,
      });
      fireEvent.pointerMove(target, {
        pointerId: 1,
        pointerType: "mouse",
        clientX: 0,
        clientY: 140,
        buttons: 1,
      });
      fireEvent.pointerUp(target, {
        pointerId: 1,
        pointerType: "mouse",
        clientX: 0,
        clientY: 140,
      });
    },
  },
];

describe.each(sheetCases)("$name", (sheet) => {
  beforeEach(() => {
    installPointerPolyfills();
  });

  it("mounts the native dialog and announces the provided title", () => {
    renderWithIntl(sheet.renderSheet(vi.fn(), "Work Detail"));

    expect(screen.getByTestId(sheet.dialogTestId)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Work Detail" })).toBeInTheDocument();
    expect(screen.getByText("Sheet content")).toBeInTheDocument();
  });

  it("fires onClose when the overlay is clicked", () => {
    const onClose = vi.fn();
    renderWithIntl(sheet.renderSheet(onClose, "Work Detail"));

    fireEvent.click(screen.getByTestId(sheet.overlayTestId));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("fires onClose when Escape dispatches the native dialog cancel event", () => {
    const onClose = vi.fn();
    renderWithIntl(sheet.renderSheet(onClose, "Work Detail"));

    fireEvent(screen.getByTestId(sheet.dialogTestId), new Event("cancel", { bubbles: true }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("fires onClose when dragged past the dismiss threshold", () => {
    const onClose = vi.fn();
    renderWithIntl(sheet.renderSheet(onClose, "Work Detail"));

    sheet.dragPastThreshold(screen.getByTestId(sheet.dragTargetTestId));

    expect(onClose).toHaveBeenCalled();
  });
});
