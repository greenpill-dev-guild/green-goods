/**
 * Home's notifications bell and its sheet (PWA Home step 15, DL-130): the last launcher, whose
 * badge counts the events this device has not shown, and the tall sheet of the garden's events,
 * one row each, newest first, that opens the work or the promise and marks the listed events
 * seen. The read model is step 14's hook, mocked here; the rows, the sheet and its states run.
 */

import type {
  CommitmentClaimRequestRecord,
  CommitmentReadModel,
} from "@green-goods/shared/commitment-pooling";
import type {
  GardenNotification,
  GardenNotifications,
} from "@green-goods/shared/hooks/garden/useGardenNotifications";
import en from "@green-goods/shared/i18n/en.json";
import type { Address, Work } from "@green-goods/shared/types/domain";
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

/** A work as the garden's reads list it, in the active garden. */
function work(
  overrides: Partial<Work> & Pick<Work, "id" | "title" | "gardenerAddress" | "status" | "createdAt">
): Work {
  return {
    actionUID: 1,
    gardenAddress: GARDEN,
    feedback: "",
    metadata: "{}",
    media: [],
    ...overrides,
  };
}

/** The fields the bell's rows read of a promise, over a record the rest of the test ignores. */
function promise(
  overrides: Partial<CommitmentReadModel> & Pick<CommitmentReadModel, "commitmentId">
): CommitmentReadModel {
  return {
    id: `42161-${overrides.commitmentId.toString()}`,
    chainId: 42161,
    creationSeen: true,
    onchainState: "ACCEPTED",
    state: "ACCEPTED",
    derivedState: "ACCEPTED",
    approvedUnits: 0n,
    evidenceCount: 0,
    cycleId: null,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 6n,
    unitLabel: "hours",
    poolId: 101n,
    direction: "OFFER",
    creator: ALICE,
    leadProvider: ALICE,
    counterparty: null,
    ...overrides,
  } as unknown as CommitmentReadModel;
}

/** A pending take-up request on a promise. */
function claim(
  overrides: Pick<CommitmentClaimRequestRecord, "commitmentId" | "claimant" | "requestedAt">
): CommitmentClaimRequestRecord {
  return {
    id: `claim-${overrides.commitmentId.toString()}`,
    chainId: 42161,
    requestSeen: true,
    requestedBy: overrides.claimant,
    claimType: "INDIVIDUAL",
    gardenContext: null,
    state: "PENDING",
    reasonCID: null,
    resolutionCode: null,
    resolvedAt: null,
    updatedAt: overrides.requestedAt,
    ...overrides,
  } as CommitmentClaimRequestRecord;
}

const mockNavigate = vi.hoisted(() => vi.fn());
// Connectivity as the sheet reads it; offline, the reads pause and the block says so.
const online = vi.hoisted(() => ({ value: true }));
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
vi.mock("@green-goods/shared/hooks/app/useOnlineStatus", () => ({
  useOnlineStatus: () => online.value,
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
    commitment: promise({
      commitmentId: 21n,
      direction: "REQUEST",
      creator: BOB,
      leadProvider: null,
      claimMode: "APPROVAL_GATED",
      onchainState: "REQUESTED",
      metadataCID: "bafy-workday",
    }),
    claim: claim({ commitmentId: 21n, claimant: CAROL, requestedAt: NOW - HOUR }),
  },
  {
    kind: "workSubmitted",
    id: "submission:0xw2",
    at: NOW - 2 * HOUR,
    work: work({
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
    commitment: promise({
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
    work: work({
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
    work: work({
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

/**
 * Home's part: it owns whether the sheet is open and closes it when told to. A tap on Home's
 * placeholder bell before the launcher loads mounts the launcher already open.
 */
function Host({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
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

function renderBell({ initialOpen = false }: { initialOpen?: boolean } = {}) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/home"] },
      createElement(
        IntlProvider,
        { locale: "en", messages: en },
        createElement(Host, { initialOpen })
      )
    )
  );
}

const bellButton = () => screen.getByTestId("notifications-button");
const openSheet = () => {
  fireEvent.click(bellButton());
  return screen.getByRole("dialog", { name: "Notifications" });
};
const rowsOf = (sheet: HTMLElement) => within(sheet).getAllByRole("listitem");
/** The record a work event carries, which its row hands on to the work page. */
const workOfEvent = (index: number) => {
  const event = EVENTS[index];
  return "work" in event ? event.work : undefined;
};
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
    // The row's record goes with it, so a work outside the garden's loaded page opens offline.
    expect(mockNavigate).toHaveBeenLastCalledWith(`/home/${GARDEN}/work/0xw2`, {
      state: { from: "home", returnTo: "/home", work: workOfEvent(1) },
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
      state: { from: "home", returnTo: "/home", work: workOfEvent(4) },
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

  it("says the events cannot be checked offline instead of reporting an empty inbox", () => {
    online.value = false;
    try {
      setBell({ notifications: [] });
      renderBell();
      const sheet = openSheet();

      expect(within(sheet).getByRole("heading", { name: "You are offline" })).toBeInTheDocument();
      expect(within(sheet).queryByRole("heading", { name: "Nothing New" })).toBeNull();
    } finally {
      online.value = true;
    }
  });

  it("keeps the rows it has offline under the partial-read line, since the other reads are paused", () => {
    online.value = false;
    try {
      renderBell();
      const sheet = openSheet();

      expect(
        within(sheet).getByText("Some events couldn't be read. Nothing was lost.")
      ).toBeInTheDocument();
      expect(rowsOf(sheet)).toHaveLength(5);
    } finally {
      online.value = true;
    }
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

  it("hands focus back to its own bell when it mounted with the sheet already open", () => {
    // The tapped placeholder is gone by the time the sheet captures who opened it.
    renderBell({ initialOpen: true });
    expect(screen.getByRole("dialog", { name: "Notifications" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(bellButton());
  });
});
