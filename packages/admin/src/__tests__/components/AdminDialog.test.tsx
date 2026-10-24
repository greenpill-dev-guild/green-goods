import { RiSearchLine } from "@remixicon/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "../test-utils";
import { AdminButton } from "../../components/AdminButton";
import { AdminSideSheet } from "../../components/AdminSideSheet";
import {
  ADMIN_FLOW_DIALOG_CLASS,
  AdminConfirmDialog,
  AdminDialog,
} from "../../components/AdminDialog";

type Width = "phone" | "desktop";
type ChangeListener = (event: MediaQueryListEvent) => void;
const PHONE_QUERY = "(max-width: 639px)";

/**
 * Below 640px the cockpit's dialogs present as the shared bottom sheet (F5).
 * Returns the restore function, with `resize` to cross 640px mid-test.
 */
function emulateViewport(initial: Width) {
  const original = window.matchMedia;
  let width = initial;
  const phoneListeners = new Set<ChangeListener>();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return width === "phone" && query === PHONE_QUERY;
    },
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: (_type: string, listener: ChangeListener) => {
      if (query === PHONE_QUERY) phoneListeners.add(listener);
    },
    removeEventListener: (_type: string, listener: ChangeListener) => {
      phoneListeners.delete(listener);
    },
    dispatchEvent: vi.fn(),
  })) as typeof window.matchMedia;
  return Object.assign(
    () => {
      window.matchMedia = original;
    },
    {
      resize(next: Width) {
        width = next;
        const event = { matches: next === "phone", media: PHONE_QUERY } as MediaQueryListEvent;
        for (const listener of phoneListeners) listener(event);
      },
    }
  );
}

/** A controlled dialog opened from a plain button, which hands focus back through finalFocusRef. */
function OpenerHarness({ preventClose = false }: { preventClose?: boolean }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={opener} type="button" onClick={() => setOpen(true)}>
        Edit domains
      </button>
      <AdminDialog
        open={open}
        onOpenChange={setOpen}
        title="Edit Domains"
        tone="garden"
        preventClose={preventClose}
        finalFocusRef={opener}
      >
        <p>Domain form body</p>
      </AdminDialog>
    </>
  );
}

