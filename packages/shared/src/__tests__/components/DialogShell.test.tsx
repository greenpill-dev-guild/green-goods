/** @vitest-environment happy-dom */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DialogShell } from "../../components/Dialog/DialogShell";
import { useUIStore } from "../../stores/useUIStore";

const messages = {
  "app.common.cancel": "Cancel",
  "app.common.close": "Close",
  "app.common.confirm": "Confirm",
};

/** Mirror the viewport the shared dialogs switch on (`PWA_SHEET_MEDIA_QUERY`). */
function stubViewportWidth(widthPx: number) {
  const queries: Array<EventTarget & { media: string; matches: boolean }> = [];
  const matches = (query: string) => query.includes("max-width: 639px") && widthPx <= 639;
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => {
      const media = Object.assign(new EventTarget(), {
        matches: matches(query),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });
      queries.push(media);
      return media;
    }),
  });
  return (width: number) => {
    widthPx = width;
    for (const media of queries) {
      const next = matches(media.media);
      if (next === media.matches) continue;
      media.matches = next;
      media.dispatchEvent(Object.assign(new Event("change"), { matches: next }));
    }
  };
}

function wrap(node: React.ReactElement) {
  return (
    <IntlProvider locale="en" messages={messages}>
      {node}
    </IntlProvider>
  );
}

function ReviewReward() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Review reward
      </button>
      <DialogShell
        open={open}
        onOpenChange={setOpen}
        title="Review reward"
        description="Check the reward before continuing."
        actions={{ secondary: { label: "Cancel", onClick: () => setOpen(false) } }}
      >
        <input aria-label="Recipient" />
      </DialogShell>
    </>
  );
}

afterEach(() => {
  stubViewportWidth(1024);
});

describe("DialogShell", () => {
  it.each([
    [375, "Escape"],
    [375, "Close"],
    [375, "Cancel"],
    [1280, "Escape"],
    [1280, "Close"],
    [1280, "Cancel"],
  ] as const)("returns keyboard focus to its opener at %ipx after %s", async (width, dismiss) => {
    stubViewportWidth(width);
    render(wrap(<ReviewReward />));
    const user = userEvent.setup();
    const opener = screen.getByRole("button", { name: "Review reward" });
    await user.tab();
    expect(opener).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "Review reward" })).toBeInTheDocument();
    if (dismiss === "Escape") await user.keyboard("{Escape}");
    else await user.click(screen.getByRole("button", { name: dismiss }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(opener).toHaveFocus();
    });
  });

  it.each([
    [1280, 375],
    [375, 1280],
  ])("preserves the opener when an open dialog resizes from %ipx to %ipx", async (start, end) => {
    const resize = stubViewportWidth(start);
    render(wrap(<ReviewReward />));
    const user = userEvent.setup();
    const opener = screen.getByRole("button", { name: "Review reward" });
    await user.tab();
    await user.keyboard("{Enter}");
    act(() => resize(end));
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement)
    );
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(opener).toHaveFocus();
    });
  });

  it("renders the shared bottom sheet below 640px with the shell's header", () => {
    stubViewportWidth(390);
    const onOpenChange = vi.fn();
    render(
      wrap(
        <DialogShell
          open
          onOpenChange={onOpenChange}
          title="Withdraw offer"
          description="Tell the garden why."
        >
          <p>Reason field</p>
        </DialogShell>
      )
    );
    const dialog = screen.getByRole("dialog", { name: "Withdraw offer" });
    expect(dialog).toHaveAttribute("data-component", "PwaSheet");
    expect(dialog).toHaveAttribute("data-testid", "dialog-shell");
    expect(dialog).toHaveAccessibleDescription("Tell the garden why.");
    expect(screen.getByText("Reason field").parentElement).toHaveAttribute("data-slot", "body");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("honors preventClose and hideCloseButton on the sheet", () => {
    stubViewportWidth(390);
    const onOpenChange = vi.fn();
    render(
      wrap(
        <DialogShell
          open
          onOpenChange={onOpenChange}
          title="Linking work"
          preventClose
          hideCloseButton
        >
          <p>Working…</p>
        </DialogShell>
      )
    );
    expect(screen.queryByTestId("pwa-sheet-close")).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.pointerDown(screen.getByTestId("dialog-shell-overlay"));
    fireEvent.click(screen.getByTestId("dialog-shell-overlay"));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("keeps the centered Radix surface at 640px and wider", () => {
    stubViewportWidth(1024);
    render(
      wrap(
        <DialogShell open onOpenChange={vi.fn()} title="Garden profile">
          <p>Fields</p>
        </DialogShell>
      )
    );
    const dialog = screen.getByRole("dialog", { name: "Garden profile" });
    expect(dialog).toHaveAttribute("data-component", "DialogShell");
    expect(screen.queryByTestId("dialog-shell-drag-handle")).not.toBeInTheDocument();
  });
  it("sizes its narrow-viewport sheet from sheetSize", () => {
    stubViewportWidth(390);
    render(
      wrap(
        <DialogShell open onOpenChange={vi.fn()} title="Withdraw offer" sheetSize="half">
          <p>Reason field</p>
        </DialogShell>
      )
    );
    expect(screen.getByTestId("dialog-shell")).toHaveAttribute("data-sheet-size", "half");
  });

  it("counts the centered surface as an open sheet so the AppBar steps aside", () => {
    stubViewportWidth(1024);
    useUIStore.setState({ openSheetCount: 0 });
    const view = render(
      wrap(
        <DialogShell open onOpenChange={vi.fn()} title="Garden profile">
          <p>Profile</p>
        </DialogShell>
      )
    );
    expect(useUIStore.getState().openSheetCount).toBe(1);

    view.unmount();
    expect(useUIStore.getState().openSheetCount).toBe(0);
  });

  it("passes its actions to the narrow-viewport sheet", () => {
    stubViewportWidth(390);
    render(
      wrap(
        <DialogShell
          open
          onOpenChange={vi.fn()}
          title="Take This Up…"
          actions={{ primary: { label: "Take This Up" }, secondary: { label: "Cancel" } }}
        >
          <p>Who takes this up</p>
        </DialogShell>
      )
    );
    const sheet = screen.getByTestId("dialog-shell");
    expect(sheet.querySelector('[data-component="SheetActions"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "Take This Up" })).toBeInTheDocument();
  });

  it("pins the same actions under the centered surface's scrolling body", () => {
    stubViewportWidth(1024);
    const onCancel = vi.fn();
    render(
      wrap(
        <DialogShell
          open
          onOpenChange={vi.fn()}
          title="Commitment kept?"
          actions={{
            primary: { label: "Confirm It Was Kept" },
            secondary: { label: "Not Yet", onClick: onCancel },
          }}
        >
          <p>Evidence</p>
        </DialogShell>
      )
    );
    const surface = screen.getByRole("dialog", { name: "Commitment kept?" });
    const body = surface.querySelector('[data-component="DialogShell"][data-slot="body"]');
    expect(body).toHaveAttribute("data-scroll-edge", "both");
    expect(body?.nextElementSibling).toHaveAttribute("data-component", "SheetActions");
    fireEvent.click(screen.getByRole("button", { name: "Not Yet" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
