/**
 * Home's Continue (PWA Home step 8): the active garden's Your Work still on this phone, in the
 * order Your Work › Pending lists it (DL-061), at most three rows, with Open Your Work.
 */

import type { PendingProof } from "@green-goods/shared/hooks/client-ui/commitment/usePendingProof";
import type { DraftWithImages } from "@green-goods/shared/hooks/work/useDrafts";
import type { YourWorkOnPhone } from "@green-goods/shared/hooks/work/useYourWorkOnPhone";
import en from "@green-goods/shared/i18n/en.json";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import type { Work } from "@green-goods/shared/types/domain";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const GARDEN = "0x6a7de00000000000000000000000000000000aaa";
const mockNavigate = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({
  isOnline: true,
  onPhone: undefined as unknown as YourWorkOnPhone,
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mockNavigate,
}));
vi.mock("@green-goods/shared/hooks/work/useYourWorkOnPhone", () => ({
  useYourWorkOnPhone: () => state.onPhone,
}));
vi.mock("@green-goods/shared/hooks/app/useOnlineStatus", () => ({
  useOnlineStatus: () => state.isOnline,
}));
vi.mock("@green-goods/shared/hooks/commitment-pooling/useCommitmentJobs", () => ({
  useCommitmentJobs: () => ({ sendsFromTap: false }),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useActions: () => ({ data: [] }),
}));
// Photos stay unread: the rows' anatomy is under test, not the preview pipeline.
vi.mock("@green-goods/shared/hooks/work/useDrafts", () => ({
  useDraftThumbnail: () => ({ url: null, ref: () => undefined }),
}));
vi.mock("@green-goods/shared/hooks/work/useWorkImages", () => ({
  useWorkPreviewUrls: () => [],
}));

import { Continue } from "../../views/Home/Journal/Continue";

function queuedWork(id: string, title: string, submissionState?: string): Work {
  return {
    id,
    title,
    actionUID: 1,
    gardenerAddress: "0xa11ce00000000000000000000000000000000001",
    gardenAddress: GARDEN,
    feedback: "",
    metadata: JSON.stringify(submissionState ? { submissionState } : {}),
    media: [],
    createdAt: 1_700_000_000,
    status: "offline",
  } as Work;
}

function draft(id: string, updatedAt: number): DraftWithImages {
  return {
    id,
    userAddress: "0xa11ce00000000000000000000000000000000001",
    chainId: 42161,
    gardenAddress: GARDEN,
    actionUID: null,
    feedback: "",
    currentStep: "media",
    firstIncompleteStep: "media",
    createdAt: updatedAt,
    updatedAt,
    images: [],
    thumbnailUrl: null,
  } as DraftWithImages;
}

function proofDraft(id: string, title: string): PendingProof {
  return {
    id,
    source: "draft",
    commitmentId: 7n,
    garden: GARDEN,
    savedGarden: GARDEN,
    commitment: null,
    title,
    savedAt: 1_700_000_000_000,
    contents: { photos: 1, files: 0, links: 0, words: false },
    waitingReason: null,
    failed: false,
    sending: false,
    discardable: true,
    firstPhoto: null,
  } as unknown as PendingProof;
}

function onPhone(overrides: Partial<YourWorkOnPhone> = {}): YourWorkOnPhone {
  const items = {
    submissions: [],
    decisions: [],
    drafts: [],
    proofs: [],
    ...overrides,
  };
  return {
    decisionFor: () => undefined,
    isLinked: () => false,
    count:
      items.submissions.length + items.decisions.length + items.drafts.length + items.proofs.length,
    isLoading: false,
    isError: false,
    queueUnreadable: false,
    refetch: vi.fn(),
    ...items,
    ...overrides,
  };
}

function renderContinue() {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(IntlProvider, { locale: "en", messages: en }, createElement(Continue))
    )
  );
}

const section = () => screen.getByRole("heading", { name: "Continue" }).closest("section")!;
const rowTitles = () =>
  within(section())
    .getAllByRole("listitem")
    .map((item) => item.querySelector(".gg-item-row-title")?.textContent);

