/**
 * ActionPicker Tests
 * @vitest-environment happy-dom
 *
 * One action picker on both surfaces: a radio group of banner cards with one tab stop, where
 * the arrow keys move and only Space, Enter or a press chooses, and a card says its domain and
 * what it asks for. The row and grid layouts are measured in a real browser by the stories.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionPicker, type ActionPickerProps } from "../../../components/Cards/ActionPicker";
import { MediaCardPicker } from "../../../components/Cards/MediaCardPicker";
import enMessages from "../../../i18n/en.json";
import { type Action, Capital, Domain } from "../../../types/domain";

function makeAction(
  id: string,
  title: string,
  domain: Domain | null,
  mediaInfo: Action["mediaInfo"]
): Action {
  return {
    id,
    slug: id,
    title,
    description: "",
    domain,
    startTime: 0,
    endTime: 0,
    instructions: "",
    capitals: [Capital.LIVING],
    media: [],
    createdAt: 0,
    inputs: [],
    mediaInfo,
  };
}

const ACTIONS: Action[] = [
  makeAction("plant", "Plant native trees", Domain.AGRO, {
    title: "Evidence",
    required: true,
    minImageCount: 2,
  }),
  makeAction("panels", "Clean the panels", Domain.SOLAR, {
    title: "Evidence",
    required: false,
  }),
  makeAction("sort", "Sort the waste", Domain.WASTE, {
    title: "Evidence",
    required: true,
  }),
];

function renderPicker(props: Partial<ActionPickerProps> = {}) {
  const onChange = vi.fn();
  render(
    <IntlProvider locale="en" messages={enMessages}>
      <ActionPicker
        actions={ACTIONS}
        value={null}
        onChange={onChange}
        label="Action"
        layout="grid"
        {...props}
      />
    </IntlProvider>
  );
  return { onChange };
}

afterEach(cleanup);

describe("ActionPicker", () => {
  it("is one named radio group whose cards say the domain and what the action asks for", () => {
    renderPicker({ value: "panels" });

    expect(screen.getByRole("radiogroup", { name: "Action" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveAccessibleName(/Agroforestry.*Plant native trees.*2 photos required/);
    expect(radios[1]).toHaveAccessibleName(/Solar.*Clean the panels.*Photos optional/);
    // A required action without a count asks for one photo, as Submit Work does.
    expect(radios[2]).toHaveAccessibleName(/Waste.*Sort the waste.*1 photo required/);
    expect(radios.map((radio) => radio.getAttribute("aria-checked"))).toEqual([
      "false",
      "true",
      "false",
    ]);
  });

  it("keeps one tab stop, on the chosen card, or the first when nothing is chosen", () => {
    renderPicker({ value: "sort" });
    expect(screen.getAllByRole("radio").map((radio) => radio.tabIndex)).toEqual([-1, -1, 0]);
  });

  it("moves with the arrow keys, Home and End, wrapping, without choosing", () => {
    const { onChange } = renderPicker();
    const group = screen.getByRole("radiogroup");
    const [first, second, third] = screen.getAllByRole("radio");

    first.focus();
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(second).toHaveFocus();
    expect(second.tabIndex).toBe(0);
    fireEvent.keyDown(group, { key: "ArrowDown" });
    expect(third).toHaveFocus();
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    expect(third).toHaveFocus();
    fireEvent.keyDown(group, { key: "Home" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(group, { key: "End" });
    expect(third).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("chooses the pressed card, and chooses nothing while turned off", () => {
    const { onChange } = renderPicker();
    fireEvent.click(screen.getByRole("radio", { name: /Clean the panels/ }));
    expect(onChange).toHaveBeenCalledWith("panels");

    cleanup();
    const { onChange: offChange } = renderPicker({ disabled: true });
    const radio = screen.getByRole("radio", { name: /Clean the panels/ });
    expect(radio).toBeDisabled();
    fireEvent.click(radio);
    expect(offChange).not.toHaveBeenCalled();
  });

  it("skips a card that cannot be chosen and returns the tab stop to the chosen card on leaving", () => {
    render(
      <>
        <MediaCardPicker
          label="Garden"
          layout="row"
          value="b"
          onChange={vi.fn()}
          options={[
            { value: "a", title: "A", media: null },
            { value: "b", title: "B", media: null },
            { value: "c", title: "C", media: null, disabled: true },
          ]}
        />
        <button type="button">After</button>
      </>
    );
    const group = screen.getByRole("radiogroup");
    const [a, b] = screen.getAllByRole("radio");

    b.focus();
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(a).toHaveFocus();
    expect(a.tabIndex).toBe(0);

    fireEvent.blur(a, { relatedTarget: screen.getByRole("button", { name: "After" }) });
    expect(screen.getAllByRole("radio").map((radio) => radio.tabIndex)).toEqual([-1, 0, -1]);
  });

  it("holds the options' place with empty cards while they load", () => {
    renderPicker({ loading: true });
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-skeleton="media-card"]')).toHaveLength(4);
  });
});
