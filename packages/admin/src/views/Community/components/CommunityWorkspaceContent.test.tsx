import type { CommunityWorkspace } from "@green-goods/shared/hooks/admin-ui/community/useCommunityWorkspaceController";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommunityWorkspaceContent } from "./CommunityWorkspaceContent";

vi.mock("@/components/Layout/CanvasRouteState", () => ({
  CanvasRouteErrorState: ({ message }: { message: string }) => <div>error:{message}</div>,
  CanvasWorkspaceLoadingState: () => <div>loading-gate</div>,
  CanvasWorkspaceSelectionGate: () => <div>selection-gate</div>,
}));

vi.mock("./CommunityPools", () => ({
  CommunityPools: (props: object) => (
    <div data-testid="pools">{Object.keys(props).sort().join(",")}</div>
  ),
}));
vi.mock("./CommunityMembersTab", () => ({
  CommunityMembersTab: (props: object) => (
    <div data-testid="members">{Object.keys(props).sort().join(",")}</div>
  ),
}));
vi.mock("./CommunityCoordinationTab", () => ({
  CommunityCoordinationTab: (props: object) => (
    <div data-testid="coordination">{Object.keys(props).sort().join(",")}</div>
  ),
}));
vi.mock("./CommunityEndowmentTab", () => ({
  CommunityEndowmentTab: (props: object) => (
    <div data-testid="endowment">{Object.keys(props).sort().join(",")}</div>
  ),
}));
vi.mock("./CommunityPayoutsTab", () => ({
  CommunityPayoutsTab: (props: object) => (
    <div data-testid="payouts">{Object.keys(props).sort().join(",")}</div>
  ),
}));
vi.mock("./CommunityTabSkeleton", () => ({
  CommunityTabSkeleton: ({ mode }: { mode: string }) => <div>loading:{mode}</div>,
}));

const noop = vi.fn();
const baseWorkspace = {
  allocations: [],
  allocationsLoading: false,
  canManage: true,
  clearSection: noop,
  closeMembersModal: noop,
  community: {},
  communityLoading: false,
  createPools: noop,
  error: null,
  fetching: false,
  garden: {
    id: "0x1111111111111111111111111111111111111111",
    name: "Test garden",
    chainId: 42161,
  },
  gardenId: "0x1111111111111111111111111111111111111111",
  gardenOptions: [],
  handleSelectGarden: noop,
  hasVaults: false,
  isCreatingPools: false,
  memberSearch: "",
  mode: "members",
  pools: [],
  roleMembers: {
    gardener: [],
    operator: [],
    evaluator: [],
    owner: [],
    funder: [],
    community: [],
  },
  roleSummary: [],
  scheduleBackgroundRefetch: noop,
  selectedGarden: { id: "0x1111111111111111111111111111111111111111", name: "Test garden" },
  selectedItem: null,
  setMemberSearch: noop,
  treasurySeverity: "none",
  vaultNetDeposited: 0n,
  vaultsLoading: false,
  visibleDirectory: [],
} as unknown as CommunityWorkspace;

function renderWorkspace(overrides: Partial<CommunityWorkspace> = {}) {
  render(
    <IntlProvider locale="en" messages={{}}>
      <MemoryRouter>
        <CommunityWorkspaceContent workspace={{ ...baseWorkspace, ...overrides }} />
      </MemoryRouter>
    </IntlProvider>
  );
}

describe("CommunityWorkspaceContent", () => {
  it("renders selection, loading, and error gates in order", () => {
    renderWorkspace({ selectedGarden: null });
    expect(screen.getByText("selection-gate")).toBeInTheDocument();

    renderWorkspace({ fetching: true });
    expect(screen.getByText("loading-gate")).toBeInTheDocument();

    renderWorkspace({ garden: undefined, error: new Error("offline") });
    expect(screen.getByText("error:offline")).toBeInTheDocument();

    renderWorkspace({ communityLoading: true });
    expect(screen.getByText("loading:members")).toBeInTheDocument();
  });

  it.each([
    "members",
    "coordination",
    "endowment",
    "payouts",
  ] as const)("routes %s to its focused tab component", (mode) => {
    renderWorkspace({ mode });
    expect(screen.getByTestId(mode)).toBeInTheDocument();
  });

  it("keeps pools on its dedicated composition", () => {
    renderWorkspace({ mode: "pools" });
    expect(screen.getByTestId("pools")).toHaveTextContent("canManage,chainId,garden");
  });
});
