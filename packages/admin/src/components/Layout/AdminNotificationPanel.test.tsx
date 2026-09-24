import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/__tests__/test-utils";
import { AdminNotificationPanel } from "./AdminNotificationPanel";

const GARDEN_ID = "0x1111111111111111111111111111111111111111";
const mockPermissions = vi.hoisted(() => ({ showCommunity: true, isLoading: false }));

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
    works: [{ id: "work-1", title: "Mulching", status: "approved", createdAt: Date.now() }],
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
    vaultNetDeposited: 0n,
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
});
