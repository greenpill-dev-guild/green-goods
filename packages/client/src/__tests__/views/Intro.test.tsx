/**
 * WorkIntro Component Tests
 *
 * Tests the intro step of the work submission flow: action carousel,
 * garden selection, domain filtering, and click handler delegation.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock shared barrel — use importActual to keep Domain enum and util functions real
vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");
  return {
    ...actual,
    hapticSelection: vi.fn(),
  };
});

// Mock child components used by WorkIntro
vi.mock("@/components/Cards", () => ({
  ActionCard: ({ action, selected }: { action: { title: string }; selected: boolean }) =>
    createElement(
      "div",
      { "data-testid": `action-card-${action.title}`, "data-selected": String(selected) },
      action.title
    ),
  ActionCardSkeleton: () => createElement("div", { "data-testid": "action-skeleton" }),
  FormInfo: ({ title }: { title: string }) =>
    createElement("div", { "data-testid": "form-info" }, title),
  GardenCard: ({ garden, selected }: { garden: { name: string }; selected: boolean }) =>
    createElement(
      "div",
      { "data-testid": `garden-card-${garden.name}`, "data-selected": String(selected) },
      garden.name
    ),
  GardenCardSkeleton: () => createElement("div", { "data-testid": "garden-skeleton" }),
}));

vi.mock("@/components/Display", () => ({
  Carousel: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "carousel" }, children),
  CarouselContent: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "carousel-content" }, children),
  CarouselItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) =>
    createElement("div", { "data-testid": "carousel-item", onClick }, children),
}));

vi.mock("@/components/Navigation", () => ({
  StandardTabs: ({
    tabs,
    activeTab,
    onTabChange,
  }: {
    tabs: Array<{ id: string; label: string }>;
    activeTab: string;
    onTabChange: (id: string) => void;
  }) =>
    createElement(
      "div",
      { "data-testid": "domain-tabs" },
      tabs.map((tab) =>
        createElement(
          "button",
          {
            key: tab.id,
            "data-testid": `domain-tab-${tab.id}`,
            "data-active": String(tab.id === activeTab),
            onClick: () => onTabChange(tab.id),
          },
          tab.label
        )
      )
    ),
}));

// Import after mocks
import { Domain } from "@green-goods/shared";
import type { Action, Address, Garden } from "@green-goods/shared";
import { WorkIntro } from "../../views/Garden/Intro";

const messages: Record<string, string> = {
  "app.garden.selectYourAction": "Select your action",
  "app.garden.whatTypeOfWork": "What type of work are you submitting?",
  "app.garden.selectYourGarden": "Select your garden",
  "app.garden.whichGarden": "Which garden are you submitting for?",
  "app.garden.noActiveActions": "No active actions at this time.",
  "app.garden.noActionsConfigured": "No actions have been configured for this garden yet.",
  "app.garden.noGardensAvailable": "No gardens available. You may need to join a garden first.",
  "app.domain.tab.solar": "Solar",
  "app.domain.tab.agro": "Agro",
};

const now = Date.now();

const makeAction = (overrides: Partial<Action> & { id: string }): Action => ({
  title: "Test Action",
  slug: "",
  description: "",
  instructions: "",
  domain: Domain.SOLAR,
  startTime: now - 86400000,
  endTime: now + 86400000,
  capitals: [],
  media: ["/test.jpg"],
  createdAt: now,
  inputs: [],
  ...overrides,
});

const makeGarden = (overrides: Partial<Garden> & { id: string }): Garden => ({
  chainId: 11155111,
  tokenAddress: "0x0000000000000000000000000000000000000001" as Address,
  tokenID: BigInt(1),
  name: "Test Garden",
  description: "",
  location: "Test Location",
  bannerImage: "",
  gardeners: [],
  operators: [],
  evaluators: [],
  owners: [],
  funders: [],
  communities: [],
  assessments: [],
  works: [],
  createdAt: now,
  ...overrides,
});

function renderIntro(props: Partial<React.ComponentProps<typeof WorkIntro>> = {}) {
  const defaultProps: React.ComponentProps<typeof WorkIntro> = {
    actions: [],
    gardens: [],
    selectedActionUID: null,
    selectedGardenAddress: null,
    selectedDomain: null,
    setActionUID: vi.fn(),
    setGardenAddress: vi.fn(),
    setSelectedDomain: vi.fn(),
    ...props,
  };

  return render(
    createElement(IntlProvider, { locale: "en", messages }, createElement(WorkIntro, defaultProps))
  );
}

describe("WorkIntro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders action and garden form info sections", () => {
    renderIntro();

    expect(screen.getByText("Select your action")).toBeInTheDocument();
    expect(screen.getByText("Select your garden")).toBeInTheDocument();
  });

  it("renders action cards for active actions", () => {
    const actions = [
      makeAction({ id: "action-1", title: "Plant Trees" }),
      makeAction({ id: "action-2", title: "Water Garden" }),
    ];

    renderIntro({ actions });

    expect(screen.getByTestId("action-card-Plant Trees")).toBeInTheDocument();
    expect(screen.getByTestId("action-card-Water Garden")).toBeInTheDocument();
  });

  it("filters out expired actions", () => {
    const actions = [
      makeAction({ id: "action-1", title: "Active Action" }),
      makeAction({
        id: "action-2",
        title: "Expired Action",
        endTime: now - 1000,
      }),
    ];

    renderIntro({ actions });

    expect(screen.getByTestId("action-card-Active Action")).toBeInTheDocument();
    expect(screen.queryByTestId("action-card-Expired Action")).not.toBeInTheDocument();
  });

  it("fires setActionUID when an action card is clicked", () => {
    const setActionUID = vi.fn();
    const actions = [makeAction({ id: "action-1", title: "Plant Trees" })];

    renderIntro({ actions, setActionUID });

    // The carousel item wrapping the action card receives the click
    const actionCard = screen.getByTestId("action-card-Plant Trees");
    fireEvent.click(actionCard.closest("[data-testid='carousel-item']")!);

    expect(setActionUID).toHaveBeenCalledWith(1);
  });

  it("fires setGardenAddress when a garden card is clicked", () => {
    const setGardenAddress = vi.fn();
    const gardens = [makeGarden({ id: "0xABC" as Address, name: "My Garden" })];

    renderIntro({ gardens, setGardenAddress });

    const gardenCard = screen.getByTestId("garden-card-My Garden");
    fireEvent.click(gardenCard.closest("[data-testid='carousel-item']")!);

    expect(setGardenAddress).toHaveBeenCalledWith("0xABC");
  });

  it("shows domain tabs when multiple domains exist", () => {
    const actions = [
      makeAction({ id: "action-1", title: "Solar Work", domain: Domain.SOLAR }),
      makeAction({ id: "action-2", title: "Agro Work", domain: Domain.AGRO }),
    ];

    renderIntro({ actions });

    expect(screen.getByTestId("domain-tabs")).toBeInTheDocument();
    expect(screen.getByTestId(`domain-tab-${Domain.SOLAR}`)).toBeInTheDocument();
    expect(screen.getByTestId(`domain-tab-${Domain.AGRO}`)).toBeInTheDocument();
  });

  it("hides domain tabs when only one domain exists", () => {
    const actions = [
      makeAction({ id: "action-1", domain: Domain.SOLAR }),
      makeAction({ id: "action-2", domain: Domain.SOLAR }),
    ];

    renderIntro({ actions });

    expect(screen.queryByTestId("domain-tabs")).not.toBeInTheDocument();
  });
});
