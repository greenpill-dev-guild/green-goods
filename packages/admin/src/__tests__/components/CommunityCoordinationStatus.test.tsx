import { useGardenYieldWiringState } from "@green-goods/shared/hooks/yield/useGardenYieldWiringState";
import type { Address } from "@green-goods/shared/types/domain";
import { PoolType } from "@green-goods/shared/types/gardens-community";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/__tests__/test-utils";
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
  promise: Promise.resolve(connectedWiringState),
  wiringStatus: "connected",
  wiringState: connectedWiringState,
  repairHref: undefined,
};

describe("Community coordination status actions", () => {
  beforeEach(() => {
    vi.mocked(useGardenYieldWiringState).mockReturnValue(connectedWiringResult);
  });

  it("aligns connected yield status and Manage Strategies to one compact row", () => {
    renderWithProviders(
      <IntlProvider
        locale="en"
        messages={{
          "app.actions.view": "View",
          "app.community.poolType.action": "Action signaling",
          "app.community.poolType.hypercert": "Hypercert curation",
          "app.community.statusConnected": "Connected",
          "app.community.yield.connected": "Yield connected",
          "app.conviction.manageStrategies": "Manage Strategies",
          "cockpit.community.coordination.community": "Community",
          "cockpit.community.coordination.proposals": "Registered proposals",
          "cockpit.community.coordination.proposalsDescription": "Proposal review",
          "cockpit.community.coordination.status": "Pool status",
        }}
      >
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
                poolType: PoolType.Hypercert,
                poolAddress: HYPERCERT_POOL,
                gardenAddress: GARDEN_ID,
                communityAddress: GARDEN_ID,
              },
              {
                poolType: PoolType.Action,
                poolAddress: ACTION_POOL,
                gardenAddress: GARDEN_ID,
                communityAddress: GARDEN_ID,
              },
            ]}
            createPools={noop}
            isCreatingPools={false}
          />
        </MemoryRouter>
      </IntlProvider>
    );

    const connectedStatus = screen.getByText("Yield connected");
    const manageStrategies = screen.getByRole("link", { name: /Manage Strategies/i });
    const actionRow = connectedStatus.parentElement;

    expect(actionRow).toBe(manageStrategies.parentElement);
    expect(actionRow).toHaveClass("flex", "items-center", "gap-2");
    expect(connectedStatus).toHaveClass("h-7", "items-center");
    expect(manageStrategies).toHaveClass("h-7");
    expect(manageStrategies).not.toHaveClass("h-auto");
  });
});
