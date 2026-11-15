/**
 * @vitest-environment happy-dom
 */

import type { HubOlderRecords } from "@green-goods/shared/hooks/admin-ui/hub/hub.workbenchModel";
import type { Address, Work } from "@green-goods/shared/types/domain";
import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders as renderWithIntl } from "../test-utils";

const { mockUseEnsName, mockUseGreenGoodsEnsName } = vi.hoisted(() => ({
  mockUseEnsName: vi.fn(),
  mockUseGreenGoodsEnsName: vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: (address: Address | null | undefined) => mockUseEnsName(address),
}));
vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: (address: Address | null | undefined) => mockUseGreenGoodsEnsName(address),
}));

import { HubHypercertList } from "@/views/Hub/components/HubRecordLists";
import { HubWorkQueue } from "@/views/Hub/components/HubWorkQueue";

const TEST_WORK: Work = {
  id: "0xWork",
  title: "Compost setup",
  actionUID: 1,
  gardenerAddress: "0x1234567890abcdef1234567890abcdef12345678" as Address,
  gardenAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
  feedback: "",
  metadata: "{}",
  media: [],
  createdAt: 1_700_000_000,
  status: "pending",
};

describe("Hub queue ENS display", () => {
  beforeEach(() => {
    mockUseEnsName.mockReset();
    mockUseEnsName.mockReturnValue({ data: "river.greengoods.eth" });
    mockUseGreenGoodsEnsName.mockReset();
    mockUseGreenGoodsEnsName.mockReturnValue({ data: null });
  });

  it("uses ENS display names in the work queue description", () => {
    renderWithIntl(
      <HubWorkQueue
        items={[TEST_WORK]}
        scope="pending"
        worksLoading={false}
        hasDataError={false}
        normalizedSearch=""
        debouncedSearch=""
        actionsMap={new Map([[1, { title: "Compost" }]])}
        selectedWorkId={undefined}
        onOpenWorkDetail={vi.fn()}
        onClearSearch={vi.fn()}
      />
    );

    // The queue search matches on the action title, so the card has to show it
    // — a hover-only title leaves a search hit with no visible matching text.
    const card = screen.getByRole("button", { name: /Compost setup/ });
    expect(within(card).getByText("Compost")).toBeInTheDocument();
    expect(screen.getByText("river")).toBeInTheDocument();
  });

  it("prefers the submitter's protocol name in the work queue", () => {
    mockUseEnsName.mockReturnValue({ data: "other.eth" });
    mockUseGreenGoodsEnsName.mockReturnValue({ data: "river.greengoods.eth" });
    renderWithIntl(
      <HubWorkQueue
        items={[TEST_WORK]}
        scope="pending"
        worksLoading={false}
        hasDataError={false}
        normalizedSearch=""
        debouncedSearch=""
        actionsMap={new Map([[1, { title: "Compost" }]])}
        selectedWorkId={undefined}
        onOpenWorkDetail={vi.fn()}
        onClearSearch={vi.fn()}
      />
    );

    expect(screen.getByText("river")).toBeInTheDocument();
    expect(screen.queryByText("other.eth")).not.toBeInTheDocument();
    expect(mockUseGreenGoodsEnsName).toHaveBeenCalledWith(TEST_WORK.gardenerAddress);
  });
});

