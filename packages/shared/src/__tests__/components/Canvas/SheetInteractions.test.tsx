/**
 * Focused Canvas sheet interaction tests.
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BottomSheet } from "../../../components/Canvas/BottomSheet";
import {
  getCanvasSheetDragIntent,
  getCanvasSheetTransform,
} from "../../../components/Canvas/CanvasSheetInternals";
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
  renderSheetState: (props: {
    open: boolean;
    onClose: () => void;
    title?: string;
    children?: ReactElement | null;
  }) => ReactElement;
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
    renderSheetState: ({ open, onClose, title, children }) => (
      <LeftSheet open={open} onClose={onClose} title={title}>
        {children}
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
    renderSheetState: ({ open, onClose, title, children }) => (
      <RightSheet open={open} onClose={onClose} title={title}>
        {children}
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
    renderSheetState: ({ open, onClose, title, children }) => (
      <BottomSheet open={open} onClose={onClose} title={title}>
        {children}
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

  it("exposes semantic component, slot, and open-state hooks", () => {
    renderWithIntl(sheet.renderSheet(vi.fn(), "Work Detail"));

    const dialog = screen.getByTestId(sheet.dialogTestId);
    const overlay = screen.getByTestId(sheet.overlayTestId);
    const surface =
      sheet.name === "BottomSheet"
        ? screen.getByTestId("bottom-sheet")
        : screen.getByTestId(sheet.dragTargetTestId);

    expect(dialog).toHaveAttribute("data-component", sheet.name);
    expect(dialog).toHaveAttribute("data-slot", "dialog");
    expect(dialog).toHaveAttribute("data-state", "open");
    expect(overlay).toHaveAttribute("data-slot", "overlay");
    expect(surface).toHaveAttribute("data-slot", "surface");
    expect(surface).toHaveAttribute("data-state", "open");
  });

  it("keeps the last content mounted while the close animation runs", () => {
    const onClose = vi.fn();
    const { rerender } = renderWithIntl(
      sheet.renderSheetState({
        open: true,
        onClose,
        title: "Work Detail",
        children: <p>Closing content</p>,
      })
    );

    rerender(
      <IntlProvider locale="en" messages={{ "app.common.close": "Close" }}>
        {sheet.renderSheetState({
          open: false,
          onClose,
          title: undefined,
          children: null,
        })}
      </IntlProvider>
    );

    expect(screen.getByText("Closing content")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Work Detail" })).toBeInTheDocument();
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

describe("Canvas sheet preventClose", () => {
  beforeEach(() => {
    installPointerPolyfills();
  });

  it("blocks LeftSheet overlay, Escape, close button, and drag dismiss paths", () => {
    const onClose = vi.fn();
    renderWithIntl(
      <LeftSheet open onClose={onClose} title="Protected sheet" preventClose>
        <p>Sheet content</p>
      </LeftSheet>
    );

    fireEvent.click(screen.getByTestId("left-sheet-overlay"));
    fireEvent(screen.getByTestId("left-sheet-dialog"), new Event("cancel", { bubbles: true }));
    fireEvent.click(screen.getByTestId("left-sheet-close"));
    sheetCases[0].dragPastThreshold(screen.getByTestId("left-sheet"));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("left-sheet-close")).toBeDisabled();
  });

  it("blocks BottomSheet overlay, Escape, close button, and drag dismiss paths", () => {
    const onClose = vi.fn();
    renderWithIntl(
      <BottomSheet open onClose={onClose} title="Protected sheet" preventClose>
        <p>Sheet content</p>
      </BottomSheet>
    );

    fireEvent.click(screen.getByTestId("bottom-sheet-overlay"));
    fireEvent(screen.getByTestId("bottom-sheet-dialog"), new Event("cancel", { bubbles: true }));
    fireEvent.click(screen.getByTestId("bottom-sheet-close"));
    sheetCases[2].dragPastThreshold(screen.getByTestId("bottom-sheet-drag-handle"));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("bottom-sheet-close")).toBeDisabled();
  });
});

describe("BottomSheet bounded geometry", () => {
  beforeEach(() => {
    installPointerPolyfills();
  });

  it("uses the canvas sheet bounds and nav-safe mobile inset", () => {
    const portalContainer = document.createElement("div");
    document.body.appendChild(portalContainer);

    renderWithIntl(
      <BottomSheet open onClose={vi.fn()} title="Mobile inspector" container={portalContainer}>
        <p>Sheet content</p>
      </BottomSheet>
    );

    const dialog = screen.getByTestId("bottom-sheet-dialog");
    const surface = screen.getByTestId("bottom-sheet");

    expect(portalContainer).toContainElement(dialog);
    expect(dialog).toHaveStyle({
      height: "auto",
      inset:
        "var(--admin-sheet-top, calc(var(--admin-appbar-height, 3.5rem) + 0.5rem)) 0 var(--admin-sheet-bottom, 6.25rem) 0",
      position: "absolute",
      width: "auto",
    });
    expect(surface).toHaveStyle({
      borderRadius: "var(--radius-sheet, 24px)",
      left: "var(--admin-sheet-mobile-side-inset, 0.75rem)",
      maxHeight: "min(85%, 100%)",
      right: "var(--admin-sheet-mobile-side-inset, 0.75rem)",
      width: "auto",
    });
  });
});

describe("Canvas sheet drag motion", () => {
  it("snaps back when a side-sheet drag ends below the dismiss threshold", () => {
    expect(
      getCanvasSheetDragIntent({
        edge: "right",
        movementX: 48,
        movementY: 0,
        velocityX: 0.1,
        velocityY: 0,
        directionX: 1,
        directionY: 0,
        sizePx: 400,
        last: true,
        prefersReducedMotion: false,
      })
    ).toEqual({ kind: "snap" });
  });

  it("dismisses only after the active drag crosses the configured threshold", () => {
    expect(
      getCanvasSheetDragIntent({
        edge: "bottom",
        movementX: 0,
        movementY: 132,
        velocityX: 0,
        velocityY: 0.1,
        directionX: 0,
        directionY: 1,
        sizePx: 420,
        last: true,
        prefersReducedMotion: false,
      })
    ).toEqual({ kind: "dismiss" });
  });

  it("keeps the side-sheet close handoff distance centralized", () => {
    expect(getCanvasSheetTransform("left", -100)).toBe("translateX(calc(-100% - 24px))");
    expect(getCanvasSheetTransform("right", 100)).toBe("translateX(calc(100% + 24px))");
    expect(getCanvasSheetTransform("bottom", 100)).toBe("translateY(100%)");
  });
});
