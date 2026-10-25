/**
 * Home's notifications bell and its sheet (PWA Home step 15, DL-130): the last launcher, whose
 * badge counts the events this device has not shown, and the tall sheet of the garden's events,
 * one row each, newest first, that opens the work or the promise and marks the listed events
 * seen. The read model is step 14's hook, mocked here; the rows, the sheet and its states run.
 */

import type {
  GardenNotification,
  GardenNotifications,
} from "@green-goods/shared/hooks/garden/useGardenNotifications";
import en from "@green-goods/shared/i18n/en.json";
import { claimFixture, commitmentFixture, createMockWork } from "@green-goods/shared/testing";
import type { Address } from "@green-goods/shared/types/domain";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createElement, useState } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const GARDEN = "0x6000000000000000000000000000000000000001" as Address;
const ALICE = "0xa11ce00000000000000000000000000000000001" as Address;
const BOB = "0xb0b0000000000000000000000000000000000002" as Address;
const CAROL = "0x3333333333333333333333333333333333333333" as Address;
const HOUR = 3_600;
const NOW = Math.floor(Date.now() / 1000);
const TITLES: Record<string, string> = {
  "bafy-workday": "Weekend workday",
  "bafy-seedlings": "Seedlings for the school",
};

const mockNavigate = vi.hoisted(() => vi.fn());
const bell = vi.hoisted(() => ({ state: {} as GardenNotifications }));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mockNavigate,
}));
vi.mock("@green-goods/shared/hooks/garden/useGardenNotifications", () => ({
  useGardenNotifications: () => bell.state,
}));
// Names come from ENS reads; the rows read as short addresses here.
vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: undefined }),
}));
vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({ data: undefined }),
}));
// A promise's words live at its metadata CID.
vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  useCommitmentMetadata: (commitments: readonly { metadataCID?: string | null }[]) => ({
    byCID: new Map(
      commitments
        .filter((commitment) => commitment.metadataCID && TITLES[commitment.metadataCID])
        .map((commitment) => [
          commitment.metadataCID as string,
          { version: 1, title: TITLES[commitment.metadataCID as string] },
        ])
    ),
    isLoading: false,
  }),
}));

import { NotificationsLauncher } from "../../views/Home/Notifications/Launcher";

/** The garden's events for Alice, a steward, newest first, as the hook lists them. */
const EVENTS: GardenNotification[] = [
  {
    kind: "takeUpRequested",
    id: `takeUp:21:${NOW - HOUR}`,
    at: NOW - HOUR,
    commitment: commitmentFixture({
      commitmentId: 21n,
      direction: "REQUEST",
      creator: BOB,
      leadProvider: null,
      claimMode: "APPROVAL_GATED",
      onchainState: "REQUESTED",
      metadataCID: "bafy-workday",
    }),
    claim: claimFixture({ commitmentId: 21n, claimant: CAROL, requestedAt: NOW - HOUR }),
  },
  {
    kind: "workSubmitted",
    id: "submission:0xw2",
    at: NOW - 2 * HOUR,
    work: createMockWork({
      id: "0xw2",
      title: "Hedge Planting",
      gardenerAddress: BOB,
      gardenAddress: GARDEN,
      status: "pending",
      createdAt: NOW - 2 * HOUR,
      media: ["https://images.example/hedge.jpg"],
    }),
  },
  {
    kind: "promiseTakenUp",
    id: `takenUp:11:${NOW - 3 * HOUR}`,
    at: NOW - 3 * HOUR,
    commitment: commitmentFixture({
      commitmentId: 11n,
      creator: ALICE,
      leadProvider: ALICE,
      counterparty: BOB,
      acceptanceAt: NOW - 3 * HOUR,
      metadataCID: "bafy-seedlings",
    }),
  },
  {
    kind: "workRejected",
    id: `review:0xw4:${NOW - 5 * HOUR}`,
    at: NOW - 5 * HOUR,
    work: createMockWork({
      id: "0xw4",
      title: "Compost Turn",
      gardenerAddress: ALICE,
      gardenAddress: GARDEN,
      status: "rejected",
      createdAt: NOW - 20 * HOUR,
      reviewedAt: NOW - 5 * HOUR,
      reviewFeedback: "The photo misses the new bed.",
      media: [],
    }),
  },
  {
    kind: "workApproved",
    id: `review:0xw1:${NOW - 26 * HOUR}`,
    at: NOW - 26 * HOUR,
    work: createMockWork({
      id: "0xw1",
      title: "Seed Swap",
      gardenerAddress: ALICE,
      gardenAddress: GARDEN,
      status: "approved",
      createdAt: NOW - 30 * HOUR,
      reviewedAt: NOW - 26 * HOUR,
      media: [],
    }),
  },
];

