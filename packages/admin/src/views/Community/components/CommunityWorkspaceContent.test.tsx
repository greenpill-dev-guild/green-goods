import type { CommunityWorkspace } from "@green-goods/shared/hooks/admin-ui/community/useCommunityWorkspaceController";
import messages from "@green-goods/shared/i18n/en.json";
import { useGardenYieldWiringState } from "@green-goods/shared/hooks/yield/useGardenYieldWiringState";
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

vi.mock("@green-goods/shared/hooks/yield/useGardenYieldWiringState", () => ({
  useGardenYieldWiringState: vi.fn(() => ({})),
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
    <IntlProvider locale="en" messages={messages}>
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
    "endowment",
    "payouts",
  ] as const)("routes %s to its focused tab component", (mode) => {
    renderWorkspace({ mode });
    expect(screen.getByTestId(mode)).toBeInTheDocument();
  });

  it("renders the pooling surface inside Coordination (AD-5)", () => {
    renderWorkspace({ mode: "coordination", communityLoading: true });
    expect(screen.queryByTestId("coordination")).not.toBeInTheDocument();
    expect(screen.getByTestId("pools")).toHaveTextContent("canManage,chainId,garden");
  });
});

describe("Coordination funding status with governance disabled", () => {
  it.each([
    "connected",
    "missing-resolver-wiring",
    "mismatch",
  ] as const)("preserves %s yield status for managers", (status) => {
    vi.mocked(useGardenYieldWiringState).mockReturnValue({
      wiringStatus: status,
      wiringState: { expectedHypercertPoolAddress: baseWorkspace.gardenId },
      repairHref: "/community/coordination?gardenId=" + baseWorkspace.gardenId,
    } as ReturnType<typeof useGardenYieldWiringState>);
    renderWorkspace({
      mode: "coordination",
      pools: [{ poolType: 0, poolAddress: baseWorkspace.gardenId }] as CommunityWorkspace["pools"],
    });
    expect(screen.queryByTestId("coordination")).not.toBeInTheDocument();
    expect(screen.getByTestId("pools")).toBeInTheDocument();
    if (status === "connected") {
      expect(screen.getByText(messages["app.community.yield.connected"])).toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    } else {
      const id =
        status === "mismatch" ? "app.community.yield.mismatch" : "app.community.yield.notConnected";
      expect(screen.getByText(messages[id])).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: messages["app.community.yield.connectAction"] })
      ).toHaveAttribute("href", "/community/coordination?gardenId=" + baseWorkspace.gardenId);
    }
  });
  it("does not advertise a connection from stale wiring data when pools are absent", () => {
    vi.mocked(useGardenYieldWiringState).mockReturnValue({
      wiringStatus: "connected",
    } as ReturnType<typeof useGardenYieldWiringState>);
    renderWorkspace({ mode: "coordination", pools: [], communityLoading: true });
    expect(screen.queryByText(messages["app.community.yield.connected"])).not.toBeInTheDocument();
    expect(screen.getByTestId("pools")).toBeInTheDocument();
    expect(useGardenYieldWiringState).toHaveBeenLastCalledWith(baseWorkspace.gardenId, {
      enabled: false,
    });
  });
});