describe("Hub work queue scopes", () => {
  const renderQueue = (scope: "pending" | "approved", items: Work[]) =>
    renderWithIntl(
      <HubWorkQueue
        items={items}
        scope={scope}
        worksLoading={false}
        hasDataError={false}
        normalizedSearch=""
        debouncedSearch=""
        actionsMap={new Map()}
        selectedWorkId={undefined}
        onOpenWorkDetail={vi.fn()}
        onClearSearch={vi.fn()}
      />
    );

  beforeEach(() => {
    mockUseEnsName.mockReturnValue({ data: null });
    mockUseGreenGoodsEnsName.mockReturnValue({ data: null });
  });

  it.each([
    { scope: "pending", title: "All caught up" },
    { scope: "approved", title: "No approved work yet" },
  ] as const)("says what an empty $scope scope holds", ({ scope, title }) => {
    renderQueue(scope, []);

    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it("marks an approved work Approved, with no Pending chip", () => {
    renderQueue("approved", [{ ...TEST_WORK, status: "approved" }]);

    const card = screen.getByRole("button", { name: /Compost setup/ });
    expect(within(card).getByText("Approved")).toBeInTheDocument();
    expect(within(card).queryByText("Pending")).not.toBeInTheDocument();
  });
});

describe("Hub work queue on a phone", () => {
  const phone = (query: string) => ({
    matches: query === "(max-width: 599px)",
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });

  beforeEach(() => {
    mockUseEnsName.mockReturnValue({ data: "river.greengoods.eth" });
    mockUseGreenGoodsEnsName.mockReturnValue({ data: null });
    vi.mocked(window.matchMedia).mockImplementation(phone as unknown as typeof window.matchMedia);
  });

  afterEach(() => {
    vi.mocked(window.matchMedia).mockImplementation(((query: string) => ({
      ...phone(query),
      matches: false,
    })) as unknown as typeof window.matchMedia);
  });

  it("lists the queue as work rows that open the work: a neutral Pending, who, then the age", () => {
    const onOpenWorkDetail = vi.fn();
    renderWithIntl(
      <HubWorkQueue
        items={[TEST_WORK]}
        scope="pending"
        worksLoading={false}
        hasDataError={false}
        normalizedSearch=""
        debouncedSearch=""
        actionsMap={new Map([[1, { title: "Compost" }]])}
        selectedWorkId={undefined}
        onOpenWorkDetail={onOpenWorkDetail}
        onClearSearch={vi.fn()}
      />
    );

    const row = screen.getByRole("button", { name: /Compost setup/ });
    expect(row).toHaveAttribute("data-component", "WorkCard");
    expect(within(row).getByRole("status")).toHaveTextContent("Pending");
    expect(within(row).getByText("river")).toBeInTheDocument();
    expect(row.querySelector("time")).toHaveAttribute("datetime", "2023-11-14T22:13:20.000Z");
    fireEvent.click(row);
    expect(onOpenWorkDetail).toHaveBeenCalledWith(TEST_WORK.id);
  });

  it("holds the rows' frame while the queue loads", () => {
    renderWithIntl(
      <HubWorkQueue
        items={[]}
        scope="pending"
        worksLoading
        hasDataError={false}
        normalizedSearch=""
        debouncedSearch=""
        actionsMap={new Map()}
        selectedWorkId={undefined}
        onOpenWorkDetail={vi.fn()}
        onClearSearch={vi.fn()}
      />
    );

    expect(screen.getByRole("list")).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll('[data-skeleton="item-row"]')).toHaveLength(5);
  });
});

// F12: from the cockpit's desktop breakpoint the work card lies wide and the
// grid takes the wide column rule; from 600px to 1023px the card stays stacked,
// and below 600px the queue lists work rows (above).
describe("Hub work queue layout", () => {
  const originalMatchMedia = window.matchMedia;

  const atWidth = (width: number) => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches:
        (query === "(min-width: 1024px)" && width >= 1024) ||
        (query === "(max-width: 599px)" && width < 600),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  };

  const renderQueue = (worksLoading = false) =>
    renderWithIntl(
      <HubWorkQueue
        items={worksLoading ? [] : [TEST_WORK]}
        scope="pending"
        worksLoading={worksLoading}
        hasDataError={false}
        normalizedSearch=""
        debouncedSearch=""
        actionsMap={new Map()}
        selectedWorkId={undefined}
        onOpenWorkDetail={vi.fn()}
        onClearSearch={vi.fn()}
      />
    );

  beforeEach(() => {
    mockUseEnsName.mockReturnValue({ data: null });
    mockUseGreenGoodsEnsName.mockReturnValue({ data: null });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it.each([
    { width: 1280, layout: "wide" },
    { width: 1024, layout: "wide" },
    { width: 768, layout: "stacked" },
    { width: 600, layout: "stacked" },
  ])("lays each card $layout at $width px, and the grid with it", ({ width, layout }) => {
    atWidth(width);
    renderQueue();

    expect(screen.getByRole("list")).toHaveAttribute("data-card-layout", layout);
    expect(screen.getByRole("button", { name: /Compost setup/ })).toHaveAttribute(
      "data-layout",
      layout
    );
  });

  it("loads in the shape it will take, so the queue does not jump", () => {
    atWidth(1280);
    renderQueue(true);

    expect(screen.getByRole("list")).toHaveAttribute("data-card-layout", "wide");
  });
});

// PRD-1086: a list holds the garden's newest page, so while the garden has
// more, the list says so and reads the next page on request.
describe("Hub lists with older records", () => {
  const olderPage = () => ({ onShowOlder: vi.fn(), isLoading: false });
  const renderQueue = (
    items: Work[],
    older: HubOlderRecords,
    {
      scope = "pending",
      search = "",
      failed = false,
    }: { scope?: "pending" | "approved"; search?: string; failed?: boolean } = {}
  ) =>
    renderWithIntl(
      <HubWorkQueue
        items={items}
        scope={scope}
        worksLoading={false}
        hasDataError={failed}
        normalizedSearch={search}
        debouncedSearch={search}
        actionsMap={new Map()}
        selectedWorkId={undefined}
        onOpenWorkDetail={vi.fn()}
        onClearSearch={vi.fn()}
        older={older}
      />
    );

  beforeEach(() => {
    mockUseEnsName.mockReturnValue({ data: null });
    mockUseGreenGoodsEnsName.mockReturnValue({ data: null });
  });

  it("reads the garden's older work from under the list", () => {
    const older = olderPage();
    renderQueue([TEST_WORK], older);

    fireEvent.click(screen.getByRole("button", { name: "Show Older Work" }));
    expect(older.onShowOlder).toHaveBeenCalledTimes(1);
  });

  it("says older work isn't loaded where no page can be read, as offline, without a button", () => {
    renderQueue([TEST_WORK], { isLoading: false });

    expect(screen.getByText("Older work isn't loaded yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show Older Work" })).not.toBeInTheDocument();
  });

  it("keeps loaded work and offers to retry a failed read", () => {
    const older = olderPage();
    renderQueue([TEST_WORK], older, { failed: true });

    expect(screen.getByText("Review data could not be loaded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Compost setup/ })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show Older Work" }));
    expect(older.onShowOlder).toHaveBeenCalledTimes(1);
  });

  it("keeps the empty error state when no work has loaded", () => {
    renderQueue([], olderPage(), { failed: true });

    expect(screen.getByText("Review data could not be loaded")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show Older Work" })).toBeInTheDocument();
  });

  // "All caught up" would be false: the pending work may be older than the page.
  it.each([
    { scope: "pending", title: "Nothing pending in recent work", settled: "All caught up" },
    {
      scope: "approved",
      title: "Nothing approved in recent work",
      settled: "No approved work yet",
    },
  ] as const)("does not call an empty $scope scope settled while older work is unread", ({
    scope,
    title,
    settled,
  }) => {
    renderQueue([], olderPage(), { scope });

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText("Older work isn't loaded yet.")).toBeInTheDocument();
    expect(screen.queryByText(settled)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show Older Work" })).toBeInTheDocument();
  });

  it("offers older work beside Clear Search when the loaded work matches nothing", () => {
    renderQueue([], olderPage(), { search: "compost" });

    expect(screen.getByText('No submissions matching "compost"')).toBeInTheDocument();
    expect(screen.getByText("Older work isn't loaded yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show Older Work" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear Search" })).toBeInTheDocument();
  });

  it("reads the garden's older hypercerts from under the list, and from a search that misses", () => {
    const older = olderPage();
    const hypercert = {
      id: "42161-1",
      title: "Spring planting",
      description: "",
      workScopes: [],
      mintedAt: 1_700_000_000,
      attestationCount: 3,
    };
    const list = (items: (typeof hypercert)[], searchQuery = "") => (
      <HubHypercertList
        items={items}
        isLoading={false}
        hasDataError={false}
        searchQuery={searchQuery}
        onClearSearch={vi.fn()}
        onOpenHypercert={vi.fn()}
        older={older}
      />
    );
    const view = renderWithIntl(list([hypercert]));

    fireEvent.click(screen.getByRole("button", { name: "Show Older Hypercerts" }));
    expect(older.onShowOlder).toHaveBeenCalledTimes(1);

    view.rerender(list([], "autumn"));
    expect(screen.getByText("Older hypercerts aren't loaded yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show Older Hypercerts" })).toBeInTheDocument();
  });
});
