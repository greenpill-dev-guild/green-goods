/**
 * Explore (DL-125, DL-126): the gardens the app lists under Home, the member's own first, one tag
 * on each card's photo, Filters in its top bar, and a card that visits a garden without
 * switching the active one.
 */

import messages from "@green-goods/shared/i18n/en.json";
import type { Garden } from "@green-goods/shared/types/domain";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ACCOUNT = "0x1234567890abcdef1234567890abcdef12345678";
// The family test garden that the app lists only for its members (`config/garden-visibility`).
const AIYELOJA_ID = "0xF7b892886998DAe960D64a9db488336684F137A0";

const garden = (id: string, name: string, overrides: Partial<Garden> = {}) =>
  ({
    id,
    name,
    location: `${name} place`,
    bannerImage: "",
    openJoining: false,
    createdAt: 1,
    gardeners: [],
    stewards: [],
    owners: [],
    evaluators: [],
    ...overrides,
  }) as unknown as Garden;

const OPEN = garden("0x6000000000000000000000000000000000000001", "Open Meadow", {
  openJoining: true,
  createdAt: 4,
});
const REQUESTED = garden("0x6000000000000000000000000000000000000002", "Vida Verde", {
  createdAt: 3,
});
const MINE = garden("0x6000000000000000000000000000000000000003", "TAS HUB", {
  stewards: [ACCOUNT],
  createdAt: 2,
});
const CLOSED = garden("0x6000000000000000000000000000000000000004", "Closed Grove", {
  createdAt: 5,
});
const AIYELOJA = garden(AIYELOJA_ID, "Aiyeloja Family Garden", { createdAt: 6 });

const state = vi.hoisted(() => ({
  listed: [] as unknown[],
  mine: [] as unknown[],
  awaiting: new Set<string>(),
}));
const selectGarden = vi.fn();

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({
    data: state.listed,
    isPending: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@green-goods/shared/hooks/garden/useActiveGarden", () => ({
  useActiveGarden: () => ({
    status: "ready",
    gardenId: MINE.id,
    garden: MINE,
    myGardens: {
      gardens: state.mine,
      isLoaded: true,
      isError: false,
      isStale: false,
      refetch: vi.fn(),
    },
    selectGarden,
  }),
}));
vi.mock("@green-goods/shared/hooks/garden/useGardenJoinRequests", () => ({
  useAwaitingJoinRequests: () => state.awaiting,
}));
vi.mock("@green-goods/shared/hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => ACCOUNT,
}));
vi.mock("@green-goods/shared/hooks/app/useOnlineStatus", () => ({
  useOnlineStatus: () => true,
}));

import { Explore } from "../../views/Home/Explore";

let location = "";
function LocationProbe() {
  location = useLocation().pathname;
  return null;
}

function renderExplore() {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/home/explore"] },
      createElement(
        IntlProvider,
        { locale: "en", messages },
        createElement(LocationProbe),
        createElement(
          Routes,
          null,
          createElement(Route, { path: "/home", element: createElement("p", null, "Home") }),
          createElement(Route, { path: "/home/explore", element: createElement(Explore) }),
          createElement(Route, { path: "/home/:id", element: createElement("p", null, "Garden") })
        )
      )
    )
  );
}

const cardNames = () =>
  screen.getAllByTestId("garden-card").map((card) => card.querySelector("h3")?.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  state.listed = [OPEN, REQUESTED, MINE, CLOSED, AIYELOJA];
  state.mine = [{ garden: MINE, membership: { roles: ["steward"], pendingJoin: false } }];
  state.awaiting = new Set([REQUESTED.id.toLowerCase()]);
});

describe("Explore", () => {
  it("lists the gardens the app lists, the member's own first, each with one tag on its photo", () => {
    renderExplore();

    // Newest first after the member's own; the family test garden is not this member's.
    expect(cardNames()).toEqual(["TAS HUB", "Closed Grove", "Open Meadow", "Vida Verde"]);
    const tags = screen
      .getAllByTestId("garden-card")
      .map((card) => card.querySelector("[data-slot='media-label']")?.textContent ?? null);
    expect(tags).toEqual(["Member", null, "Open", "Awaiting review"]);
  });

  it("lists a family test garden to its members only", () => {
    const member = { ...AIYELOJA, gardeners: [ACCOUNT] } as unknown as Garden;
    state.listed = [OPEN, member];
    state.mine = [{ garden: member, membership: { roles: ["gardener"], pendingJoin: false } }];

    renderExplore();

    expect(cardNames()).toEqual(["Aiyeloja Family Garden", "Open Meadow"]);
  });

  it("visits a garden from its card and leaves the active garden alone", () => {
    renderExplore();

    fireEvent.click(screen.getByRole("button", { name: /Open Meadow/ }));

    expect(location).toBe(`/home/${OPEN.id}`);
    expect(selectGarden).not.toHaveBeenCalled();
  });

  it("carries Filters in its top bar, opening the Filter Gardens sheet", async () => {
    renderExplore();

    expect(screen.getByRole("heading", { level: 1, name: "Explore Gardens" })).toBeInTheDocument();
    // Filters waits for its sheet's code before it can be pressed (DL-132); the first import
    // of that code is slow on a loaded host, so the test's own limit sits above the wait.
    const filters = screen.getByRole("button", { name: "Filters" });
    await waitFor(() => expect(filters).toBeEnabled(), { timeout: 15_000 });
    fireEvent.click(filters);

    expect(await screen.findByRole("dialog", { name: "Filter Gardens" })).toBeInTheDocument();
  }, 20_000);

  it("goes back to Home", () => {
    renderExplore();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(location).toBe("/home");
  });
});
