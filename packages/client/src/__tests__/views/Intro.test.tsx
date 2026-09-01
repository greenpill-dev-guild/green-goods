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

// Mock only the runtime helpers WorkIntro needs.
vi.mock("@green-goods/shared/types/domain", () => {
  const Domain = {
    SOLAR: 0,
    AGRO: 1,
    EDU: 2,
    WASTE: 3,
  } as const;
  return {
    Domain,
  };
});

vi.mock("@green-goods/shared/utils/domain", () => {
  const Domain = {
    SOLAR: 0,
    AGRO: 1,
    EDU: 2,
    WASTE: 3,
  } as const;
  return {
    expandDomainMask: (mask: number) => {
      const domains: Domain[] = [];
      if (mask & 1) domains.push(Domain.SOLAR);
      if (mask & 2) domains.push(Domain.AGRO);
      if (mask & 4) domains.push(Domain.EDU);
      if (mask & 8) domains.push(Domain.WASTE);
      return domains;
    },
    hasDomain: (mask: number, domain: Domain) => (mask & (1 << domain)) !== 0,
  };
});

vi.mock("@green-goods/shared/utils/app/haptics", () => ({
  hapticSelection: vi.fn(),
}));

vi.mock("@green-goods/shared/utils/action/translations", () => ({
  localizeAction: (action: Action) => action,
}));

// Mock child components used by WorkIntro
vi.mock("@/components/Actions", () => ({
  Button: ({
    label,
    onClick,
    disabled,
  }: {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
  }) => createElement("button", { onClick, disabled, type: "button" }, label),
}));

vi.mock("@/components/Cards/Action/ActionCard", () => ({
  ActionCard: ({ action, selected }: { action: { title: string }; selected: boolean }) =>
    createElement(
      "div",
      { "data-testid": `action-card-${action.title}`, "data-selected": String(selected) },
      action.title
    ),
}));

vi.mock("@/components/Cards/Action/ActionCardSkeleton", () => ({
  ActionCardSkeleton: () => createElement("div", { "data-testid": "action-skeleton" }),
}));

vi.mock("@/components/Cards/Form/FormInfo", () => ({
  FormInfo: ({ title }: { title: string }) =>
    createElement("div", { "data-testid": "form-info" }, title),
}));

vi.mock("@/components/Cards/Garden/GardenCard", () => ({
  GardenCard: ({ garden, selected }: { garden: { name: string }; selected: boolean }) =>
    createElement(
      "div",
      { "data-testid": `garden-card-${garden.name}`, "data-selected": String(selected) },
      garden.name
    ),
}));

vi.mock("@/components/Cards/Garden/GardenCardSkeleton", () => ({
  GardenCardSkeleton: () => createElement("div", { "data-testid": "garden-skeleton" }),
}));

vi.mock("@/components/Display", () => ({
  Carousel: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "carousel" }, children),
  CarouselContent: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "carousel-content" }, children),
  CarouselItem: ({
    children,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
  }) => createElement("div", { "data-testid": "carousel-item", className, onClick }, children),
}));

vi.mock("@/components/Navigation", () => ({
  StandardTabs: ({
    tabs,
    activeTab,
    onTabChange,
    triggerClassName,
  }: {
    tabs: Array<{ id: string; label: string }>;
    activeTab: string;
    onTabChange: (id: string) => void;
    triggerClassName?: string;
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
            className: triggerClassName,
            onClick: () => onTabChange(tab.id),
          },
          tab.label
        )
      )
    ),
}));

// Import after mocks
import { type Action, type Address, Domain, type Garden } from "@green-goods/shared/types/domain";
import { WorkIntro } from "../../views/Garden/Intro";