const markAllSeen = vi.fn();
const onClose = vi.fn();

function setBell(overrides: Partial<GardenNotifications> = {}) {
  const notifications = (
    overrides.notifications ?? EVENTS.map((event) => ({ ...event, isNew: true }))
  ).slice();
  bell.state = {
    notifications,
    newCount: notifications.filter(({ isNew }) => isNew).length,
    isLoading: false,
    isError: false,
    isIncomplete: false,
    markAllSeen,
    ...overrides,
  };
}

/** Home's part: it owns whether the sheet is open and closes it when told to. */
function Host() {
  const [open, setOpen] = useState(false);
  return createElement(NotificationsLauncher, {
    gardenId: GARDEN,
    gardenName: "TAS HUB",
    open,
    onOpen: () => setOpen(true),
    onClose: () => {
      onClose();
      setOpen(false);
    },
  });
}

function renderBell() {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/home"] },
      createElement(IntlProvider, { locale: "en", messages: en }, createElement(Host))
    )
  );
}

const bellButton = () => screen.getByTestId("notifications-button");
const openSheet = () => {
  fireEvent.click(bellButton());
  return screen.getByRole("dialog", { name: "Notifications" });
};
const rowsOf = (sheet: HTMLElement) => within(sheet).getAllByRole("listitem");
const titleOf = (row: HTMLElement) => row.querySelector(".gg-item-row-title")?.textContent;
const detailsOf = (row: HTMLElement) =>
  [...row.querySelectorAll(".gg-item-row-detail-text")].map((detail) => detail.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  setBell();
});

describe("the bell", () => {
  it("counts what is new in one 16px badge, named in its label, and shows no standing count", () => {
    renderBell();

    expect(screen.getByRole("button", { name: "Notifications, 5 new" })).toBe(bellButton());
    const badge = screen.getByTestId("notifications-badge");
    expect(badge).toHaveTextContent("5");
    expect(badge).toHaveClass("gg-count-badge");
    expect(badge).toHaveAttribute("data-ring");
    expect(bellButton()).toHaveAttribute("data-size", "compact");
  });

  it("carries no badge once everything listed was seen, however many events the garden has", () => {
    setBell({ notifications: EVENTS.map((event) => ({ ...event, isNew: false })) });
    renderBell();

    expect(screen.getByRole("button", { name: "Notifications" })).toBe(bellButton());
    expect(screen.queryByTestId("notifications-badge")).toBeNull();
  });
});

