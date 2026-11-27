import { MemoryRouter } from "react-router-dom";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen } from "@/__tests__/test-utils";
import pt from "@green-goods/shared/i18n/pt.json";
import { AdminNotificationPanel } from "./AdminNotificationPanel";

const mockActions = vi.hoisted(() => vi.fn());
vi.mock("@green-goods/shared/hooks/action/useAction", () => ({ useActionsByUID: mockActions }));
const GARDEN_ID = "0x1111111111111111111111111111111111111111";
const mockPermissions = vi.hoisted(() => ({ showCommunity: true, isLoading: false }));
const approvedWork = {
  id: "work-1",
  title: "Harvest & Yield Record - 2026-07-08T12:34:00.000Z",
  actionUID: 7,
  status: "approved",
  createdAt: Date.now(),
};
const mockWorks = vi.hoisted(() => ({
  works: [] as Array<{
    id: string;
    title: string;
    status: string;
    createdAt: number;
    actionUID?: number;
  }>,
  worksComplete: true,
  gardenReviewQueue: undefined as unknown,
}));

// The Hub bell's changes (PRD-1536): what changed since this device last showed the sheet.
const mockHub = vi.hoisted(() => ({
  changes: [] as unknown[],
  canManage: true,
  joinRequestsWaiting: undefined as number | undefined,
  markSeen: vi.fn(),
  retry: vi.fn(),
  isLoading: false,
  isError: false,
}));
vi.mock("@green-goods/shared/hooks/garden/useGardenNotifications", () => ({
  useHubGardenChanges: () => mockHub,
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
    mockActions.mockReturnValue([
      { id: "11155111-7", slug: "agro.harvest_yield", title: "Harvest & Yield Record", inputs: [] },
    ]);
    mockPermissions.showCommunity = true;
    mockPermissions.isLoading = false;
    mockWorks.works = [approvedWork];
    mockWorks.worksComplete = true;
    mockWorks.gardenReviewQueue = undefined;
    mockHub.changes = [];
    mockHub.canManage = true;
    mockHub.joinRequestsWaiting = undefined;
    mockHub.markSeen.mockClear();
    mockHub.retry.mockClear();
    mockHub.isError = false;
  });

  it("offers Community alerts and links only to viewers who can open Community", () => {
    mockPermissions.showCommunity = false;
    const evaluator = renderPanel();

    expect(screen.queryByText("Endowment balance is empty.")).not.toBeInTheDocument();
    evaluator.unmount();

    mockPermissions.showCommunity = true;
    renderPanel();

    expect(
      screen.getByRole("button", { name: /Endowment balance is empty\./ })
    ).toBeInTheDocument();
  });

  it.each([
    approvedWork.title,
    "Action 7",
    "Unknown Action - 2026-07-08T12:34:00.000Z",
  ])("names a decided work by its action in Portuguese from %s", (title) => {
    mockHub.changes = [
      {
        kind: "workDecided",
        id: "decision:d-1",
        at: Math.floor(Date.now() / 1000),
        isNew: true,
        approved: true,
        by: "0x2222222222222222222222222222222222222222",
        work: { ...approvedWork, title, gardenerAddress: GARDEN_ID, media: [] },
      },
    ];
    renderWithProviders(
      <IntlProvider locale="pt" messages={pt}>
        <MemoryRouter>
          <AdminNotificationPanel onCloseSheet={vi.fn()} />
        </MemoryRouter>
      </IntlProvider>
    );

    expect(mockActions).toHaveBeenCalledWith([7], 11155111);
    expect(screen.getByText(/aprovou Registro de colheita/)).toBeInTheDocument();
    expect(screen.queryByText(/Harvest & Yield Record/)).not.toBeInTheDocument();
  });

  it("lists what changed since this device's last visit, and counts it seen once the sheet closes", () => {
    const at = Math.floor(Date.now() / 1000);
    mockHub.changes = [
      {
        kind: "joined",
        id: "role:r1",
        at,
        isNew: true,
        account: "0x3333333333333333333333333333333333333333",
        role: "gardener",
      },
      // Shown on an earlier visit: it stays out.
      {
        kind: "roleGranted",
        id: "role:r0",
        at: at - 60,
        isNew: false,
        account: "0x3333333333333333333333333333333333333333",
        role: "evaluator",
      },
    ];
    const panel = renderPanel();

    expect(screen.getByText("Since your last visit")).toBeInTheDocument();
    expect(screen.getByText(/joined as Gardener/)).toBeInTheDocument();
    expect(screen.queryByText(/Evaluator role/)).not.toBeInTheDocument();
    panel.unmount();
    expect(mockHub.markSeen).toHaveBeenCalledWith([expect.objectContaining({ id: "role:r1" })]);
  });

  it("counts nothing as seen that a still-loading sheet never showed", () => {
    mockHub.changes = [
      {
        kind: "joined",
        id: "role:r1",
        at: Math.floor(Date.now() / 1000),
        isNew: true,
        account: "0x3333333333333333333333333333333333333333",
        role: "gardener",
      },
    ];
    mockHub.isLoading = true;
    const panel = renderPanel();
    panel.unmount();
    expect(mockHub.markSeen).toHaveBeenCalledWith([]);
    mockHub.isLoading = false;
  });

  it("says when a change could not be read, never that nothing changed, and reads it again", () => {
    mockWorks.works = [];
    mockHub.isError = true;
    renderPanel();

    expect(screen.queryByText("No notifications")).not.toBeInTheDocument();
    // The whole row is the button.
    fireEvent.click(screen.getByRole("button", { name: /Some changes could not be read/ }));
    expect(mockHub.retry).toHaveBeenCalledTimes(1);
  });

  it("counts join requests and long waits, each opening its filtered list, only for who can act", () => {
    const daysAgo = (days: number) => Math.floor((Date.now() - days * 86_400_000) / 1000);
    mockHub.joinRequestsWaiting = 3;
    mockWorks.gardenReviewQueue = {
      lastReviewedAt: daysAgo(1),
      waiting: [
        { id: "a", submittedAt: daysAgo(10) },
        { id: "b", submittedAt: daysAgo(20) },
      ],
    };
    const steward = renderPanel();

    expect(screen.getByRole("button", { name: /3 people are asking to join/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /1 work has waited 1 to 2 weeks/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /1 work has waited over 2 weeks/ })
    ).toBeInTheDocument();
    steward.unmount();

    mockHub.canManage = false;
    renderPanel();
    expect(screen.queryByText(/asking to join/)).not.toBeInTheDocument();
    expect(screen.queryByText(/waited/)).not.toBeInTheDocument();
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