const messages: Record<string, string> = {
  "app.garden.selectYourAction": "Select Your Action",
  "app.garden.whatTypeOfWork": "What type of work are you submitting?",
  "app.garden.selectYourGarden": "Select Your Garden",
  "app.garden.whichGarden": "Which garden are you submitting for?",
  "app.garden.noActiveActions": "No active actions at this time.",
  "app.garden.noActionsConfigured": "No actions have been configured for this garden yet.",
  "app.garden.noGardensAvailable": "No gardens available. You may need to join a garden first.",
  "app.garden.communityOnramp.action": "Join Community Garden",
  "app.garden.communityOnramp.description":
    "The Community Garden is open to everyone and gives you a place to submit your first work.",
  "app.garden.communityOnramp.title": "Join the Community Garden",
  "app.garden.commitment.label": "Commitment (optional)",
  "app.garden.commitment.none": "No commitment",
  "app.garden.commitment.option": "{title} · requirement {requirement}",
  "app.garden.commitment.description":
    "Choose the commitment and exact requirement this work fulfils.",
  "app.garden.commitment.loading": "Checking eligible commitments…",
  "app.garden.commitment.error":
    "Eligible commitments could not be read. Try again or continue without one.",
  "app.garden.commitment.invalid":
    "That commitment link is no longer eligible. Choose another commitment or continue without one.",
  "app.garden.commitment.retry": "Try Again",
  "app.garden.commitment.empty": "No eligible commitments match this garden and action.",
  "app.domain.tab.solar": "Solar",
  "app.domain.tab.agro": "Agroforestry",
  "app.domain.tab.waste": "Waste",
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
  stewards: [],
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

    expect(screen.getByText("Select Your Action")).toBeInTheDocument();
    expect(screen.getByText("Select Your Garden")).toBeInTheDocument();
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

  it("skips an action with a missing id instead of crashing", () => {
    const actions = [
      makeAction({ id: "action-1", title: "Valid Action" }),
      makeAction({ id: undefined as unknown as string, title: "Broken Action" }),
    ];

    renderIntro({ actions });

    expect(screen.getByTestId("action-card-Valid Action")).toBeInTheDocument();
    expect(screen.queryByTestId("action-card-Broken Action")).not.toBeInTheDocument();
  });

  it("reserves selection-card space when a selected domain has no active actions", () => {
    const actions = [makeAction({ id: "action-1", title: "Repair Event", domain: Domain.WASTE })];
    const gardens = [
      makeGarden({
        id: "0xGarden" as Address,
        domainMask: (1 << Domain.SOLAR) | (1 << Domain.WASTE),
      }),
    ];

    renderIntro({ actions, gardens, selectedDomain: Domain.SOLAR });

    const emptyState = screen.getByText("No active actions at this time.");
    expect(emptyState.className).toContain("h-[13.25rem]");
    expect(emptyState.closest("[data-testid='carousel-item']")?.className).toContain("basis-full");
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

  it("shows a validated deep-linked commitment and exact requirement", () => {
    renderIntro({
      showCommitmentChoices: true,
      commitmentChoices: [
        {
          key: "9:1",
          commitmentId: 9n,
          requirementIndex: 1,
          title: "Prune the north beds",
        },
      ],
      selectedCommitmentKey: "9:1",
      setSelectedCommitmentKey: vi.fn(),
    });

    expect(screen.getByRole("combobox", { name: "Commitment (optional)" })).toHaveValue("9:1");
    expect(
      screen.getByRole("combobox", { name: "Commitment (optional)" })
    ).toHaveAccessibleDescription("Choose the commitment and exact requirement this work fulfils.");
    expect(
      screen.getByRole("option", { name: "Prune the north beds · requirement 2" })
    ).toBeInTheDocument();
  });

  it("lets a generic submission choose an eligible commitment requirement", () => {
    const setSelectedCommitmentKey = vi.fn();
    renderIntro({
      showCommitmentChoices: true,
      commitmentChoices: [
        {
          key: "9:0",
          commitmentId: 9n,
          requirementIndex: 0,
          title: "Prune the north beds",
        },
      ],
      selectedCommitmentKey: null,
      setSelectedCommitmentKey,
    });

    fireEvent.change(screen.getByRole("combobox", { name: "Commitment (optional)" }), {
      target: { value: "9:0" },
    });

    expect(setSelectedCommitmentKey).toHaveBeenCalledWith("9:0");
  });

  it("announces commitment eligibility loading politely", () => {
    renderIntro({ showCommitmentChoices: true, commitmentChoicesLoading: true });

    expect(screen.getByRole("status")).toHaveTextContent("Checking eligible commitments…");
  });

  it("alerts a failed commitment read and retries it", () => {
    const onRetryCommitmentChoices = vi.fn();
    renderIntro({
      showCommitmentChoices: true,
      commitmentChoicesError: new Error("offline"),
      onRetryCommitmentChoices,
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/could not be read/i);
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(onRetryCommitmentChoices).toHaveBeenCalledTimes(1);
  });

  it("distinguishes an invalid deep link from an empty eligible list", () => {
    const setSelectedCommitmentKey = vi.fn();
    const view = renderIntro({
      showCommitmentChoices: true,
      commitmentIntentStatus: "invalid",
      setSelectedCommitmentKey,
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/no longer eligible/i);
    fireEvent.click(screen.getByRole("button", { name: "No commitment" }));
    expect(setSelectedCommitmentKey).toHaveBeenCalledWith(null);

    view.rerender(
      createElement(
        IntlProvider,
        { locale: "en", messages },
        createElement(WorkIntro, {
          actions: [],
          gardens: [],
          selectedActionUID: null,
          selectedGardenAddress: null,
          selectedDomain: null,
          setActionUID: vi.fn(),
          setGardenAddress: vi.fn(),
          setSelectedDomain: vi.fn(),
          showCommitmentChoices: true,
        })
      )
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("No eligible commitments match this garden and action.")).toBeVisible();
  });

  it("keeps actions visible and shows an inline community join CTA with no joined gardens", () => {
    const actions = [makeAction({ id: "action-1", title: "Plant Trees" })];
    const communityGarden = makeGarden({
      id: "0xCommunityGarden" as Address,
      name: "Community Garden",
      openJoining: true,
    });

    renderIntro({
      actions,
      gardens: [],
      hasJoinedGardens: false,
      joinableCommunityGarden: communityGarden,
      onJoinCommunityGarden: vi.fn(),
    });

    expect(screen.getByTestId("action-card-Plant Trees")).toBeInTheDocument();
    expect(screen.getByText("Join the Community Garden")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join Community Garden" })).toBeInTheDocument();
  });

  it("fires onJoinCommunityGarden from the inline community CTA", () => {
    const onJoinCommunityGarden = vi.fn();
    const communityGarden = makeGarden({
      id: "0xCommunityGarden" as Address,
      name: "Community Garden",
      openJoining: true,
    });

    renderIntro({
      gardens: [],
      hasJoinedGardens: false,
      joinableCommunityGarden: communityGarden,
      onJoinCommunityGarden,
    });

    fireEvent.click(screen.getByRole("button", { name: "Join Community Garden" }));

    expect(onJoinCommunityGarden).toHaveBeenCalledTimes(1);
  });

  it("shows the passive empty state when no joinable community garden is available", () => {
    renderIntro({ gardens: [], hasJoinedGardens: false, joinableCommunityGarden: null });

    expect(
      screen.getByText("No gardens available. You may need to join a garden first.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join Community Garden" })).not.toBeInTheDocument();
  });

  it("shows domain tabs when multiple domains exist", () => {
    const actions = [
      makeAction({ id: "action-1", title: "Solar Work", domain: Domain.SOLAR }),
      makeAction({ id: "action-2", title: "Agro Work", domain: Domain.AGRO }),
    ];

    renderIntro({ actions });

    expect(screen.getByTestId("domain-tabs")).toBeInTheDocument();
    expect(screen.getByTestId(`domain-tab-${Domain.SOLAR}`)).toBeInTheDocument();
    const agroTab = screen.getByTestId(`domain-tab-${Domain.AGRO}`);
    expect(agroTab).toBeInTheDocument();
    expect(agroTab).toHaveTextContent("Agroforestry");
    expect(agroTab.className).toContain("text-[10px]");
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