describe("Home Continue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.isOnline = true;
    useUIStore.setState({ isWorkDashboardOpen: false, workDashboardInitialTab: undefined });
  });

  it("lists what needs the reader first, at most three, with no Discard, and opens Your Work on Pending", () => {
    state.onPhone = onPhone({
      submissions: [
        queuedWork("0xoffline_0001", "Compost Turn"),
        queuedWork("0xoffline_0002", "Hedge Planting", "retry-required"),
        queuedWork("0xoffline_0003", "Seed Swap", "awaiting-confirmation"),
      ],
      drafts: [draft("d1", 1_700_000_500_000)],
      proofs: [proofDraft("proof:1", "Workshop photos")],
    });

    renderContinue();

    // Can't upload, then to upload, then drafts (work before proof); checking waits in Your Work.
    expect(rowTitles()).toEqual(["Hedge Planting", "Compost Turn", "Untitled Draft"]);
    expect(within(section()).queryByRole("button", { name: /delete|discard/i })).toBeNull();

    fireEvent.click(within(section()).getByRole("button", { name: "Open Your Work" }));
    expect(useUIStore.getState().isWorkDashboardOpen).toBe(true);
    expect(useUIStore.getState().workDashboardInitialTab).toBe("pending");
  });

  it("opens what Your Work opens: a draft resumes, work opens its page with Home to return to, proof opens its promise", () => {
    state.onPhone = onPhone({
      submissions: [queuedWork("0xoffline_0001", "Compost Turn")],
      drafts: [draft("d1", 1_700_000_500_000)],
      proofs: [proofDraft("proof:1", "Workshop photos")],
    });

    renderContinue();
    const rows = within(section()).getAllByRole("listitem");

    fireEvent.click(within(rows[0]).getByRole("button"));
    expect(mockNavigate).toHaveBeenLastCalledWith(`/home/${GARDEN}/work/0xoffline_0001`, {
      state: { from: "home", returnTo: "/home" },
      viewTransition: true,
    });
    fireEvent.click(within(rows[1]).getByRole("button"));
    expect(mockNavigate).toHaveBeenLastCalledWith("/home/garden?draftId=d1", {
      viewTransition: true,
    });
    fireEvent.click(within(rows[2]).getByRole("button"));
    expect(mockNavigate).toHaveBeenLastCalledWith(`/home/${GARDEN}/commitments/7/proof`, {
      state: { from: "home" },
      viewTransition: true,
    });
  });

  it("says nothing waits on this phone, and what to do instead, and still links to Your Work", () => {
    state.onPhone = onPhone();

    renderContinue();

    expect(rowTitles()).toEqual(["Nothing to continue"]);
    expect(within(section()).getByText("Start new work from the Garden tab")).toBeTruthy();
    expect(within(section()).getByRole("button", { name: "Open Your Work" })).toBeTruthy();
  });

  it("holds a row's frame while the phone's lists are first read", () => {
    state.onPhone = onPhone({ isLoading: true });

    renderContinue();

    expect(section().getAttribute("aria-busy")).toBe("true");
    expect(within(section()).queryByText("Nothing to continue")).toBeNull();
    expect(section().querySelector("[data-skeleton='item-row']")).not.toBeNull();
  });

  it("says a read failed and that nothing was lost, and reads again on Try Again", () => {
    const refetch = vi.fn();
    state.onPhone = onPhone({ isError: true, queueUnreadable: true, refetch });

    renderContinue();

    expect(rowTitles()).toEqual(["Unable to load work"]);
    expect(within(section()).getByText("Nothing was lost")).toBeTruthy();
    fireEvent.click(within(section()).getByRole("button", { name: "Try Again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("offers no Try Again offline unless the failure is this phone's queue", () => {
    state.isOnline = false;
    state.onPhone = onPhone({ isError: true, queueUnreadable: false });

    renderContinue();

    expect(rowTitles()).toEqual(["Unable to load work"]);
    expect(within(section()).queryByRole("button", { name: "Try Again" })).toBeNull();
  });

  it("shows what it has while another read is still running or has failed", () => {
    state.onPhone = onPhone({
      drafts: [draft("d1", 1_700_000_500_000)],
      isLoading: true,
      isError: true,
    });

    renderContinue();

    expect(rowTitles()).toEqual(["Untitled Draft"]);
    expect(section().getAttribute("aria-busy")).toBeNull();
  });
});
