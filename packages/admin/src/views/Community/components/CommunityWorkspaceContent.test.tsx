import type { CommunityWorkspace } from "@green-goods/shared/hooks/admin-ui/community/useCommunityWorkspaceController";
import { useGardenYieldWiringState } from "@green-goods/shared/hooks/yield/useGardenYieldWiringState";
import messages from "@green-goods/shared/i18n/en.json";
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CommunityWorkspaceContent } from "./CommunityWorkspaceContent";

vi.mock("@/components/Layout/CanvasRouteState", () => ({
  CanvasRouteErrorState: ({ message }: { message: string }) => <div>error:{message}</div>,
  CanvasWorkspaceLoadingState: () => <div>loading-gate</div>,
  CanvasWorkspaceSelectionGate: () => <div>selection-gate</div>,
}));

vi.mock("./CommunityPools", () => ({
  CommunityPools: (props: { railContent?: ReactNode }) => (
    <>
      <div data-testid="pools">{Object.keys(props).sort().join(",")}</div>
      {props.railContent}
    </>
  ),
}));
vi.mock("./CommunityMembersDialogs", () => ({
  CommunityMembersDialogs: () => <div data-testid="member-dialogs" />,
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
  endowmentByAsset: [],
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
  memberCount: 0,
  memberSearch: "",
  mode: "members",
  pools: [],
  poolsRead: true,
  poolsUnread: false,
  rereadPools: noop,
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

  it("keeps the member dialogs mounted while a tab loads, so an open one survives it (DL-140)", () => {
    renderWorkspace({ mode: "endowment", vaultsLoading: true });

    expect(screen.getByText("loading:endowment")).toBeInTheDocument();
    expect(screen.getByTestId("member-dialogs")).toBeInTheDocument();
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
  it("keeps the yield wiring check while the pool list is unread, since it reads on its own", () => {
    vi.mocked(useGardenYieldWiringState).mockReturnValue({
      wiringStatus: "missing-resolver-wiring",
    } as ReturnType<typeof useGardenYieldWiringState>);
    renderWorkspace({ mode: "coordination", pools: [], poolsRead: false, poolsUnread: true });
    expect(useGardenYieldWiringState).toHaveBeenLastCalledWith(baseWorkspace.gardenId, {
      enabled: true,
    });
    expect(screen.getByText(messages["app.community.yield.notConnected"])).toBeInTheDocument();
    // The wiring check answered, so an error about it would contradict the answer.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows no read error when the wiring check answered connected, though the pool list is unread", () => {
    vi.mocked(useGardenYieldWiringState).mockReturnValue({
      wiringStatus: "connected",
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGardenYieldWiringState>);
    renderWorkspace({ mode: "coordination", pools: [], poolsRead: false, poolsUnread: true });

    expect(screen.getByText(messages["app.community.yield.connected"])).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("offers a retry outside the governance tab when the pool list and the wiring check both fail", () => {
    const rereadPools = vi.fn();
    const refetch = vi.fn();
    vi.mocked(useGardenYieldWiringState).mockReturnValue({
      wiringStatus: undefined,
      refetch,
    } as unknown as ReturnType<typeof useGardenYieldWiringState>);
    renderWorkspace({
      mode: "coordination",
      pools: [],
      poolsRead: false,
      poolsUnread: true,
      rereadPools,
    });

    expect(screen.queryByTestId("coordination")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      messages["hub.community.yield.readError.title"]
    );
    fireEvent.click(screen.getByRole("button", { name: messages["app.common.retry"] }));
    expect(rereadPools).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("rereads only the pool list when no community is known, since the wiring check is off", () => {
    const rereadPools = vi.fn();
    const refetch = vi.fn();
    vi.mocked(useGardenYieldWiringState).mockReturnValue({
      wiringStatus: undefined,
      refetch,
    } as unknown as ReturnType<typeof useGardenYieldWiringState>);
    renderWorkspace({
      mode: "coordination",
      community: null,
      pools: [],
      poolsRead: false,
      poolsUnread: true,
      rereadPools,
    } as unknown as Partial<CommunityWorkspace>);

    fireEvent.click(screen.getByRole("button", { name: messages["app.common.retry"] }));
    expect(rereadPools).toHaveBeenCalledTimes(1);
    expect(refetch).not.toHaveBeenCalled();
  });

  it("waits for the first wiring read before showing the read error", () => {
    vi.mocked(useGardenYieldWiringState).mockReturnValue({
      wiringStatus: undefined,
      isPending: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGardenYieldWiringState>);
    renderWorkspace({ mode: "coordination", pools: [], poolsRead: false, poolsUnread: true });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
