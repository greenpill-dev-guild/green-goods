/**
 * The Start step of logging work (DL-131): its screens and what each control does. The step's
 * answers and its moves (the skip, choosing an action or a promise, opening evidence) are the
 * shared controller's, proven there; this proves what the step draws and hands back.
 */

import en from "@green-goods/shared/i18n/en";
import { type Action, Domain, type Garden } from "@green-goods/shared/types/domain";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkStart, type WorkStartProps } from "../../views/Garden/Start";

type StartStep = WorkStartProps["start"];
type StartPromise = StartStep["promises"][number];

const GARDEN = "0x2222222222222222222222222222222222222222" as const;

function action(uid: number, title: string, domain: Domain | null): Action {
  return {
    id: `11155111-${uid}`,
    slug: `action-${uid}`,
    title,
    description: "",
    domain,
    startTime: 0,
    endTime: Number.MAX_SAFE_INTEGER,
    capitals: [],
    media: [],
    createdAt: 0,
    inputs: [],
    mediaInfo: { title: "Evidence", required: true, minImageCount: 1 },
  };
}

const ACTIONS = [
  action(1, "Panel Cleaning", Domain.SOLAR),
  action(2, "Workshop Delivered", Domain.EDU),
  action(3, "Mentoring Session", Domain.EDU),
  action(4, "Compost Turn", Domain.WASTE),
];

function choice(actionUID: number, requirementIndex = actionUID) {
  return {
    commitmentId: 9n,
    requirementIndex,
    actionUID,
    garden: GARDEN,
    commitmentTitle: "Node uptime log",
    requirementLabel: String(requirementIndex + 1),
    returnTo: `/home/${GARDEN}/commitments/9`,
    approvedCount: 1,
    requiredCount: 4,
  };
}

function promise(uids: number[], takesEvidence: boolean): StartPromise {
  return {
    commitmentId: 9n,
    title: "Node uptime log",
    direction: "REQUEST",
    state: "ACTIVE",
    dueDate: null,
    targetUnits: 0n,
    unitLabel: null,
    // The whole promise's progress, which the requirements listed here only part of.
    progress: { approved: 5, required: 8 },
    choices: uids.map((uid) => choice(uid)),
    takesEvidence,
  };
}

function startStep(overrides: Partial<StartStep> = {}): StartStep {
  return {
    skipped: false,
    waiting: false,
    actions: ACTIONS,
    domains: [Domain.SOLAR, Domain.EDU, Domain.WASTE],
    promises: [],
    asks: [],
    askPromptCount: 3,
    promisesFailed: false,
    retryPromises: vi.fn(),
    screen: { kind: "actions" },
    pickPromise: vi.fn(),
    logWorkOnItsOwn: vi.fn(),
    chooseAction: vi.fn(),
    choosePromiseAction: vi.fn(),
    chooseGarden: vi.fn(),
    addEvidence: vi.fn(),
    back: vi.fn(() => false),
    ...overrides,
  };
}

/** The step as the flow mounts it, with the domain chip kept the way the work store keeps it. */
function Harness(props: Partial<WorkStartProps> & { onDomain?: (domain: Domain | null) => void }) {
  const [domain, setDomain] = useState<Domain | null>(null);
  return (
    <WorkStart
      start={startStep()}
      actionsLoading={false}
      hasActions
      selectedActionUID={null}
      selectedDomain={domain}
      setSelectedDomain={(next) => {
        setDomain(next);
        props.onDomain?.(next);
      }}
      gardenQuestion={null}
      link={{ status: "none", onRetry: vi.fn(), onLetGo: vi.fn() }}
      {...props}
    />
  );
}

function renderStart(
  props: Partial<WorkStartProps> & { onDomain?: (domain: Domain | null) => void }
) {
  return render(
    <IntlProvider locale="en" messages={en}>
      <Harness {...props} />
    </IntlProvider>
  );
}

const tiles = () =>
  within(screen.getByRole("listbox", { name: "Select Your Action" }))
    .getAllByRole("option")
    .map((tile) => within(tile).getByRole("heading").textContent);

afterEach(cleanup);

