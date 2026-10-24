/**
 * GardenCard Tests
 * @vitest-environment happy-dom
 *
 * A garden is a media card with its banner: its name, how many people are members, then where.
 * It opens the garden when it has somewhere to go, is content when it has not, and Submit Work
 * chooses a garden from the same cards as a listbox.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GardenCard,
  type GardenCardData,
  GardenPicker,
} from "../../../components/Cards/GardenCard/GardenCard";
import enMessages from "../../../i18n/en.json";

const GARDEN: GardenCardData = {
  id: "0xgarden",
  name: "Community Garden",
  location: "San Francisco, CA",
  bannerImage: "https://example.com/garden.jpg",
  gardeners: ["0xGardener1", "0xGardener2", "0xSteward1"],
  stewards: ["0xSteward1"],
};

const renderWithIntl = (ui: React.ReactElement) =>
  render(
    <IntlProvider locale="en" messages={enMessages}>
      {ui}
    </IntlProvider>
  );

afterEach(cleanup);

describe("GardenCard", () => {
  it("names the garden, counts each member once, then says where", () => {
    renderWithIntl(<GardenCard garden={GARDEN} />);

    expect(screen.getByRole("heading", { name: "Community Garden" })).toBeInTheDocument();
    // The steward also gardens: three people, not four seats (DL-049).
    expect(screen.getByText("3 members")).toBeInTheDocument();
    expect(screen.getByText(/San Francisco, CA/)).toBeInTheDocument();
    // With nothing to open, the card is content rather than a button that does nothing.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens its garden from the whole card and shows which garden is open", () => {
    const onClick = vi.fn();
    renderWithIntl(<GardenCard garden={GARDEN} onClick={onClick} selected />);

    const card = screen.getByRole("button", { name: /Community Garden/ });
    expect(card).toHaveAttribute("data-selected", "true");
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("says only the members when the garden names no place", () => {
    renderWithIntl(
      <GardenCard garden={{ ...GARDEN, location: " ", gardeners: ["0xA"], stewards: [] }} />
    );
    expect(screen.getByText("1 member").closest("[title]")).toHaveAttribute("title", "1 member");
  });

  it("chooses a garden from the same cards in a listbox", () => {
    const onChange = vi.fn();
    renderWithIntl(
      <GardenPicker
        gardens={[GARDEN, { ...GARDEN, id: "0xother", name: "Riverside Garden" }]}
        value="0xother"
        onChange={onChange}
        label="Garden"
        layout="row"
      />
    );

    const group = screen.getByRole("listbox", { name: "Garden" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Riverside Garden/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    fireEvent.click(screen.getByRole("option", { name: /Community Garden/ }));
    expect(onChange).toHaveBeenCalledWith("0xgarden");
  });
});
