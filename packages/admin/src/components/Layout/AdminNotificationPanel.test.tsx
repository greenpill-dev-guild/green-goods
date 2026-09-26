import { MemoryRouter } from "react-router-dom";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/__tests__/test-utils";
import pt from "@green-goods/shared/i18n/pt.json";
import { AdminNotificationPanel } from "./AdminNotificationPanel";

const GARDEN_ID = "0x1111111111111111111111111111111111111111";
const mockPermissions = vi.hoisted(() => ({ showCommunity: true, isLoading: false }));
const approvedWork = {
  id: "work-1",
  title: "Harvest & Yield Record - 2026-07-08T12:34:00.000Z",
  status: "approved",
  createdAt: Date.now(),
};
const mockWorks = vi.hoisted(() => ({
  works: [] as Array<{ id: string; title: string; status: string; createdAt: number }>,
  worksComplete: true,
  gardenReviewQueue: undefined as unknown,
}));

vi.mock("@green-goods/shared/hooks/roles/useEffectiveToolbarPermissions", () => ({
  useEffectiveToolbarPermissions: () => mockPermissions,
}));

vi.mock("@green-goods/shared/hooks/garden/useAdminGardenWorkspaceSelection", () => ({
  useAdminGardenWorkspaceSelection: () => ({
    selectedGarden: { id: GARDEN_ID, name: "Chakra Farm", chainId: 11155111 },
  }),
}));

// An empty endowment and one yield allocation: both link into Community.
vi.mock("@green-goods/shared/hooks/garden/useGardenDetailData", () => ({
  useGardenDetailData: () => ({
    garden: { id: GARDEN_ID, domainMask: 1, name: "Chakra Farm", chainId: 11155111 },
    works: mockWorks.works,
    worksComplete: mockWorks.worksComplete,
    gardenReviewQueue: mockWorks.gardenReviewQueue,
    assessments: [],
    hypercerts: [],
    allocations: [
      {
        txHash: "0xallocation",
        timestamp: Date.now(),
        cookieJarAmount: 1n,
        fractionsAmount: 0n,
        juiceboxAmount: 0n,
      },
    ],
    gardenVaults: [{}],
    hasEndowment: false,
    cookieJars: [],
    roleMembers: {
      owner: [],
      steward: [],
      evaluator: [],
      gardener: [],
      funder: [],
      community: [],
    },
  }),
}));

function renderPanel() {
  return renderWithProviders(
    <MemoryRouter>
      <AdminNotificationPanel onCloseSheet={vi.fn()} />
    </MemoryRouter>
  );
}

describe("AdminNotificationPanel", () => {
  beforeEach(() => {
    mockPermissions.showCommunity = true;
    mockPermissions.isLoading = false;
    mockWorks.works = [approvedWork];
    mockWorks.worksComplete = true;
    mockWorks.gardenReviewQueue = undefined;
  });

  it("offers Community alerts and links only to viewers who can open Community", () => {
    mockPermissions.showCommunity = false;
    const evaluator = renderPanel();

    expect(screen.queryByText("Endowment balance is empty.")).not.toBeInTheDocument();
    expect(screen.getByText("Yield allocated").closest("button")).toBeNull();
    evaluator.unmount();

    mockPermissions.showCommunity = true;
    renderPanel();

    expect(
      screen.getByRole("button", { name: /Endowment balance is empty\./ })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Yield allocated/ })).toBeInTheDocument();
  });

  it("shows canonical work activity names in Portuguese", () => {
    renderWithProviders(
      <IntlProvider locale="pt" messages={pt}>
        <MemoryRouter>
          <AdminNotificationPanel onCloseSheet={vi.fn()} />
        </MemoryRouter>
      </IntlProvider>
    );

    expect(screen.getByText("Registro de colheita")).toBeInTheDocument();
    expect(screen.queryByText("Harvest & Yield Record")).not.toBeInTheDocument();
  });

  it("raises a review stall that only the garden's whole queue shows", () => {
    const daysAgo = (days: number) => Math.floor((Date.now() - days * 86_400_000) / 1000);
    // The newest page holds only recent work; the week-old work sits beyond it.
    mockWorks.works = [{ id: "new", title: "Mulching", status: "pending", createdAt: daysAgo(1) }];
    mockWorks.worksComplete = false;
    mockWorks.gardenReviewQueue = {
      lastReviewedAt: daysAgo(9),
      waiting: [
        { id: "old", submittedAt: daysAgo(40) },
        { id: "new", submittedAt: daysAgo(1) },
      ],
    };

    renderPanel();

    expect(
      screen.getByRole("button", { name: /No reviews in 7 days, and 2 works are waiting\./ })
    ).toBeInTheDocument();
  });
});
