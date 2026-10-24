/**
 * @vitest-environment happy-dom
 */

import enMessages from "@green-goods/shared/i18n/en.json";
import type { Address, Work } from "@green-goods/shared/types/domain";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <IntlProvider locale="en" messages={enMessages}>
      {ui}
    </IntlProvider>
  );
}

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
