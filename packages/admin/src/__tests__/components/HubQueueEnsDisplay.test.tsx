/**
 * @vitest-environment jsdom
 */

import type { Address, Work } from "@green-goods/shared";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import enMessages from "@green-goods/shared/i18n/en.json";

const { mockUseEnsName } = vi.hoisted(() => ({
  mockUseEnsName: vi.fn(),
}));

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  return {
    ...actual,
    useEnsName: (address: Address | null | undefined) => mockUseEnsName(address),
  };
});

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

    expect(screen.getByText("Compost · river")).toBeInTheDocument();
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

    expect(screen.getByText("Compost · river")).toBeInTheDocument();
  });
});
