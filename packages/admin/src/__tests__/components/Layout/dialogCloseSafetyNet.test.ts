/**
 * @vitest-environment jsdom
 *
 * dialogCloseSafetyNet — releases the Radix body pointer-events lock and
 * neutralizes frozen exit nodes, but only when no dialog is actually open.
 */

import { afterEach, describe, expect, it } from "vitest";
import { releaseStuckDialogArtifacts } from "../../../components/Layout/dialogCloseSafetyNet";

function addNode(html: string): void {
  document.body.insertAdjacentHTML("beforeend", html);
}

describe("releaseStuckDialogArtifacts", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.body.style.pointerEvents = "";
  });

  it("clears a stuck body lock when no dialog is open", () => {
    document.body.style.pointerEvents = "none";

    releaseStuckDialogArtifacts(document);

    expect(document.body.style.pointerEvents).toBe("");
  });

  it("marks lingering closed dialog nodes for instant exit", () => {
    addNode(
      '<div data-component="AdminDialog" data-slot="surface" data-state="closed" id="ghost"></div>'
    );

    releaseStuckDialogArtifacts(document);

    expect(document.getElementById("ghost")?.hasAttribute("data-instant-exit")).toBe(true);
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
