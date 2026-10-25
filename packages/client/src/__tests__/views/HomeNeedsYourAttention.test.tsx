/**
 * Home's Needs Your Attention (PWA Home step 19, decisions 22 and 27): only while something
 * waits that the account can act on, one row per queue with its count, each opening that exact
 * queue. Who may see each queue is the hook's (useStewardDuties); this is what the rows say and do.
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
const state = vi.hoisted(() => ({
  isOnline: true,
  duties: undefined as unknown as StewardDuties,
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mockNavigate,
}));
vi.mock("@green-goods/shared/hooks/garden/useStewardDuties", () => ({
  useStewardDuties: () => state.duties,
}));
vi.mock("@green-goods/shared/hooks/app/useOnlineStatus", () => ({
  useOnlineStatus: () => state.isOnline,
}));
vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useActions: () => ({ data: [] }),
}));
vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  useCommitmentMetadata: () => ({
    byCID: new Map([
      ["cid-outage", { title: "Outage log" }],
      ["cid-solar", { title: "Solar install help" }],
    ]),
  }),
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

function renderSection() {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(
        IntlProvider,
        { locale: "en", messages: en },
        createElement(NeedsYourAttention, { garden })
      )
    )
  );
}

const heading = () => screen.queryByRole("heading", { name: "Needs Your Attention" });
const rows = () => within(heading()!.closest("section")!).getAllByRole("listitem");
const titleOf = (row: HTMLElement) => row.querySelector(".gg-item-row-title")?.textContent;

describe("Home Needs Your Attention", () => {
  const openCommitmentsSheet = vi.fn();
  const realOpen = useUIStore.getState().openCommitmentsSheet;

  beforeEach(() => {
    vi.clearAllMocks();
    state.isOnline = true;
    vi.spyOn(Date, "now").mockReturnValue(NOW * 1000);
    useUIStore.setState({ openCommitmentsSheet });
  });

  afterEach(() => {
    useUIStore.setState({ openCommitmentsSheet: realOpen });
    vi.restoreAllMocks();
  });

  it("is absent while nothing waits that the account can act on, and while it is still finding out", () => {
    state.duties = duties({ isLoading: true });

    const { container } = renderSection();

    expect(heading()).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("gives each waiting queue a row with its count, and each opens its exact queue", () => {
    state.duties = duties({
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
    });

    renderSection();
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

    fireEvent.click(within(review).getByRole("button"));
    expect(mockNavigate).toHaveBeenLastCalledWith(`/home/${GARDEN}`, { viewTransition: true });
    fireEvent.click(within(takeUp).getByRole("button"));
    expect(mockNavigate).toHaveBeenLastCalledWith(`/home/${GARDEN}/commitments/4`, {
      viewTransition: true,
    });
    fireEvent.click(within(confirm).getByRole("button"));
    expect(openCommitmentsSheet).toHaveBeenCalledWith({ tab: "to-confirm" });
  });

  it("says a queue could not be read rather than going quiet, and reads again on Try Again", () => {
    const refetch = vi.fn();
    state.duties = duties({ isError: true, refetch });

    renderSection();

    expect(rows().map(titleOf)).toEqual(["Couldn't load it all"]);
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("keeps what it could read beside the failure, and offers no Try Again offline", () => {
    state.isOnline = false;
    state.duties = duties({
      isError: true,
      duties: [{ kind: "confirm", count: 2, commitments: [promise(9n, "cid-solar")] }],
    });

    renderSection();

    expect(rows().map(titleOf)).toEqual(["2 promises to confirm", "Couldn't load it all"]);
    expect(screen.queryByRole("button", { name: "Try Again" })).toBeNull();
  });
});
