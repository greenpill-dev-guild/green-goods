/**
 * @vitest-environment happy-dom
 *
 * dialogCloseSafetyNet — releases the Radix body pointer-events lock and
 * neutralizes frozen exit nodes, but only when no dialog is actually open.
 */

import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, renderWithProviders, screen } from "../../test-utils";
import { AdminDialog } from "../../../components/AdminDialog";
import { AdminSideSheet } from "../../../components/AdminSideSheet";
import { releaseStuckDialogArtifacts } from "../../../components/Layout/dialogCloseSafetyNet";

function addNode(html: string): void {
  document.body.insertAdjacentHTML("beforeend", html);
}

describe("releaseStuckDialogArtifacts", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    document.body.style.pointerEvents = "";
  });

  it("clears a stuck body lock when no dialog is open", () => {
    document.body.style.pointerEvents = "none";

    releaseStuckDialogArtifacts(document);

    expect(document.body.style.pointerEvents).toBe("");
  });

  it("finishes a stranded exit through its lifecycle event without mutating React-owned attributes", () => {
    addNode(
      '<div data-component="AdminDialog" data-slot="surface" data-state="closed" id="ghost"></div>'
    );

    const ghost = document.getElementById("ghost")!;
    const onEnd = vi.fn();
    ghost.addEventListener("animationend", onEnd);
    releaseStuckDialogArtifacts(document);

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(ghost.hasAttribute("data-instant-exit")).toBe(false);
  });

  it("leaves a running exit animation and its pointer lock to Radix", () => {
    addNode(
      '<div data-component="AdminDialog" data-slot="surface" data-state="closed" id="closing"></div>'
    );
    const closing = document.getElementById("closing")!;
    vi.spyOn(closing, "getAnimations").mockReturnValue([
      { playState: "running", pending: false } as Animation,
    ]);
    const onEnd = vi.fn();
    closing.addEventListener("animationend", onEnd);
    document.body.style.pointerEvents = "none";

    releaseStuckDialogArtifacts(document);

    expect(onEnd).not.toHaveBeenCalled();
    expect(document.body.style.pointerEvents).toBe("none");
  });

  it.each([
    { name: "dialog", Dialog: AdminDialog },
    { name: "side sheet", Dialog: AdminSideSheet },
  ])("unmounts a stranded $name and restores background accessibility", ({ Dialog }) => {
    const originalStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
      const style = originalStyle(element, pseudo);
      if (!element.matches('[data-component="AdminDialog"],[data-component="AdminSideSheet"]'))
        return style;
      return new Proxy(style, {
        get(target, property) {
          if (property === "animationName")
            return element.getAttribute("data-state") === "open" ? "enter" : "exit";
          if (property === "display") return "block";
          return Reflect.get(target, property);
        },
      });
    });
    function Example() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open Again
          </button>
          <Dialog open={open} onOpenChange={setOpen} title="Edit Garden">
            <p>Fields</p>
          </Dialog>
        </>
      );
    }
    renderWithProviders(<Example />);
    const surface = screen.getByRole("dialog");
    fireEvent.animationStart(surface, { animationName: "enter" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(surface).toHaveAttribute("data-state", "closed");
    expect(surface).toBeInTheDocument();

    act(() => releaseStuckDialogArtifacts(document));

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Open Again" })).toBeInTheDocument();
    expect(document.body.style.pointerEvents).toBe("");
  });

  it("does nothing while a dialog is legitimately open", () => {
    document.body.style.pointerEvents = "none";
    addNode('<div role="dialog" data-state="open"></div>');
    addNode(
      '<div data-component="AdminDialog" data-slot="overlay" data-state="closed" id="closing"></div>'
    );

    releaseStuckDialogArtifacts(document);

    // The open dialog owns the lock — nothing may be released behind it.
    expect(document.body.style.pointerEvents).toBe("none");
    expect(document.getElementById("closing")?.hasAttribute("data-instant-exit")).toBe(false);
  });

  it("respects an open alertdialog (confirm stacked over a flow)", () => {
    document.body.style.pointerEvents = "none";
    addNode('<div role="alertdialog" data-state="open"></div>');

    releaseStuckDialogArtifacts(document);

    expect(document.body.style.pointerEvents).toBe("none");
  });
});