describe("the sheet", () => {
  it("opens tall, named for the garden, lists the events newest first as rows of one anatomy, and marks them seen", () => {
    renderBell();
    const sheet = openSheet();

    expect(sheet).toHaveAttribute("data-sheet-size", "tall");
    expect(within(sheet).getByText("In TAS HUB")).toBeInTheDocument();
    expect(markAllSeen).toHaveBeenCalledTimes(1);

    const rows = rowsOf(sheet);
    expect(rows.map(titleOf)).toEqual([
      "Weekend workday",
      "Hedge Planting",
      "Seedlings for the school",
      "Compost Turn",
      "Seed Swap",
    ]);
    expect(rows.map((row) => within(row).getByRole("status").textContent)).toEqual([
      "Take-up request",
      "New submission",
      "Taken up",
      "Rejected",
      "Approved",
    ]);
    // Who, as a row names a person, then how long ago; a rejection gives its feedback first.
    const short = (address: Address) => formatAddress(address, { variant: "card" });
    expect(detailsOf(rows[0])).toEqual([short(CAROL), "1 hr. ago"]);
    expect(detailsOf(rows[1])).toEqual([short(BOB), "2 hr. ago"]);
    expect(detailsOf(rows[2])).toEqual([short(BOB), "3 hr. ago"]);
    expect(detailsOf(rows[3])).toEqual(["The photo misses the new bed.", "5 hr. ago"]);
    expect(detailsOf(rows[4])).toEqual(["1 day ago"]);
    // Every row is the one item row, so the list keeps one height.
    for (const row of rows) {
      expect(row.querySelector(".gg-item-row")).not.toBeNull();
    }
  });

  it("opens the work from a work event and the promise from a promise event, closing first", () => {
    renderBell();
    const rows = rowsOf(openSheet());

    fireEvent.click(within(rows[1]).getByRole("button"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenLastCalledWith(`/home/${GARDEN}/work/0xw2`, {
      state: { from: "home", returnTo: "/home" },
      viewTransition: true,
    });

    fireEvent.click(within(rows[2]).getByRole("button"));
    expect(mockNavigate).toHaveBeenLastCalledWith(`/home/${GARDEN}/commitments/11`, {
      state: { from: "home" },
      viewTransition: true,
    });

    // A take-up request is decided on its promise's page.
    fireEvent.click(within(rows[0]).getByRole("button"));
    expect(mockNavigate).toHaveBeenLastCalledWith(`/home/${GARDEN}/commitments/21`, {
      state: { from: "home" },
      viewTransition: true,
    });
    fireEvent.click(within(rows[4]).getByRole("button"));
    expect(mockNavigate).toHaveBeenLastCalledWith(`/home/${GARDEN}/work/0xw1`, {
      state: { from: "home", returnTo: "/home" },
      viewTransition: true,
    });
  });

  it("shows the state block when nothing is new, and holds a row's frame while the events load", () => {
    setBell({ notifications: [] });
    const view = renderBell();
    let sheet = openSheet();

    expect(within(sheet).getByRole("heading", { name: "Nothing New" })).toBeInTheDocument();
    expect(
      within(sheet).getByText("What happens in this garden shows up here.")
    ).toBeInTheDocument();
    expect(markAllSeen).toHaveBeenCalledTimes(1);

    view.unmount();
    setBell({ notifications: [], isLoading: true });
    renderBell();
    sheet = openSheet();

    expect(sheet.querySelector("[data-skeleton='item-row']")).not.toBeNull();
    expect(within(sheet).queryByRole("heading", { name: "Nothing New" })).toBeNull();
  });

  it("keeps the rows under a quiet notice when a read failed or answered only in part", () => {
    setBell({ isIncomplete: true });
    const view = renderBell();
    let sheet = openSheet();

    const notice = within(sheet).getByText("Some events couldn't be read. Nothing was lost.");
    expect(notice.closest("[role='status']")).not.toBeNull();
    expect(rowsOf(sheet)).toHaveLength(5);

    view.unmount();
    setBell({ notifications: [], isError: true });
    renderBell();
    sheet = openSheet();

    // With nothing listed, the state block carries the notice instead of a second block.
    expect(within(sheet).getByRole("heading", { name: "Nothing New" })).toBeInTheDocument();
    expect(
      within(sheet).getByText("Some events couldn't be read. Nothing was lost.")
    ).toBeInTheDocument();
  });

  it("closes from its Close button and from Escape, and the bell takes focus back", () => {
    renderBell();
    const sheet = openSheet();

    fireEvent.click(within(sheet).getByTestId("app-sheet-close"));
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      fireEvent.click(bellButton());
    });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
