import { cleanup, render, screen } from "@testing-library/react";
import { createElement, type ComponentProps } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Garden } from "@green-goods/shared/types/domain";

vi.mock("@/components/Cards/Garden/GardenCard", () => ({
  GardenCard: ({ garden }: { garden: Garden }) =>
    createElement("button", { type: "button" }, garden.name),
}));

vi.mock("@/components/Cards/Garden/GardenCardSkeleton", () => ({
  GardenCardSkeleton: () => createElement("div", { "data-testid": "garden-card-skeleton" }),
}));

vi.mock("@remixicon/react", () => ({
  RiRefreshLine: () => createElement("span", { "data-testid": "refresh-icon" }),
}));

import { GardenList } from "../../views/Home/GardenList";

const garden = {
  id: "0x1111111111111111111111111111111111111111",
  name: "Cached Garden",
} as Garden;

function renderGardenList(overrides: Partial<ComponentProps<typeof GardenList>> = {}) {
  const props: ComponentProps<typeof GardenList> = {
    gardens: [garden],
    onCardClick: vi.fn(),
    showSkeleton: false,
    timedOut: false,
    isError: false,
    isOnline: true,
    onRetry: vi.fn(),
    scope: "all",
    isFilterActive: false,
    hasUserAddress: true,
    ...overrides,
  };

  return render(
    createElement(
      IntlProvider,
      {
        locale: "en",
        messages: { "app.home.messages.noGardensFound": "No gardens found" },
      },
      createElement(GardenList, props)
    )
  );
}

describe("GardenList", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps warm cached gardens visible when an offline refresh fails", () => {
    renderGardenList({ isError: true, isOnline: false });

    expect(screen.getByRole("button", { name: "Cached Garden" })).toBeInTheDocument();
    expect(screen.queryByText("No gardens found")).not.toBeInTheDocument();
  });

  it("shows an offline unavailable-cache state instead of an empty result", () => {
    renderGardenList({ gardens: [], isError: true, isOnline: false });

    expect(screen.getByText("Unable to load gardens while offline.")).toBeInTheDocument();
    expect(screen.queryByText("No gardens found")).not.toBeInTheDocument();
  });

  it("shows a retry state for an online request failure without a cache", () => {
    renderGardenList({ gardens: [], isError: true });

    expect(screen.getByText("Loading is taking longer than expected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("keeps the no-gardens result for a successful empty response", () => {
    renderGardenList({ gardens: [] });

    expect(screen.getByText("No gardens found")).toBeInTheDocument();
  });
});
