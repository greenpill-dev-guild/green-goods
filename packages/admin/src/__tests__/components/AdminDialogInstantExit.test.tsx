/**
 * @vitest-environment jsdom
 *
 * AdminDialog instant-exit — a close that happens while the tab is hidden
 * marks the surface + scrim with data-instant-exit so the exit animation is
 * dropped (frozen animations in hidden tabs never fire animationend, which
 * would strand Radix's exit node and body pointer-events lock).
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminDialog } from "../../components/AdminDialog";

function stubVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

function renderDialog(onOpenChange: (open: boolean) => void) {
  return render(
    <IntlProvider locale="en" messages={{ "app.common.close": "Close" }}>
      <AdminDialog open onOpenChange={onOpenChange} title="Test dialog">
        <p>Body</p>
      </AdminDialog>
    </IntlProvider>
  );
}

describe("AdminDialog instant exit", () => {
  afterEach(() => {
    stubVisibility("visible");
  });

  it("marks the dialog for instant exit when closed in a hidden tab", async () => {
    const user = userEvent.setup();
    // Parent deliberately keeps `open` true so the pre-unmount render is
    // observable — in production the attribute rides the same commit that
    // flips data-state to closed.
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);

    stubVisibility("hidden");
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    const surface = document.querySelector('[data-component="AdminDialog"][data-slot="surface"]');
    expect(surface?.hasAttribute("data-instant-exit")).toBe(true);
    const overlay = document.querySelector('[data-component="AdminDialog"][data-slot="overlay"]');
    expect(overlay?.hasAttribute("data-instant-exit")).toBe(true);
  });

  it("closes without the instant-exit mark when the tab is visible", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);

    stubVisibility("visible");
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    const surface = document.querySelector('[data-component="AdminDialog"][data-slot="surface"]');
    expect(surface?.hasAttribute("data-instant-exit")).toBe(false);
  });
});
