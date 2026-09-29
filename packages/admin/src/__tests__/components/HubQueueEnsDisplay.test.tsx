/**
 * @vitest-environment jsdom
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

import { HubAssessmentQueue } from "@/views/Hub/components/HubAssessmentQueue";
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

  it("uses ENS display names in the assessment queue description", () => {
    renderWithIntl(
      <HubAssessmentQueue
        items={[TEST_WORK]}
        worksLoading={false}
        hasDataError={false}
        actionsMap={new Map([[1, { title: "Compost" }]])}
        selectedWorkId={undefined}
        onOpenWorkDetail={vi.fn()}
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

  it("prefers the submitter's protocol name in the assessment queue", () => {
    mockUseEnsName.mockReturnValue({ data: "other.eth" });
    mockUseGreenGoodsEnsName.mockReturnValue({ data: "forest.greengoods.eth" });
    renderWithIntl(
      <HubAssessmentQueue
        items={[TEST_WORK]}
        worksLoading={false}
        hasDataError={false}
        actionsMap={new Map([[1, { title: "Compost" }]])}
        selectedWorkId={undefined}
        onOpenWorkDetail={vi.fn()}
      />
    );

    expect(screen.getByText("forest")).toBeInTheDocument();
    expect(screen.queryByText("other.eth")).not.toBeInTheDocument();
    expect(mockUseGreenGoodsEnsName).toHaveBeenCalledWith(TEST_WORK.gardenerAddress);
  });
});
