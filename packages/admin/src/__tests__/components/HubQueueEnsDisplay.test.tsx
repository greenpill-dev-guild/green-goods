/**
 * @vitest-environment happy-dom
 */

import enMessages from "@green-goods/shared/i18n/en.json";
import type { Address, Work } from "@green-goods/shared/types/domain";
import { render, screen, within } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
