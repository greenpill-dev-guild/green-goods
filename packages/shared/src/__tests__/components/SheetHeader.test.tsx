/** @vitest-environment happy-dom */

import { fireEvent, render, screen } from "@testing-library/react";
import * as Dialog from "@radix-ui/react-dialog";
import { describe, expect, it, vi } from "vitest";
import { SheetGrip, SheetHeader } from "../../components/Dialog/SheetHeader";

describe("SheetHeader (DL-028)", () => {
  it("renders the title, description, and a borderless Close button, and no icon slot", () => {
    const onClose = vi.fn();
    render(
      <div role="dialog" aria-labelledby="title" aria-describedby="description">
        <SheetHeader
          title="Filter Gardens"
          titleId="title"
          description="Search, narrow, and sort the garden list."
          descriptionId="description"
          closeLabel="Close"
          onClose={onClose}
        />
      </div>
    );
    const dialog = screen.getByRole("dialog", { name: "Filter Gardens" });
    expect(dialog).toHaveAccessibleDescription("Search, narrow, and sort the garden list.");
    const header = dialog.querySelector('[data-component="SheetHeader"][data-slot="root"]');
    expect(header).not.toHaveAttribute("data-standalone");
    expect(header?.querySelector('[data-slot="icon"]')).toBeNull();
    const close = screen.getByRole("button", { name: "Close" });
    expect(close).toHaveAttribute("data-emphasis", "tertiary");
    expect(close).toHaveAttribute("data-testid", "pwa-sheet-close");
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders a rail directly under the header row and can drop the close button", () => {
    render(
      <SheetHeader title="Your Work" closeLabel="Close" onClose={vi.fn()} hideCloseButton>
        <div role="tablist" aria-label="Work sections" />
      </SheetHeader>
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    const rail = screen.getByRole("tablist").parentElement;
    expect(rail).toHaveAttribute("data-slot", "rail");
    expect(rail?.previousElementSibling).toHaveAttribute("data-slot", "root");
  });

  it("lets Radix name a centered dialog through its own title and description", () => {
    render(
      <Dialog.Root open>
        <Dialog.Portal>
          <Dialog.Content>
            <SheetHeader
              title="Commitment kept?"
              description="Say what you saw."
              titleAs={Dialog.Title}
              descriptionAs={Dialog.Description}
              closeLabel="Close"
              onClose={vi.fn()}
              closeTestId="dialog-shell-close"
              standalone
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
    const dialog = screen.getByRole("dialog", { name: "Commitment kept?" });
    expect(dialog).toHaveAccessibleDescription("Say what you saw.");
    expect(dialog.querySelector('[data-slot="title"]')).toHaveAttribute("id");
    expect(dialog.querySelector('[data-slot="root"]')).toHaveAttribute("data-standalone");
    expect(screen.getByTestId("dialog-shell-close")).toHaveAccessibleName("Close");
  });

  it("names what the act writes to between the title and the description, outside the description", () => {
    render(
      <div role="dialog" aria-labelledby="title" aria-describedby="description">
        <SheetHeader
          title="Close This Pool"
          titleId="title"
          target={<p>Writing to Rocinha’s pool</p>}
          description="Closing ends participation for every member."
          descriptionId="description"
          closeLabel="Close"
          onClose={vi.fn()}
        />
      </div>
    );
    const dialog = screen.getByRole("dialog", { name: "Close This Pool" });
    expect(dialog).toHaveAccessibleDescription("Closing ends participation for every member.");
    const order = Array.from(dialog.querySelectorAll("[data-slot]"), (node) =>
      node.getAttribute("data-slot")
    );
    expect(order.indexOf("target")).toBeGreaterThan(order.indexOf("title"));
    expect(order.indexOf("target")).toBeLessThan(order.indexOf("description"));
    expect(screen.getByText("Writing to Rocinha’s pool").parentElement).toHaveAttribute(
      "data-slot",
      "target"
    );
  });

  it("makes the grip a grab area only when a sheet binds the gesture to it", () => {
    const onPointerDown = vi.fn();
    render(
      <>
        <SheetGrip testId="marks-only" />
        <SheetGrip testId="drags" dragHandlers={{ onPointerDown }} />
      </>
    );
    const marksOnly = screen.getByTestId("marks-only");
    expect(marksOnly).not.toHaveAttribute("data-drag-region");
    expect(marksOnly.style.touchAction).toBe("");
    const drags = screen.getByTestId("drags");
    expect(drags).toHaveAttribute("data-drag-region");
    expect(drags.style.touchAction).toBe("none");
    fireEvent.pointerDown(drags);
    expect(onPointerDown).toHaveBeenCalledOnce();
  });
});
