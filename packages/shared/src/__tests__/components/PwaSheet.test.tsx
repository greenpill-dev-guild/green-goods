/** @vitest-environment jsdom */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PwaSheet } from "../../components/Dialog/PwaSheet";
import { useUIStore } from "../../stores/useUIStore";

describe("PwaSheet", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.classList.remove("modal-open");
    useUIStore.setState({ openSheetCount: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.classList.remove("modal-open");
  });

  it("keeps its lock while closing and finishes closing on page hide", () => {
    const view = render(
      <PwaSheet open onClose={vi.fn()} ariaLabel="Work sheet">
        <button type="button">Inside</button>
      </PwaSheet>
    );

    expect(document.documentElement).toHaveClass("modal-open");

    view.rerender(
      <PwaSheet open={false} onClose={vi.fn()} ariaLabel="Work sheet">
        <button type="button">Inside</button>
      </PwaSheet>
    );

    expect(screen.getByRole("dialog")).toHaveAttribute("data-state", "closed");
    expect(document.documentElement).toHaveClass("modal-open");

    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("dismisses with Escape from a focused child control", () => {
    const close = vi.fn();
    render(
      <PwaSheet open onClose={close} ariaLabel="Draft">
        <button>Continue</button>
      </PwaSheet>
    );
    const button = screen.getByRole("button", { name: "Continue" });
    button.focus();
    fireEvent.keyDown(button, { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
  });
  it("renders the shared header and labels the dialog by its title", () => {
    const close = vi.fn();
    render(
      <PwaSheet
        open
        onClose={close}
        title="Delete Draft?"
        description="This removes the draft from this device."
        closeLabel="Close"
      >
        <button type="button">Delete</button>
      </PwaSheet>
    );
    const dialog = screen.getByRole("dialog", { name: "Delete Draft?" });
    expect(dialog).toHaveAccessibleDescription("This removes the draft from this device.");
    expect(screen.getByTestId("pwa-sheet-drag-handle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" }).parentElement).toHaveAttribute(
      "data-slot",
      "body"
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(close).toHaveBeenCalledOnce();
  });
  it("keeps every dismissal path closed while preventClose is set", () => {
    const close = vi.fn();
    render(
      <PwaSheet open onClose={close} title="Deleting…" closeLabel="Close" preventClose>
        <button type="button">Wait</button>
      </PwaSheet>
    );
    expect(screen.getByTestId("pwa-sheet-close")).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.pointerDown(screen.getByTestId("pwa-sheet-overlay"));
    fireEvent.click(screen.getByTestId("pwa-sheet-overlay"));
    expect(close).not.toHaveBeenCalled();
  });
  it("closes on a full press of the close button, which sits outside the drag gesture", () => {
    const close = vi.fn();
    render(
      <PwaSheet open onClose={close} title="Sheet" closeLabel="Close">
        <p>Body</p>
      </PwaSheet>
    );
    const closeButton = screen.getByTestId("pwa-sheet-close");
    expect(closeButton.closest("[data-drag-region]")).toBeNull();

    // A real press, not a bare click: inside a gesture's bound region its tap
    // filter swallows this click whenever the gesture missed the press.
    fireEvent.pointerDown(closeButton, { pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(closeButton, { pointerId: 1 });
    fireEvent.click(closeButton, { detail: 1 });

    expect(close).toHaveBeenCalledOnce();
  });

  describe("backdrop tap", () => {
    it("closes on a tap of the dimmed area", () => {
      const close = vi.fn();
      render(
        <PwaSheet open onClose={close} title="Sheet" closeLabel="Close">
          <button type="button">Inside</button>
        </PwaSheet>
      );
      // The scrim fills the overlay, so it is what a tap outside the sheet lands on.
      const scrim = screen
        .getByTestId("pwa-sheet-overlay")
        .querySelector<HTMLElement>('[data-slot="scrim"]');

      fireEvent.pointerDown(scrim as HTMLElement);
      fireEvent.click(scrim as HTMLElement);

      expect(close).toHaveBeenCalledOnce();
    });

    it("ignores a click that no press on the backdrop came before", () => {
      const close = vi.fn();
      render(
        <PwaSheet open onClose={close} title="Sheet" closeLabel="Close">
          <button type="button">Inside</button>
        </PwaSheet>
      );

      // A sheet that opens under a finger already down receives that finger's click.
      fireEvent.click(screen.getByTestId("pwa-sheet-overlay"));

      expect(close).not.toHaveBeenCalled();
    });

    it("stays open for taps inside the sheet", () => {
      const close = vi.fn();
      render(
        <PwaSheet open onClose={close} title="Sheet" closeLabel="Close">
          <button type="button">Inside</button>
        </PwaSheet>
      );
      const inside = screen.getByRole("button", { name: "Inside" });

      fireEvent.pointerDown(inside);
      fireEvent.click(inside);

      expect(close).not.toHaveBeenCalled();
    });

    it("stays open when a press that began inside the sheet ends on the backdrop", () => {
      const close = vi.fn();
      render(
        <PwaSheet open onClose={close} title="Sheet" closeLabel="Close">
          <p>Selectable text</p>
        </PwaSheet>
      );

      // A text selection dragged out of the sheet: the browser dispatches the
      // click on the common ancestor of the press and the release, the overlay.
      fireEvent.pointerDown(screen.getByText("Selectable text"));
      fireEvent.click(screen.getByTestId("pwa-sheet-overlay"));

      expect(close).not.toHaveBeenCalled();
    });
  });

  it("exposes destructive confirmations as an alertdialog", () => {
    render(
      <PwaSheet open onClose={vi.fn()} role="alertdialog" title="Discard draft?" closeLabel="Close">
        <button type="button">Discard</button>
      </PwaSheet>
    );
    expect(screen.getByRole("alertdialog", { name: "Discard draft?" })).toBeInTheDocument();
  });
  it("owns its layout without utility classes on the sheet chrome", () => {
    render(
      <PwaSheet open onClose={vi.fn()} ariaLabel="Sheet" panelClassName="consumer-panel">
        <p>Body</p>
      </PwaSheet>
    );
    // Tailwind does not scan packages/shared, so the geometry must come from
    // the [data-component="PwaSheet"] rules in utilities.css, never from
    // classes authored here.
    expect(screen.getByRole("dialog").getAttribute("class")).toBe("consumer-panel");
    expect(screen.getByTestId("pwa-sheet-overlay")).not.toHaveAttribute("class");
    expect(screen.getByTestId("pwa-sheet-drag-handle")).not.toHaveAttribute("class");
  });
  it("returns focus to the element that opened it", () => {
    const opener = document.createElement("button");
    opener.textContent = "Open";
    document.body.append(opener);
    opener.focus();
    expect(opener).toHaveFocus();
    const view = render(
      <PwaSheet open onClose={vi.fn()} title="Sheet" closeLabel="Close">
        <button type="button">Inside</button>
      </PwaSheet>
    );
    expect(screen.getByTestId("pwa-sheet-close")).toHaveFocus();
    view.rerender(
      <PwaSheet open={false} onClose={vi.fn()} title="Sheet" closeLabel="Close">
        <button type="button">Inside</button>
      </PwaSheet>
    );
    expect(opener).toHaveFocus();
    opener.remove();
  });
  it("keeps the page hidden until the last of two overlapping sheets closes", () => {
    const background = document.createElement("main");
    document.body.append(background);
    const first = render(
      <PwaSheet open onClose={vi.fn()} ariaLabel="First">
        <p>First</p>
      </PwaSheet>
    );
    const second = render(
      <PwaSheet open onClose={vi.fn()} ariaLabel="Second">
        <p>Second</p>
      </PwaSheet>
    );
    expect(background).toHaveAttribute("aria-hidden", "true");

    // Close the first sheet while the second is still open.
    first.rerender(
      <PwaSheet open={false} onClose={vi.fn()} ariaLabel="First">
        <p>First</p>
      </PwaSheet>
    );
    expect(background).toHaveAttribute("aria-hidden", "true");

    second.rerender(
      <PwaSheet open={false} onClose={vi.fn()} ariaLabel="Second">
        <p>Second</p>
      </PwaSheet>
    );
    expect(background).not.toHaveAttribute("aria-hidden");
    background.remove();
  });
  it("closes only the topmost of two stacked sheets on Escape", () => {
    const closeFirst = vi.fn();
    const closeSecond = vi.fn();
    const first = render(
      <PwaSheet open onClose={closeFirst} title="Profile Photo" closeLabel="Close">
        <p>Photo</p>
      </PwaSheet>
    );
    const second = render(
      <PwaSheet
        open
        onClose={closeSecond}
        role="alertdialog"
        title="Remove Photo?"
        closeLabel="Close"
      />
    );

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(closeSecond).toHaveBeenCalledOnce();
    expect(closeFirst).not.toHaveBeenCalled();

    // A parent re-render of the lower sheet must not lift it above the confirmation.
    first.rerender(
      <PwaSheet open onClose={closeFirst} title="Profile Photo" closeLabel="Close">
        <p>Photo again</p>
      </PwaSheet>
    );
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(closeSecond).toHaveBeenCalledTimes(2);
    expect(closeFirst).not.toHaveBeenCalled();

    second.rerender(
      <PwaSheet
        open={false}
        onClose={closeSecond}
        role="alertdialog"
        title="Remove Photo?"
        closeLabel="Close"
      />
    );
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(closeFirst).toHaveBeenCalledOnce();
    first.unmount();
    second.unmount();
  });
  it("renders into <body> so a page layer can never stack it under app chrome", () => {
    const page = (open: boolean) => (
      <div data-testid="page-layer" style={{ position: "fixed", zIndex: 10 }}>
        <p>Page content beside the sheet</p>
        <PwaSheet open={open} onClose={vi.fn()} ariaLabel="Deep">
          <p>Deep</p>
        </PwaSheet>
      </div>
    );
    const view = render(page(true));
    const overlay = screen.getByTestId("pwa-sheet-overlay");
    expect(overlay.parentElement).toBe(document.body);
    expect(screen.getByTestId("page-layer")).not.toContainElement(overlay);
    expect(view.container).toHaveAttribute("aria-hidden", "true");

    view.rerender(page(false));
    expect(view.container).not.toHaveAttribute("aria-hidden");
  });

  it("names its height tier on the surface, compact by default", () => {
    const view = render(
      <PwaSheet open onClose={vi.fn()} ariaLabel="Tier">
        <p>Tier</p>
      </PwaSheet>
    );
    expect(screen.getByTestId("pwa-sheet")).toHaveAttribute("data-sheet-size", "compact");

    view.rerender(
      <PwaSheet open onClose={vi.fn()} ariaLabel="Tier" size="tall">
        <p>Tier</p>
      </PwaSheet>
    );
    expect(screen.getByTestId("pwa-sheet")).toHaveAttribute("data-sheet-size", "tall");
  });

  it("registers as an open sheet only while open, so the AppBar can step aside", () => {
    const sheet = (open: boolean) => (
      <PwaSheet open={open} onClose={vi.fn()} ariaLabel="Presence">
        <p>Presence</p>
      </PwaSheet>
    );
    const view = render(sheet(true));
    expect(useUIStore.getState().openSheetCount).toBe(1);

    view.rerender(sheet(false));
    expect(useUIStore.getState().openSheetCount).toBe(0);

    view.rerender(sheet(true));
    view.unmount();
    expect(useUIStore.getState().openSheetCount).toBe(0);
  });
  it("hides sibling content from assistive tech only while open", () => {
    const sibling = document.createElement("main");
    document.body.append(sibling);
    const view = render(
      <PwaSheet open onClose={vi.fn()} ariaLabel="Sheet">
        <p>Body</p>
      </PwaSheet>
    );
    expect(sibling).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    view.rerender(
      <PwaSheet open={false} onClose={vi.fn()} ariaLabel="Sheet">
        <p>Body</p>
      </PwaSheet>
    );
    expect(sibling).not.toHaveAttribute("aria-hidden");
    sibling.remove();
  });

  it("pins its actions in the shared bar under the body (DL-016)", () => {
    const onConfirm = vi.fn();
    render(
      <PwaSheet
        open
        onClose={vi.fn()}
        title="Continue Previous Work?"
        closeLabel="Close"
        actions={{
          primary: { label: "Continue Draft", onClick: onConfirm },
          secondary: { label: "Start Fresh" },
        }}
      >
        <p>Saved on this device</p>
      </PwaSheet>
    );
    const surface = screen.getByRole("dialog", { name: "Continue Previous Work?" });
    const body = surface.querySelector('[data-component="PwaSheet"][data-slot="body"]');
    const actions = surface.querySelector('[data-component="SheetActions"]');
    expect(body).toHaveAttribute("data-scroll-edge", "both");
    expect(actions?.parentElement).toBe(surface);
    expect(body?.nextElementSibling).toBe(actions);
    fireEvent.click(screen.getByRole("button", { name: "Continue Draft" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
  describe("drag to dismiss", () => {
    const SHEET_HEIGHT = 400;
    // use-gesture starts a drag once the pointer has travelled this far, and measures from there.
    const DRAG_START = 3;
    let offsetHeight: PropertyDescriptor | undefined;

    beforeEach(() => {
      // jsdom lays nothing out and has no pointer capture.
      offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
        configurable: true,
        get: () => SHEET_HEIGHT,
      });
      Element.prototype.setPointerCapture = vi.fn();
      Element.prototype.hasPointerCapture = vi.fn(() => false);
      Element.prototype.releasePointerCapture = vi.fn();
    });

    afterEach(() => {
      if (offsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeight);
      Reflect.deleteProperty(Element.prototype, "setPointerCapture");
      Reflect.deleteProperty(Element.prototype, "hasPointerCapture");
      Reflect.deleteProperty(Element.prototype, "releasePointerCapture");
      vi.restoreAllMocks();
    });

    /** A pointer pressed on `target`. Steps default to 100 ms, far too slow to read as a flick. */
    function pointerOn(target: HTMLElement) {
      let time = 1000;
      const fire = (type: string, clientY: number, buttons: number, elapsedMs: number) => {
        time += elapsedMs;
        const event = new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
          clientX: 100,
          clientY,
          button: type === "pointermove" ? -1 : 0,
          buttons,
        });
        Object.defineProperty(event, "timeStamp", { value: time });
        fireEvent(target, event);
      };
      return {
        down: () => fire("pointerdown", 0, 1, 0),
        moveTo: (y: number, elapsedMs = 100) => fire("pointermove", y, 1, elapsedMs),
        up: (y: number, elapsedMs = 100) => fire("pointerup", y, 0, elapsedMs),
      };
    }
    const pointerOnHandle = () => pointerOn(screen.getByTestId("pwa-sheet-drag-handle"));

    const dragOffset = () =>
      Number.parseFloat(screen.getByTestId("pwa-sheet").style.translate.split(" ")[1] ?? "0");
    const dragDim = () =>
      screen.getByTestId("pwa-sheet-overlay").querySelector<HTMLElement>('[data-slot="drag-dim"]');

    function renderSheet(close = vi.fn(), props: { preventClose?: boolean } = {}) {
      const renders = { count: 0 };
      function Content() {
        renders.count += 1;
        return <p>Content</p>;
      }
      render(
        <PwaSheet open onClose={close} title="Sheet" closeLabel="Close" {...props}>
          <Content />
        </PwaSheet>
      );
      return renders;
    }

    it("follows the pointer on its own channels without re-rendering the content", () => {
      const renders = renderSheet();
      const rendersAtRest = renders.count;
      const pointer = pointerOnHandle();

      pointer.down();
      pointer.moveTo(DRAG_START);
      pointer.moveTo(DRAG_START + 40);

      // `translate` and the drag-dim wrapper: the keyframes own `transform` and the scrim.
      expect(dragOffset()).toBe(40);
      expect(screen.getByTestId("pwa-sheet").style.transform).toBe("");
      expect(Number(dragDim()?.style.opacity)).toBeCloseTo(1 - 40 / SHEET_HEIGHT);
      expect(screen.getByTestId("pwa-sheet-overlay")).toHaveAttribute("data-dragging");
      expect(renders.count).toBe(rendersAtRest);
    });

    it("never lifts above its resting position", () => {
      renderSheet();
      const pointer = pointerOnHandle();

      pointer.down();
      pointer.moveTo(DRAG_START);
      pointer.moveTo(-60);

      expect(dragOffset()).toBe(0);
    });

    it("settles back when released short of a quarter of its height", () => {
      const close = vi.fn();
      renderSheet(close);
      const pointer = pointerOnHandle();

      pointer.down();
      pointer.moveTo(DRAG_START);
      pointer.moveTo(DRAG_START + 90);
      pointer.up(DRAG_START + 90);

      expect(close).not.toHaveBeenCalled();
      // Letting go hands both channels back to the CSS transitions.
      expect(screen.getByTestId("pwa-sheet").style.translate).toBe("");
      expect(dragDim()?.style.opacity).toBe("");
      expect(screen.getByTestId("pwa-sheet-overlay")).not.toHaveAttribute("data-dragging");
    });

    it("closes when released past a quarter of its height", () => {
      const close = vi.fn();
      renderSheet(close);
      const pointer = pointerOnHandle();

      pointer.down();
      pointer.moveTo(DRAG_START);
      pointer.moveTo(DRAG_START + 110);
      pointer.up(DRAG_START + 110);

      expect(close).toHaveBeenCalledOnce();
      expect(screen.getByTestId("pwa-sheet").style.translate).toBe("");
    });

    it("closes on a quick downward flick, however short", () => {
      const close = vi.fn();
      renderSheet(close);
      const pointer = pointerOnHandle();

      pointer.down();
      pointer.moveTo(DRAG_START, 16);
      pointer.moveTo(DRAG_START + 40, 16);
      pointer.up(DRAG_START + 40, 8);

      expect(close).toHaveBeenCalledOnce();
    });

    it("stays open on a quick upward flick, however far down it was", () => {
      const close = vi.fn();
      renderSheet(close);
      const pointer = pointerOnHandle();

      pointer.down();
      pointer.moveTo(DRAG_START);
      pointer.moveTo(DRAG_START + 250);
      pointer.moveTo(DRAG_START + 200, 16);
      pointer.up(DRAG_START + 200, 8);

      expect(close).not.toHaveBeenCalled();
    });

    it("picks a settling sheet up where it is", () => {
      renderSheet();
      const surface = screen.getByTestId("pwa-sheet");
      const computedStyle = window.getComputedStyle.bind(window);
      vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
        const style = computedStyle(element, pseudo);
        if (element !== surface) return style;
        return new Proxy(style, {
          get: (target, key) => {
            if (key === "translate") return "0px 25px";
            const value = Reflect.get(target, key);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      });
      const pointer = pointerOnHandle();

      pointer.down();
      pointer.moveTo(DRAG_START);
      pointer.moveTo(DRAG_START + 10);

      expect(dragOffset()).toBe(35);
    });

    it("drags from the title block under the grip as well", () => {
      renderSheet();
      const pointer = pointerOn(screen.getByRole("heading", { name: "Sheet" }));

      pointer.down();
      pointer.moveTo(DRAG_START);
      pointer.moveTo(DRAG_START + 40);

      expect(dragOffset()).toBe(40);
    });

    it("keeps the title out of the grab area when the sheet has no grip or cannot close", () => {
      const header = () =>
        document.body.querySelector('[data-component="SheetHeader"][data-slot="text"]');

      const draggable = render(
        <PwaSheet open onClose={vi.fn()} title="Sheet" closeLabel="Close" />
      );
      expect(header()).toHaveAttribute("data-drag-region");
      draggable.unmount();

      const gripless = render(
        <PwaSheet open onClose={vi.fn()} title="Sheet" closeLabel="Close" showDragHandle={false} />
      );
      expect(header()).not.toHaveAttribute("data-drag-region");
      gripless.unmount();

      render(<PwaSheet open onClose={vi.fn()} title="Sheet" closeLabel="Close" preventClose />);
      expect(header()).not.toHaveAttribute("data-drag-region");
    });

    it("marks a flicked close, and only that one, for the decelerating exit", () => {
      const close = vi.fn();
      renderSheet(close);
      const overlay = screen.getByTestId("pwa-sheet-overlay");
      const pointer = pointerOnHandle();

      pointer.down();
      pointer.moveTo(DRAG_START, 16);
      pointer.moveTo(DRAG_START + 40, 16);
      pointer.up(DRAG_START + 40, 8);
      expect(close).toHaveBeenCalledOnce();
      expect(overlay).toHaveAttribute("data-flicked");

      // This consumer kept the sheet open; the next close starts from rest.
      fireEvent.click(screen.getByTestId("pwa-sheet-close"));
      expect(close).toHaveBeenCalledTimes(2);
      expect(overlay).not.toHaveAttribute("data-flicked");
    });

    it("does not mark a slow release as flicked", () => {
      const close = vi.fn();
      renderSheet(close);
      const pointer = pointerOnHandle();

      pointer.down();
      pointer.moveTo(DRAG_START);
      pointer.moveTo(DRAG_START + 110);
      pointer.up(DRAG_START + 110);

      expect(close).toHaveBeenCalledOnce();
      expect(screen.getByTestId("pwa-sheet-overlay")).not.toHaveAttribute("data-flicked");
    });

    it("does not drag while preventClose is set", () => {
      const close = vi.fn();
      renderSheet(close, { preventClose: true });
      const pointer = pointerOnHandle();

      pointer.down();
      pointer.moveTo(DRAG_START);
      pointer.moveTo(DRAG_START + 300);
      pointer.up(DRAG_START + 300);

      expect(dragOffset()).toBe(0);
      expect(close).not.toHaveBeenCalled();
    });
  });

  it("skips the empty body when a titled sheet only has actions", () => {
    render(
      <PwaSheet
        open
        onClose={vi.fn()}
        title="Join Garden"
        closeLabel="Close"
        actions={{ primary: { label: "Join" }, secondary: { label: "Cancel" } }}
      />
    );
    const surface = screen.getByRole("dialog", { name: "Join Garden" });
    expect(surface.querySelector('[data-slot="body"]')).toBeNull();
    expect(
      surface.querySelector('[data-component="SheetHeader"][data-slot="root"]')?.nextElementSibling
    ).toHaveAttribute("data-component", "SheetActions");
  });
});