describe("WorkStart", () => {
  it("filters the tiles with the domain chips, which choose nothing and move nothing", () => {
    const onDomain = vi.fn();
    const start = startStep();
    renderStart({ start, onDomain });

    const chips = within(screen.getByRole("group", { name: "Domains" }));
    expect(chips.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    // Work done for no promise is the ordinary case: nothing here says a promise is missing.
    expect(screen.queryByText(/promise/i)).toBeNull();
    expect(tiles()).toEqual([
      "Panel Cleaning",
      "Workshop Delivered",
      "Mentoring Session",
      "Compost Turn",
    ]);

    fireEvent.click(chips.getByRole("button", { name: "Education" }));
    expect(onDomain).toHaveBeenLastCalledWith(Domain.EDU);
    expect(tiles()).toEqual(["Workshop Delivered", "Mentoring Session"]);
    expect(start.chooseAction).not.toHaveBeenCalled();

    fireEvent.click(chips.getByRole("button", { name: "All" }));
    expect(onDomain).toHaveBeenLastCalledWith(null);
    expect(tiles()).toHaveLength(4);

    // Only a tile chooses, and choosing is what moves the flow on.
    fireEvent.click(screen.getByRole("option", { name: /Compost Turn/ }));
    expect(start.chooseAction).toHaveBeenCalledWith(4);
  });

  it("draws no chips for a garden with one domain", () => {
    renderStart({
      start: startStep({ actions: ACTIONS.slice(1, 3), domains: [Domain.EDU] }),
    });
    expect(screen.queryByRole("group", { name: "Domains" })).toBeNull();
    expect(tiles()).toEqual(["Workshop Delivered", "Mentoring Session"]);
  });

  it("lists the member's promises as compact cards, two needs and +N, with Log Work on Its Own last", () => {
    const owed = promise([1, 2, 3], true);
    const start = startStep({ screen: { kind: "promises" }, promises: [owed] });
    const { container } = renderStart({ start });

    expect(screen.getByText("Keep a Promise")).toBeVisible();
    const card = container.querySelector('[data-component="PromiseCard"]') as HTMLElement;
    // Three actions and Evidence: the first two show, the other two fold into +2.
    expect(within(card).getByText("Panel Cleaning")).toBeVisible();
    expect(within(card).getByText("Workshop Delivered")).toBeVisible();
    expect(within(card).queryByText("Mentoring Session")).toBeNull();
    expect(within(card).getByText("+2")).toBeVisible();
    // The promise's own progress, not the sum of the three requirements it lists here.
    expect(within(card).getByText("5 of 8 approved")).toBeVisible();

    const rows = container.querySelector(".flex.flex-col.gap-\\(--gg-list-gap\\)") as HTMLElement;
    expect(rows.lastElementChild).toHaveAttribute("data-component", "LogWorkOnItsOwn");

    fireEvent.click(card);
    expect(start.pickPromise).toHaveBeenCalledWith(owed);
    // A row with nothing else to press is itself the button.
    fireEvent.click(screen.getByRole("button", { name: /Log Work on Its Own/ }));
    expect(start.logWorkOnItsOwn).toHaveBeenCalledTimes(1);
  });

  it("lists the garden's Open asks after the member's promises, saying how many prompts one takes", () => {
    const owed = promise([1], false);
    const ask: StartPromise = {
      ...promise([2], false),
      commitmentId: 31n,
      title: "Hub keys handover",
      state: "REQUESTED",
    };
    const start = startStep({ screen: { kind: "promises" }, promises: [owed], asks: [ask] });
    const { container } = renderStart({ start });

    const section = container.querySelector('[data-component="StartAsks"]') as HTMLElement;
    expect(within(section).getByRole("heading", { name: "Take Up an Ask" })).toBeVisible();
    expect(
      within(section).getByText(
        "Taking one up opens 3 wallet or passkey prompts: the take-up, the work and its link."
      )
    ).toBeVisible();
    const cards = container.querySelectorAll<HTMLElement>('[data-component="PromiseCard"]');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("Node uptime log")).toBeVisible();
    expect(within(cards[1]).getByText("Hub keys handover")).toBeVisible();
    expect(within(cards[1]).getByText("Asked for")).toBeVisible();
    expect(
      container.querySelector('[data-component="WorkStart"] [data-component="LogWorkOnItsOwn"]')
        ?.previousElementSibling
    ).toBe(section);

    fireEvent.click(cards[1]);
    expect(start.pickPromise).toHaveBeenCalledWith(ask);
  });

  it("says on the promises screen when the garden's Open asks could not be read, with a retry", () => {
    const start = startStep({
      screen: { kind: "promises" },
      promises: [promise([1], false)],
      promisesFailed: true,
    });
    renderStart({ start });

    expect(
      screen.getByText("Eligible promises could not be read. Try again or continue without one.")
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(start.retryPromises).toHaveBeenCalledOnce();
  });

  it.each([
    ["rows up to three", [1, 2, 3], 3, false],
    ["two-up tiles past that", [1, 2, 3, 4], 4, true],
  ])("opens a promise's screen with Add Evidence first, then its actions as %s", (_case, uids, count, asTiles) => {
    const owed = promise(uids, true);
    const start = startStep({ screen: { kind: "promise", promise: owed }, promises: [owed] });
    const { container } = renderStart({ start });

    const screenRoot = container.querySelector('[data-component="WorkStart"]') as HTMLElement;
    // The heading panel names the promise, then Add Evidence leads the choices.
    expect(within(screenRoot).getByText("Node uptime log")).toBeVisible();
    const evidence = container.querySelector('[data-component="AddEvidence"]') as HTMLElement;
    expect(evidence.compareDocumentPosition(screen.getByText("Actions for This Promise"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    fireEvent.click(evidence);
    expect(start.addEvidence).toHaveBeenCalledWith(owed);

    const listbox = screen.queryByRole("listbox", { name: "Actions for This Promise" });
    expect(Boolean(listbox)).toBe(asTiles);
    const picks = asTiles
      ? within(listbox as HTMLElement).getAllByRole("option")
      : screen.getAllByRole("button", { name: /Panel Cleaning|Workshop|Mentoring/ });
    expect(picks).toHaveLength(count);
    fireEvent.click(picks[1]);
    expect(start.choosePromiseAction).toHaveBeenCalledWith(owed.choices[1]);
  });

  it("asks for the garden only while the flow has none it can use, with the Community Garden's door", () => {
    const onJoin = vi.fn();
    const community = { id: GARDEN, name: "Community Garden" } as Garden;
    renderStart({
      gardenQuestion: {
        gardens: [],
        selected: null,
        onSelect: vi.fn(),
        hasJoined: false,
        loading: false,
        joinable: community,
        joining: false,
        onJoin,
      },
    });
    expect(screen.getByText("Select Your Garden")).toBeVisible();
    expect(screen.queryByRole("listbox", { name: "Select Your Action" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Join Garden" }));
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it("says when the page's promise link no longer holds, with a way to let it go", () => {
    const onLetGo = vi.fn();
    renderStart({ link: { status: "invalid", onRetry: vi.fn(), onLetGo } });
    expect(
      screen.getByText(
        "That promise link is no longer eligible. Choose another promise or continue without one."
      )
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Try Again" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Not for a Promise" }));
    expect(onLetGo).toHaveBeenCalledTimes(1);
  });
});