describe("AdminDialog", () => {
  it("renders the standard desktop/mobile contract attributes with pinned actions", () => {
    renderWithProviders(
      <AdminDialog
        open
        onOpenChange={vi.fn()}
        title="Edit Domains"
        description="Choose supported work domains"
        actions={
          <>
            <AdminButton variant="text">Cancel</AdminButton>
            <AdminButton>Save</AdminButton>
          </>
        }
      >
        <p>Domain form body</p>
      </AdminDialog>
    );

    const dialog = screen.getByRole("dialog", { name: "Edit Domains" });
    expect(dialog).toHaveAttribute("data-component", "AdminDialog");
    expect(dialog).toHaveAttribute("data-variant", "standard");
    expect(dialog).toHaveAttribute("data-mobile", "sheet");
    expect(dialog).toHaveAttribute("aria-describedby");
    expect(dialog.className).toContain("bottom-0");
    expect(dialog.className).toContain("inset-x-0");
    expect(dialog.className).toContain("w-[100dvw]");
    expect(dialog.className).toContain("max-w-none");
    expect(dialog.className).not.toContain("max-w-[calc(100vw-1rem)]");
    expect(dialog.className).toContain("sm:left-1/2");
    expect(dialog.className).toContain("sm:top-1/2");
    expect(dialog.className).toContain("sm:-translate-x-1/2");
    expect(dialog.className).toContain("sm:-translate-y-1/2");
    expect(
      document.getElementById(dialog.getAttribute("aria-describedby") ?? "")
    ).toHaveTextContent("Choose supported work domains");
    expect(screen.getByTestId("admin-dialog-body")).toHaveTextContent("Domain form body");
    expect(screen.getByTestId("admin-dialog-actions")).toContainElement(
      screen.getByRole("button", { name: "Save" })
    );
    // From 640px the centered dialog keeps its own surface, header and close.
    expect(dialog).not.toHaveAttribute("data-sheet-surface");
    expect(dialog.querySelector('[data-component="SheetGrip"]')).toBeNull();
    expect(dialog.querySelector('[data-slot="header"]')).not.toBeNull();
  });

  it("uses full-width mobile geometry for flow action dialogs", () => {
    renderWithProviders(
      <AdminDialog
        open
        onOpenChange={vi.fn()}
        title="Submit Work"
        variant="flow"
        size="lg"
        className={ADMIN_FLOW_DIALOG_CLASS}
      >
        <p>Flow body</p>
      </AdminDialog>
    );

    const dialog = screen.getByRole("dialog", { name: "Submit Work" });
    expect(dialog).toHaveAttribute("data-variant", "flow");
    expect(dialog).toHaveAttribute("data-size", "lg");
    expect(dialog.className).toContain("inset-x-0");
    expect(dialog.className).toContain("w-[100dvw]");
    expect(dialog.className).toContain("max-w-none");
    expect(dialog.className).toContain("sm:-translate-x-1/2");
    expect(dialog.className).toContain("sm:!max-w-3xl");
    expect(dialog.className).not.toContain("max-w-[calc(100vw-1rem)]");
  });

  it("uses the palette variant for command search surfaces", () => {
    renderWithProviders(
      <AdminDialog
        open
        onOpenChange={vi.fn()}
        title="Command palette"
        variant="palette"
        hideCloseButton
        icon={RiSearchLine}
      >
        <input aria-label="Search commands" />
      </AdminDialog>
    );

    const dialog = screen.getByRole("dialog", { name: "Command palette" });
    expect(dialog).toHaveAttribute("data-variant", "palette");
    expect(dialog).toHaveClass("admin-dialog--palette");
    expect(dialog.className).toContain("left-1/2");
    expect(dialog.className).toContain("-translate-x-1/2");
    expect(dialog).toHaveClass("inset-x-0", "w-[100dvw]", "max-w-none", "sm:max-w-2xl");
    expect(screen.getByLabelText("Search commands")).toBeInTheDocument();
  });

  it("prevents overlay and escape close while a blocking action is pending", () => {
    const onOpenChange = vi.fn();

    renderWithProviders(
      <AdminDialog open onOpenChange={onOpenChange} title="Blocking dialog" preventClose>
        <p>Pending</p>
      </AdminDialog>
    );

    const dialog = screen.getByRole("dialog", { name: "Blocking dialog" });
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("AdminDialog on phones (F5)", () => {
  let restoreViewport: () => void;
  beforeEach(() => {
    restoreViewport = emulateViewport("phone");
  });
  afterEach(() => restoreViewport());

  it("takes the shared sheet: its material, a grip that does not drag, and the shared header", () => {
    renderWithProviders(
      <AdminConfirmDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Close This Pool"
        target={<p>Writing to Rocinha’s pool</p>}
        description="Closing ends participation for every member."
        confirmLabel="Close Pool"
        variant="danger"
      />
    );

    const dialog = screen.getByRole("alertdialog", { name: "Close This Pool" });
    expect(dialog).toHaveAttribute("data-sheet-surface");
    expect(dialog).toHaveAccessibleDescription("Closing ends participation for every member.");
    const grip = dialog.querySelector('[data-component="SheetGrip"][data-slot="drag-handle"]');
    expect(grip).not.toBeNull();
    expect(grip).not.toHaveAttribute("data-drag-region");

    // The shared header replaces the centered one: no leading icon (the danger
    // lives in the role and the filled action), the target before the description.
    expect(dialog.querySelector('[data-slot="header"]')).toBeNull();
    const header = dialog.querySelector<HTMLElement>(
      '[data-component="SheetHeader"][data-slot="root"]'
    );
    expect(header).not.toBeNull();
    const close = within(header as HTMLElement).getByRole("button", { name: "Close" });
    expect(
      Array.from(header?.querySelectorAll("svg") ?? []).every((icon) => close.contains(icon))
    ).toBe(true);
    const target = screen.getByText("Writing to Rocinha’s pool");
    const description = screen.getByText("Closing ends participation for every member.");
    expect(
      target.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    // No rule under the header: the hairline shows only while the body scrolls.
    expect(screen.getByTestId("admin-dialog-body")).toHaveAttribute("data-scroll-edge", "top");
  });

  it("keeps an accessible description when the dialog has none to show", () => {
    renderWithProviders(
      <AdminDialog open onOpenChange={vi.fn()} title="Edit Domains" tone="garden">
        <p>Domain form body</p>
      </AdminDialog>
    );
    expect(screen.getByRole("dialog", { name: "Edit Domains" })).toHaveAccessibleDescription(
      "Edit Domains"
    );
  });
});

describe.each(["phone", "desktop"] as const)("AdminDialog behavior on %s", (width) => {
  let restoreViewport: () => void;
  beforeEach(() => {
    restoreViewport = emulateViewport(width);
  });
  afterEach(() => restoreViewport());

  it("opens on its close button and hands focus back to the opener when it closes", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OpenerHarness />);
    const opener = screen.getByRole("button", { name: "Edit domains" });

    await user.click(opener);
    const dialog = await screen.findByRole("dialog", { name: "Edit Domains" });
    const close = within(dialog).getByRole("button", { name: "Close" });
    await waitFor(() => expect(close).toHaveFocus());

    await user.click(close);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(opener).toHaveFocus();

    await user.click(opener);
    await screen.findByRole("dialog", { name: "Edit Domains" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(opener).toHaveFocus();
  });

  it("holds the close button and Escape while a blocking action runs", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OpenerHarness preventClose />);
    await user.click(screen.getByRole("button", { name: "Edit domains" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit Domains" });

    expect(within(dialog).getByRole("button", { name: "Close" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Edit Domains" })).toBeInTheDocument();
  });
});

describe("Crossing 640px while open", () => {
  // The phone and centered layouts render different Close buttons, so the one
  // that had focus unmounts when a rotated phone or a resized window crosses 640px.
  it.each([
    [
      "AdminDialog",
      () => (
        <AdminDialog open onOpenChange={vi.fn()} title="Edit Domains" tone="garden">
          <p>Domain form body</p>
        </AdminDialog>
      ),
    ],
    [
      "AdminSideSheet",
      () => (
        <AdminSideSheet open onOpenChange={vi.fn()} title="Notifications">
          <p>No new notifications</p>
        </AdminSideSheet>
      ),
    ],
  ] as const)("%s hands focus to the other layout's Close", async (_name, surface) => {
    const viewport = emulateViewport("phone");
    try {
      renderWithProviders(surface());
      const dialog = screen.getByRole("dialog");
      const close = () => within(dialog).getByRole("button", { name: "Close" });
      await waitFor(() => expect(close()).toHaveFocus());

      for (const width of ["desktop", "phone"] as const) {
        act(() => viewport.resize(width));
        await waitFor(() => expect(close()).toHaveFocus());
      }
    } finally {
      viewport();
    }
  });
});

describe("AdminConfirmDialog", () => {
  it("renders confirmation copy and calls confirm without closing through custom footer markup", async () => {
    const onConfirm = vi.fn();

    renderWithProviders(
      <AdminConfirmDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={onConfirm}
        title="Emergency pause"
        description="Pause this vault?"
        confirmLabel="Pause"
        cancelLabel="Cancel"
        variant="danger"
      />
    );

    expect(screen.getByRole("alertdialog", { name: "Emergency pause" })).toBeInTheDocument();
    expect(screen.getByText("Pause this vault?")).toBeInTheDocument();

    screen.getByRole("button", { name: "Pause" }).click();

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("names what the act writes to under the title, before the description", () => {
    renderWithProviders(
      <AdminConfirmDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Close This Pool"
        target={<p>Writing to Rocinha’s pool</p>}
        description="Closing ends participation for every member."
        confirmLabel="Close Pool"
      />
    );

    const title = screen.getByRole("heading", { name: "Close This Pool" });
    const target = screen.getByText("Writing to Rocinha’s pool");
    const description = screen.getByText("Closing ends participation for every member.");
    const follows = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(title, target)).toBe(true);
    expect(follows(target, description)).toBe(true);
  });

  it("keeps the header as it was when a dialog names no target", () => {
    renderWithProviders(
      <AdminConfirmDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Emergency pause"
        description="Pause this vault?"
      />
    );
    expect(document.querySelector('[data-slot="target"]')).toBeNull();
  });

  it("keeps confirm dialogs full width on mobile and capped on desktop", () => {
    renderWithProviders(
      <AdminConfirmDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Emergency pause"
        description="Pause this vault?"
      />
    );

    const dialog = screen.getByRole("dialog", { name: "Emergency pause" });
    expect(dialog).toHaveAttribute("data-variant", "confirm");
    expect(dialog.className).toContain("left-1/2");
    expect(dialog.className).toContain("-translate-x-1/2");
    expect(dialog).toHaveClass("inset-x-0", "w-[100dvw]", "max-w-none", "sm:max-w-md");
  });

  it("locks confirmation dialogs while loading", () => {
    renderWithProviders(
      <AdminConfirmDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Emergency pause"
        description="Pause this vault?"
        confirmLabel="Pause"
        cancelLabel="Cancel"
        variant="danger"
        isLoading
      />
    );

    expect(screen.queryByLabelText("Close")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    // The loading confirm is held but keeps focus: aria-disabled and aria-busy (DL-115).
    const pause = screen.getByRole("button", { name: "Pause" });
    expect(pause).toHaveAttribute("aria-disabled", "true");
    expect(pause).toHaveAttribute("aria-busy", "true");
  });
});

describe("AdminSideSheet mobile geometry", () => {
  it("opens global surfaces full width on mobile and keeps the desktop rail width", () => {
    renderWithProviders(
      <AdminSideSheet open onOpenChange={vi.fn()} title="Notifications">
        <p>No new notifications</p>
      </AdminSideSheet>
    );

    expect(screen.getByRole("dialog", { name: "Notifications" })).toHaveClass(
      "w-full",
      "max-w-none",
      "bottom-0",
      "sm:w-[var(--admin-side-sheet-width)]"
    );
    expect(screen.getByTestId("admin-side-sheet-content")).not.toHaveAttribute(
      "data-body-scroll-edge"
    );
  });

  it("presents on phones as the dialog does: the shared sheet, grip and header, closing as before", () => {
    const restoreViewport = emulateViewport("phone");
    try {
      const onOpenChange = vi.fn();
      renderWithProviders(
        <AdminSideSheet open onOpenChange={onOpenChange} title="Notifications">
          <p>No new notifications</p>
        </AdminSideSheet>
      );
      const sheet = screen.getByRole("dialog", { name: "Notifications" });
      expect(sheet).toHaveAttribute("data-sheet-surface");
      expect(sheet).toHaveAccessibleDescription("Notifications");
      expect(sheet.querySelector('[data-component="SheetGrip"]')).not.toHaveAttribute(
        "data-drag-region"
      );
      // The panel's SheetBody scrolls, so it takes the header's scroll edge.
      expect(within(sheet).getByTestId("admin-side-sheet-content")).toHaveAttribute(
        "data-body-scroll-edge",
        "top"
      );
      fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    } finally {
      restoreViewport();
    }
  });
});
