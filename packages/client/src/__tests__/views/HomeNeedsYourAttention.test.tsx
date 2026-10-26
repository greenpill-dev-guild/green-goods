/**
 * Home's Needs Your Attention (PWA Home step 19, decisions 22 and 27): only while something
 * waits that the account can act on, one row per queue with its count, each opening that exact
 * queue. HomeJournal reads the duties once (useStewardDuties, which decides who sees which) and
 * hands them in; this is what the rows say and do.
 */

import type { StewardDuties } from "@green-goods/shared/hooks/garden/useStewardDuties";
import en from "@green-goods/shared/i18n/en.json";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import type { Garden, Work } from "@green-goods/shared/types/domain";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const GARDEN = "0x6a7de00000000000000000000000000000000aaa";
const NOW = 1_800_000_000;
const mockNavigate = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({ isOnline: true }));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mockNavigate,
}));
vi.mock("@green-goods/shared/hooks/app/useOnlineStatus", () => ({
  useOnlineStatus: () => state.isOnline,
}));
vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useActions: () => ({ data: [] }),
}));
const metadataReads = vi.hoisted(() => [] as Array<readonly { commitmentId: bigint }[]>);
vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  useCommitmentMetadata: (commitments: readonly { commitmentId: bigint }[]) => {
    metadataReads.push(commitments);
    return {
      byCID: new Map([
        ["cid-outage", { title: "Outage log" }],
        ["cid-solar", { title: "Solar install help" }],
      ]),
    };
  },
}));

import { NeedsYourAttention } from "../../views/Home/Journal/NeedsYourAttention";

const garden = { id: GARDEN, name: "TAS HUB" } as Garden;

function work(id: string, title: string, createdAt: number): Work {
  return {
    id,
    title,
    actionUID: 1,
    gardenerAddress: "0xb0b0000000000000000000000000000000000002",
    gardenAddress: GARDEN,
    feedback: "",
    metadata: "",
    media: [],
    createdAt,
    status: "pending",
  } as Work;
}

const promise = (commitmentId: bigint, metadataCID: string) =>
  ({ commitmentId, metadataCID }) as never;

function duties(overrides: Partial<StewardDuties> = {}): StewardDuties {
  return { duties: [], isLoading: false, isError: false, refetch: vi.fn(), ...overrides };
}

function renderSection(stewardDuties: StewardDuties) {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(
        IntlProvider,
        { locale: "en", messages: en },
        createElement(NeedsYourAttention, { garden, duties: stewardDuties })
      )
    )
  );
}

const heading = () => screen.queryByRole("heading", { name: "Needs Your Attention" });
const rows = () => within(heading()!.closest("section")!).getAllByRole("listitem");
const titleOf = (row: HTMLElement) => row.querySelector(".gg-item-row-title")?.textContent;

describe("Home Needs Your Attention", () => {
  const openCommitmentsSheet = vi.fn();
  const openGardenSheet = vi.fn();
  const real = {
    openCommitmentsSheet: useUIStore.getState().openCommitmentsSheet,
    openGardenSheet: useUIStore.getState().openGardenSheet,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    state.isOnline = true;
    vi.spyOn(Date, "now").mockReturnValue(NOW * 1000);
    useUIStore.setState({ openCommitmentsSheet, openGardenSheet });
  });

  afterEach(() => {
    useUIStore.setState(real);
    vi.restoreAllMocks();
  });

  it("is absent while nothing waits that the account can act on, and while it is still finding out", () => {
    const { container } = renderSection(duties({ isLoading: true }));

    expect(heading()).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("gives each waiting queue a row with its count, and each opens its exact queue", () => {
    renderSection(
      duties({
        duties: [
          {
            kind: "review",
            count: 2,
            works: [
              work("0x01", "Workshop Delivered", NOW - 2 * 86_400),
              work("0x02", "Hub Shift", NOW),
            ],
          },
          { kind: "takeUp", count: 1, commitment: promise(4n, "cid-outage"), newestAt: NOW - 3600 },
          { kind: "confirm", count: 1, commitments: [promise(9n, "cid-solar")] },
        ],
      })
    );
    const [review, takeUp, confirm] = rows();

    expect(rows().map(titleOf)).toEqual([
      "2 submissions to review",
      "1 take-up request",
      "1 promise to confirm",
    ]);
    // The work waiting longest leads its row's details; each promise row names its promise.
    expect(review.textContent).toContain("Workshop Delivered, Hub Shift");
    expect(takeUp.textContent).toContain("Outage log");
    expect(confirm.textContent).toContain("Solar install help");

    // Work to review opens the garden's Work as a sheet over Home (DL-128), pending first.
    fireEvent.click(within(review).getByRole("button"));
    expect(openGardenSheet).toHaveBeenCalledWith("work");
    expect(mockNavigate).not.toHaveBeenCalled();
    fireEvent.click(within(takeUp).getByRole("button"));
    expect(mockNavigate).toHaveBeenLastCalledWith(`/home/${GARDEN}/commitments/4`, {
      viewTransition: true,
    });
    fireEvent.click(within(confirm).getByRole("button"));
    expect(openCommitmentsSheet).toHaveBeenCalledWith({ tab: "to-confirm" });
  });

  it("hands the Work sheet the row that opened it: a duty row takes focus as it is pressed", () => {
    renderSection(
      duties({
        duties: [{ kind: "review", count: 1, works: [work("0x01", "Workshop Delivered", NOW)] }],
      })
    );
    const row = within(rows()[0]).getByRole("button");
    let focusedAtOpen: Element | null = null;
    openGardenSheet.mockImplementationOnce(() => {
      focusedAtOpen = document.activeElement;
    });

    // A tap presses and clicks a button, and in Safari it focuses nothing; the sheet hands
    // focus back to whatever held it as it opened.
    fireEvent.pointerDown(row);
    fireEvent.click(row);

    expect(openGardenSheet).toHaveBeenCalledWith("work");
    expect(focusedAtOpen).toBe(row);
  });

  it("reads the titles it names and no more, and names an incomplete review queue without a count", () => {
    renderSection(
      duties({
        duties: [
          {
            kind: "review",
            count: 1,
            uncounted: true,
            works: [work("0x01", "Workshop Delivered", NOW - 86_400)],
          },
          {
            kind: "confirm",
            count: 4,
            commitments: [
              promise(9n, "cid-solar"),
              promise(10n, "cid-outage"),
              promise(11n, "cid-x"),
              promise(12n, "cid-y"),
            ],
          },
        ],
      })
    );

    expect(screen.getByText("Submissions to review")).toBeTruthy();
    expect(metadataReads.at(-1)?.map((commitment) => commitment.commitmentId)).toEqual([9n, 10n]);
  });

  it("says a queue could not be read rather than going quiet, and reads again on Try Again", () => {
    const refetch = vi.fn();
    renderSection(duties({ isError: true, refetch }));

    expect(rows().map(titleOf)).toEqual(["Couldn't load it all"]);
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("keeps what it could read beside the failure, and offers no Try Again offline", () => {
    state.isOnline = false;
    renderSection(
      duties({
        isError: true,
        duties: [{ kind: "confirm", count: 2, commitments: [promise(9n, "cid-solar")] }],
      })
    );

    expect(rows().map(titleOf)).toEqual(["2 promises to confirm", "Couldn't load it all"]);
    expect(screen.queryByRole("button", { name: "Try Again" })).toBeNull();
  });
});
