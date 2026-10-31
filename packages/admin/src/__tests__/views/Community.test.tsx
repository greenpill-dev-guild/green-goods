import type { CommunityWorkspace } from "@green-goods/shared/hooks/admin-ui/community/useCommunityWorkspaceController";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, renderWithProviders, screen, within } from "../test-utils";
import CommunityView from "@/views/Community";

const GARDEN = "0x1111111111111111111111111111111111111111" as const;
const mocks = vi.hoisted(() => ({
  workspace: null as CommunityWorkspace | null,
  protocolGarden: false,
  changeMode: vi.fn(),
  identity: vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/admin-ui/community/useCommunityWorkspaceController", () => ({
  useCommunityWorkspaceController: () => mocks.workspace,
}));
vi.mock("@green-goods/shared/hooks/commitment-pooling/useProtocolPool", () => ({
  useIsProtocolGarden: (input: unknown) => {
    mocks.identity(input);
    return { isProtocolGarden: mocks.protocolGarden };
  },
}));
vi.mock("@/views/Community/components/CommunitySheetDescriptor", () => ({
  CommunitySheetDescriptor: () => null,
}));
vi.mock("@/views/Community/components/CommunityWorkspaceContent", () => ({
  CommunityWorkspaceContent: () => null,
}));

function renderCommunity() {
  return renderWithProviders(
    <MemoryRouter>
      <CommunityView />
    </MemoryRouter>
  );
}

describe("Community navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.protocolGarden = false;
    mocks.workspace = {
      selectedGarden: { id: GARDEN, chainId: 42161 },
      selectedGardenAddress: GARDEN,
      allocations: [],
      allocationsLoading: false,
      endowmentByAsset: [],
      desktopActions: [],
      hasVaults: false,
      mode: "members",
      handleModeChange: mocks.changeMode,
    } as unknown as CommunityWorkspace;
  });

  it("keeps ordinary gardens on Members, Endowment and Payouts", () => {
    renderCommunity();
    const tabs = within(screen.getByRole("tablist", { name: "Community views" }));
    expect(tabs.getAllByRole("tab")).toHaveLength(3);
    expect(tabs.queryByRole("tab", { name: "Coordination" })).not.toBeInTheDocument();
  });

  it("lets the protocol garden navigate to its funding operations through Coordination", () => {
    mocks.protocolGarden = true;
    mocks.workspace = {
      ...mocks.workspace!,
      selectedGarden: { ...mocks.workspace!.selectedGarden!, chainId: 11155111 },
    };
    renderCommunity();
    fireEvent.click(screen.getByRole("tab", { name: "Coordination" }));
    expect(mocks.changeMode).toHaveBeenCalledWith("coordination");
    expect(mocks.identity).toHaveBeenCalledWith({ chainId: 11155111, gardenId: GARDEN });
  });

  it("does not expose Coordination without a selected garden, even with stale identity", () => {
    mocks.protocolGarden = true;
    mocks.workspace = {
      ...mocks.workspace!,
      selectedGarden: null,
      selectedGardenAddress: undefined,
    };
    renderCommunity();
    expect(screen.queryByRole("tab", { name: "Coordination" })).not.toBeInTheDocument();
  });

  it("removes the protocol-only tab when the reader switches to an ordinary garden", () => {
    mocks.protocolGarden = true;
    const { rerender } = renderCommunity();
    expect(screen.getByRole("tab", { name: "Coordination" })).toBeInTheDocument();
    mocks.protocolGarden = false;
    const ordinaryGarden = "0x2222222222222222222222222222222222222222";
    mocks.workspace = {
      ...mocks.workspace!,
      selectedGarden: { ...mocks.workspace!.selectedGarden!, id: ordinaryGarden },
      selectedGardenAddress: ordinaryGarden,
    };
    rerender(
      <MemoryRouter>
        <CommunityView />
      </MemoryRouter>
    );
    expect(screen.queryByRole("tab", { name: "Coordination" })).not.toBeInTheDocument();
  });
});

describe("Community tab badges (DL-134)", () => {
  beforeEach(() => {
    mocks.protocolGarden = false;
    mocks.workspace = {
      selectedGarden: { id: GARDEN, chainId: 42161 },
      selectedGardenAddress: GARDEN,
      allocations: [
        { assetAddress: GARDEN, cookieJarAmount: 1n, fractionsAmount: 0n, juiceboxAmount: 0n },
      ],
      allocationsLoading: false,
      endowmentByAsset: [],
      memberCount: 11,
      desktopActions: [],
      canManage: true,
      hasVaults: true,
      joinRequestsWaiting: 0,
      mode: "members",
      handleModeChange: mocks.changeMode,
    } as unknown as CommunityWorkspace;
  });

  it("puts no number on a tab for the members, the payouts or having an endowment", () => {
    renderCommunity();
    // A count would join the tab's accessible name, so these exact names prove none.
    for (const name of ["Members", "Endowment", "Payouts"]) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    }
  });

  it("counts the join requests waiting on Members, and shows none when none wait", () => {
    mocks.workspace = { ...mocks.workspace!, joinRequestsWaiting: 3 };
    const { rerender } = renderCommunity();
    expect(screen.getByRole("tab", { name: "Members 3 waiting" })).toBeInTheDocument();

    mocks.workspace = { ...mocks.workspace!, joinRequestsWaiting: 0 };
    rerender(
      <MemoryRouter>
        <CommunityView />
      </MemoryRouter>
    );
    expect(screen.getByRole("tab", { name: "Members" })).toBeInTheDocument();
  });

  it("hides the last check's number from someone who can no longer open the queue", () => {
    mocks.workspace = { ...mocks.workspace!, canManage: false, joinRequestsWaiting: 3 };
    renderCommunity();
    expect(screen.getByRole("tab", { name: "Members" })).toBeInTheDocument();
  });
});
