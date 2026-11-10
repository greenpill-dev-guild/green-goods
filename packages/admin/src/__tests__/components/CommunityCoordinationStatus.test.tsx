import { useGardenYieldWiringState } from "@green-goods/shared/hooks/yield/useGardenYieldWiringState";
import type { Address } from "@green-goods/shared/types/domain";
import { PoolType } from "@green-goods/shared/types/gardens-community";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen } from "@/__tests__/test-utils";
import { CommunityCoordinationTab } from "@/views/Community/components/CommunityCoordinationTab";
import type { CommunityCoordinationTabProps } from "@/views/Community/components/CommunityCoordinationTab";

vi.mock("@green-goods/shared/hooks/yield/useGardenYieldWiringState", () => ({
  useGardenYieldWiringState: vi.fn(),
}));

vi.mock("@/views/Community/components/GovernancePanel", () => ({
  GovernancePanel: () => null,
}));

const GARDEN_ID: Address = "0x1111111111111111111111111111111111111111";
const HYPERCERT_POOL: Address = "0x2222222222222222222222222222222222222222";
const ACTION_POOL: Address = "0x3333333333333333333333333333333333333333";
const noop = vi.fn();
const connectedWiringState = {
  readStatus: "available" as const,
  status: "connected" as const,
  gardenAddress: GARDEN_ID,
  expectedHypercertPoolAddress: HYPERCERT_POOL,
  resolverHypercertPoolAddress: HYPERCERT_POOL,
  canRepairFromCommunity: false,
  issues: [],
};
const connectedWiringResult: ReturnType<typeof useGardenYieldWiringState> = {
  data: connectedWiringState,
  dataUpdatedAt: 0,
  error: null,
  errorUpdatedAt: 0,
  failureCount: 0,
  failureReason: null,
  errorUpdateCount: 0,
  isError: false,
  isFetched: true,
  isFetchedAfterMount: true,
  isFetching: false,
  isLoading: false,
  isPending: false,
  isLoadingError: false,
  isInitialLoading: false,
  isPaused: false,
  isPlaceholderData: false,
  isRefetchError: false,
  isRefetching: false,
  isStale: false,
  isSuccess: true,
  isEnabled: true,
  refetch: vi.fn(),
  status: "success",
  fetchStatus: "idle",
  wiringStatus: "connected",
  wiringState: connectedWiringState,
  repairHref: undefined,
};

const MESSAGES = {
  "app.actions.view": "View",
  "app.common.retry": "Retry",
  "app.community.createPools": "Create Pools",
  "app.community.poolType.action": "Action signaling",
  "app.community.poolType.hypercert": "Hypercert curation",
  "app.community.statusConnected": "Connected",
  "app.community.yield.connected": "Yield connected",
  "app.conviction.loadError.description": "Please try again.",
  "app.conviction.loadError.title": "Failed to load conviction data",
  "app.conviction.manageStrategies": "Manage Strategies",
  "cockpit.community.coordination.community": "Community",
  "cockpit.community.coordination.poolMissing": "Not deployed",
  "cockpit.community.coordination.proposals": "Registered proposals",
  "cockpit.community.coordination.proposalsDescription": "Proposal review",
  "cockpit.community.coordination.status": "Pool status",
};

function renderTab(props: Partial<CommunityCoordinationTabProps> = {}) {
  return renderWithProviders(
    <IntlProvider locale="en" messages={MESSAGES}>
      <MemoryRouter>
        <CommunityCoordinationTab
          garden={
            {
              id: GARDEN_ID,
              name: "Test garden",
              chainId: 42161,
            } as CommunityCoordinationTabProps["garden"]
          }
          gardenId={GARDEN_ID}
          canManage={true}
          community={{} as CommunityCoordinationTabProps["community"]}
          pools={[
            {
              poolType: PoolType.HypercertSignal,
              poolAddress: HYPERCERT_POOL,
              gardenAddress: GARDEN_ID,
              communityAddress: GARDEN_ID,
            },
            {
              poolType: PoolType.ActionSignal,
              poolAddress: ACTION_POOL,
              gardenAddress: GARDEN_ID,
              communityAddress: GARDEN_ID,
            },
          ]}
          poolsRead={true}
          poolsUnread={false}
          rereadPools={noop}
          createPools={noop}
          isCreatingPools={false}
          {...props}
        />
      </MemoryRouter>
    </IntlProvider>
  );
}

describe("Community coordination status actions", () => {
  beforeEach(() => {
    vi.mocked(useGardenYieldWiringState).mockReturnValue(connectedWiringResult);
  });

  it("keeps Manage Strategies compact and leaves the yield status to CommunityYieldStatus", () => {
    renderTab();

    const manageStrategies = screen.getByRole("link", { name: /Manage Strategies/i });

    expect(manageStrategies.parentElement).toHaveClass("flex", "items-center", "gap-2");
    expect(manageStrategies).toHaveAttribute("data-size", "compact");
    expect(manageStrategies).not.toHaveClass("h-auto");
    // Yield wiring moved to CommunityYieldStatus so it stays visible while
    // governance is hidden (PRD-917). The hook still reports "connected" here,
    // so a status pill returning to this tab would fail this assertion.
    expect(screen.queryByText("Yield connected")).not.toBeInTheDocument();
  });

  it("holds back missing pools and creation, and offers a retry, while the pool list is unread", () => {
    const rereadPools = vi.fn();
    renderTab({ pools: [], poolsRead: false, poolsUnread: true, rereadPools });

    expect(screen.queryByRole("button", { name: "Create Pools" })).toBeNull();
    expect(screen.queryByText("Not deployed")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(rereadPools).toHaveBeenCalledTimes(1);
  });

  it("offers to create pools once the list is read and holds none", () => {
    renderTab({ pools: [] });

    expect(screen.getAllByText("Not deployed")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Create Pools" })).toBeInTheDocument();
  });
});
