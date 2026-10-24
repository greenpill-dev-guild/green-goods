/**
 * ItemRow Tests
 * @vitest-environment happy-dom
 *
 * The row opens its item, keeps its one action apart, is content when it has nothing to open,
 * and holds at most two details in the type's order. Layout (one 88px height, a detail line
 * that never wraps) is measured in a real browser by the ItemRow and WorkCard stories.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { ItemRow, type ItemRowProps } from "../../../components/Cards/ItemRow/ItemRow";

const row: ItemRowProps = {
  lead: { kind: "photo", src: null },
  title: "Planted native saplings",
  status: { label: "Pending", tone: "warning" },
  details: ["maria.eth", "2 hr. ago"],
};

const renderRow = (props: Partial<ItemRowProps> = {}) =>
  render(
    <IntlProvider locale="en">
      <ItemRow {...row} {...props} />
    </IntlProvider>
  );

describe("ItemRow", () => {
  it("opens its item from the whole row, named by its title, pill and details", () => {
    const onOpen = vi.fn();
    renderRow({ onOpen });

    const open = screen.getByRole("button");
    expect(open).toHaveAccessibleName(/Planted native saplings.*Pending.*maria\.eth.*2 hr\. ago/);
    fireEvent.click(open);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("keeps the row's one action apart from what opens the row", () => {
    const onOpen = vi.fn();
    const onDiscard = vi.fn();
    renderRow({
      onOpen,
      action: (
        <button type="button" onClick={onDiscard}>
          Discard
        </button>
      ),
    });

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onDiscard).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();

    const open = screen.getByRole("button", { name: /Planted native saplings/ });
    expect(open).not.toContainElement(screen.getByRole("button", { name: "Discard" }));
    fireEvent.click(open);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("tells a screen reader which record the list has open, on what opens it", () => {
    const { rerender } = renderRow({ onOpen: vi.fn(), selected: true });
    expect(screen.getByRole("button")).toHaveAttribute("aria-current", "true");

    rerender(
      <IntlProvider locale="en">
        <ItemRow
          {...row}
          onOpen={vi.fn()}
          selected
          action={<button type="button">Discard</button>}
        />
      </IntlProvider>
    );
    expect(screen.getByRole("button", { name: /Planted native saplings/ })).toHaveAttribute(
      "aria-current",
      "true"
    );
    expect(screen.getByRole("button", { name: "Discard" })).not.toHaveAttribute("aria-current");

    rerender(
      <IntlProvider locale="en">
        <ItemRow {...row} onOpen={vi.fn()} />
      </IntlProvider>
    );
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-current");
  });

  it("tells a screen reader which row the reader chose, as pressed rather than open", () => {
    const { rerender } = renderRow({ onOpen: vi.fn(), pressed: true });
    expect(screen.getByRole("button", { pressed: true })).not.toHaveAttribute("aria-current");

    rerender(
      <IntlProvider locale="en">
        <ItemRow {...row} onOpen={vi.fn()} pressed={false} />
      </IntlProvider>
    );
    expect(screen.getByRole("button", { pressed: false })).toBeInTheDocument();
  });

  it("is content when it has nothing to open: only its action takes focus", () => {
    const { rerender } = renderRow();
    expect(screen.queryByRole("button")).toBeNull();

    rerender(
      <IntlProvider locale="en">
        <ItemRow {...row} action={<button type="button">Claim</button>} />
      </IntlProvider>
    );
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button")).toHaveAccessibleName("Claim");
  });

  it("keeps a person's avatar out of the row's name, a photo that fails to load included", () => {
    const { container } = renderRow({
      lead: { kind: "avatar", src: "https://images.example/missing.webp" },
      title: "maria.eth",
      status: { label: "Gardener", tone: "neutral" },
      details: ["2 roles"],
      onOpen: vi.fn(),
    });

    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(screen.getByRole("button")).toHaveAccessibleName(/^maria\.eth\s*Gardener\s*2 roles$/);
  });

  it("holds at most two details on one line, in the type's order, an age as a moment", () => {
    renderRow({
      details: [
        "maria.eth",
        {
          text: "2 hr. ago",
          tone: "soft",
          dateTime: "2026-10-23T10:00:00.000Z",
          title: "Oct 23, 2026, 10:00 AM",
        },
      ],
    });

    const age = screen.getByText("2 hr. ago");
    expect(age.tagName).toBe("TIME");
    expect(age).toHaveAttribute("datetime", "2026-10-23T10:00:00.000Z");
    expect(age).toHaveAttribute("title", "Oct 23, 2026, 10:00 AM");
    // The line carries every detail on hover, in order, for the ones a narrow row drops.
    expect(screen.getByTitle("maria.eth · 2 hr. ago")).toContainElement(age);

    // @ts-expect-error A detail line holds the status and at most two details.
    const third: ItemRowProps["details"] = ["maria.eth", "2 hr. ago", "3 photos"];
    expect(third).toHaveLength(3);
  });
});
