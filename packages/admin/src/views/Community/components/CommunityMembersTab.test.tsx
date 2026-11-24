import {
  useGardenMemberContributions,
  useGardenMemberReadiness,
} from "@green-goods/shared/hooks/garden/useGardenMemberContributions";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider, useNavigate, useSearchParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../__tests__/test-utils";
import { CommunityMembersDialogs } from "./CommunityMembersDialogs";
import { CommunityMembersTab } from "./CommunityMembersTab";
import {
  storyDirectory,
  storyGarden,
  storyRoleMembers,
  storyRoleSummary,
} from "./communityStoryFixtures";

vi.mock("@green-goods/shared/hooks/garden/useGardenMemberContributions", () => ({
  useGardenMemberContributions: vi.fn(() => ({ canView: false, byAccount: {} })),
  useGardenMemberReadiness: vi.fn(() => ({ canView: false, byAccount: {} })),
}));
vi.mock("@green-goods/shared/hooks/garden/useGardenMemberHistory", () => ({
  useGardenMemberHistory: () => ({
    members: [
      {
        garden: storyGarden.id,
        account: storyDirectory[0].address,
        joinedAt: Date.UTC(2026, 5, 12, 12),
        memberSince: Date.UTC(2026, 5, 12, 12),
        roleSince: { owner: Date.UTC(2026, 5, 12, 12) },
      },
    ],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@green-goods/shared/hooks/garden/useGardenOperations", () => ({
  useGardenOperations: () => ({ isLoading: false }),
  useAddMembersBatch: () => ({
    hold: null,
    saved: [],
    lastReadAt: 0,
    isSettlingHold: false,
    available: false,
  }),
  useRemoveMemberRoles: () => ({ account: null, check: vi.fn(), remove: vi.fn() }),
  useSubRoleCheck: () => vi.fn(),
}));
// The steward has an ENS name; the owner has none, so their row shows a short address.
vi.mock("@green-goods/shared/hooks/ens/useAddressDisplayName", () => ({
  useAddressDisplayName: (address: string) => {
    const name = address === storyDirectory[1]?.address ? "ana-souza.eth" : null;
    return { preferredName: name, display: name ?? `${address.slice(0, 6)}…` };
  },
}));
vi.mock("./CommunityJoinRequests", () => ({
  CommunityJoinRequests: () => null,
}));
vi.mock("@/components/Garden/AddMembersDialog", () => ({
  AddMembersDialog: () => null,
}));
vi.mock("@green-goods/shared/utils/blockchain/ens", () => ({
  resolveEnsName: async () => null,
}));
// Each member is a person row: nobody here has a photo or a Green Goods name, so the row
// reads neither from a wallet nor the network.
vi.mock("@green-goods/shared/hooks/profile/useProfileAvatar", async (importOriginal) => ({
  ...(await importOriginal()),
  useResolvedProfileAvatar: () => ({ avatarUri: null, isLoading: false }),
}));
vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({ data: null }),
}));

function MembersHarness({
  memberCount = storyDirectory.length,
  memberSearch = "",
  roleSummary = storyRoleSummary,
}: {
  memberCount?: number;
  memberSearch?: string;
  roleSummary?: typeof storyRoleSummary;
}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  return (
    <>
      <CommunityMembersDialogs
        garden={storyGarden}
        canManage
        canManageStewards={false}
        closeMembersModal={() => navigate(`/community/members?gardenId=${storyGarden.id}`)}
        isOwner
        roleMembers={storyRoleMembers}
        scheduleBackgroundRefetch={() => {}}
        selectedItem={searchParams.get("item")}
      />
      <CommunityMembersTab
        garden={storyGarden}
        canManage
        memberCount={memberCount}
        memberSearch={memberSearch}
        noteJoinRequestsRead={() => {}}
        keepJoinRequestCountGrant={() => {}}
        roleSummary={roleSummary}
        setMemberSearch={() => {}}
        visibleDirectory={storyDirectory}
      />
    </>
  );
}

// Manage Roles guards its picks against Back, so the harness runs in a data router.
function renderMembers(props: Parameters<typeof MembersHarness>[0] = {}) {
  const router = createMemoryRouter([{ path: "*", element: <MembersHarness {...props} /> }], {
    initialEntries: [`/community/members?gardenId=${storyGarden.id}`],
  });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe("CommunityMembersTab", () => {
  beforeEach(() => {
    vi.mocked(useGardenMemberContributions).mockReturnValue({ canView: false, byAccount: {} });
    vi.mocked(useGardenMemberReadiness).mockReturnValue({ canView: false, byAccount: {} });
  });

  it("shows each member's readiness stage, its evidence and a hint, and filters by stage", async () => {
    const user = userEvent.setup();
    const [owner, steward] = storyDirectory;
    vi.mocked(useGardenMemberReadiness).mockReturnValue({
      canView: true,
      byAccount: {
        [owner.address.toLowerCase()]: {
          status: "read",
          stage: "contributing",
          firstSentAt: Date.UTC(2026, 6, 1, 12),
          firstApprovedAt: Date.UTC(2026, 6, 3, 12),
        },
        [steward.address.toLowerCase()]: {
          status: "read",
          stage: "registered",
          firstSentAt: null,
          firstApprovedAt: null,
        },
      },
    });
    renderMembers();
    // Roles until the mode is chosen; the read is asked for only once it is.
    expect(screen.queryByText("Contributing")).not.toBeInTheDocument();
    expect(useGardenMemberReadiness).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false })
    );
    await user.click(screen.getByRole("button", { name: "Readiness" }));

    expect(useGardenMemberReadiness).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true })
    );
    expect(screen.getByText("First work approved Jul 3, 2026")).toBeInTheDocument();
    expect(screen.getByText("Nothing needed now")).toBeInTheDocument();
    expect(screen.getByText("Help them send a first report")).toBeInTheDocument();
    expect(
      screen.getByText(/people who share a phone are not counted separately/)
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Readiness stage"), "registered");
    expect(screen.queryByText("First work approved Jul 3, 2026")).not.toBeInTheDocument();
    expect(screen.getByText("Help them send a first report")).toBeInTheDocument();
  });

  it("offers no readiness mode to a member who may not read the records", () => {
    renderMembers();
    expect(screen.queryByRole("button", { name: "Readiness" })).not.toBeInTheDocument();
  });
  it("shows contribution instead of membership in a manager's compact row", () => {
    vi.mocked(useGardenMemberContributions).mockReturnValue({
      canView: true,
      byAccount: {
        [storyDirectory[0].address.toLowerCase()]: {
          status: "recorded",
          at: Date.UTC(2026, 10, 15, 12),
        },
      },
    });
    renderMembers();
    expect(screen.getByText("Contributed Nov 15, 2026")).toBeInTheDocument();
    expect(screen.queryByText("Joined Jun 12, 2026")).not.toBeInTheDocument();
    expect(useGardenMemberContributions).toHaveBeenCalledWith({
      garden: storyGarden,
      accounts: storyDirectory.map((entry) => entry.address),
    });
  });
  it("keeps the membership row fact for non-managers even when cached contributions exist", () => {
    vi.mocked(useGardenMemberContributions).mockReturnValue({
      canView: false,
      byAccount: {
        [storyDirectory[0].address.toLowerCase()]: {
          status: "recorded",
          at: Date.UTC(2026, 10, 15, 12),
        },
      },
    });
    renderMembers();
    expect(screen.queryByText(/Contributed/)).not.toBeInTheDocument();
    expect(screen.getByText("Joined Jun 12, 2026")).toBeInTheDocument();
  });

  it("keeps filters count-free, hides empty roles and puts each role count in the Members rail", () => {
    // The steward also evaluates: three role seats held by two people (DL-049).
    const roleSummary = storyRoleSummary.map((entry) =>
      entry.role === "evaluator" ? { ...entry, count: 1 } : entry
    );
    renderMembers({ memberCount: 2, roleSummary });

    const rail = screen
      .getByRole("heading", { name: "Members" })
      .closest<HTMLElement>('[data-component="AdminCard"]')!;
    for (const entry of roleSummary) {
      const rows = rail.querySelectorAll('[data-component="FactRow"]');
      const row = [...rows][roleSummary.indexOf(entry)] as HTMLElement;
      expect(within(row).getByText(String(entry.count))).toBeInTheDocument();
    }
    const directory = screen.getByRole("heading", { name: "Member Directory" });
    expect(directory.nextElementSibling).toHaveTextContent("2 members");
    expect(screen.getByRole("button", { name: "Evaluators" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /\(\d+\)/ })).not.toBeInTheDocument();
    for (const entry of roleSummary.filter((entry) => entry.count === 0)) {
      expect(
        screen.queryByRole("button", { name: new RegExp(entry.role, "i") })
      ).not.toBeInTheDocument();
    }
  });

  it("opens Manage Roles for everyone from the header, or for one person from their row", async () => {
    const user = userEvent.setup();
    renderMembers();

    const [header, firstRow, secondRow] = screen.getAllByRole("link", { name: "Manage Roles" });
    expect(header).toHaveAttribute("href", expect.not.stringContaining("member="));
    await user.click(secondRow!);

    const dialog = await screen.findByRole("dialog", { name: "Manage Roles" });
    expect(within(dialog).getByRole("button", { name: "Show Everyone" })).toBeInTheDocument();
    expect(dialog.querySelectorAll("[data-component='ManageRolesPersonRow']")).toHaveLength(1);
    expect(within(dialog).getByRole("textbox")).toHaveValue("");
    expect(firstRow).toBeInTheDocument();
  });

  it("finds a member by the name their row shows", () => {
    renderMembers({ memberSearch: "ana" });

    expect(screen.getByText("ana-souza.eth")).toBeInTheDocument();
    expect(screen.queryByText(`${storyDirectory[0]!.address.slice(0, 6)}…`)).toBeNull();
  });
});
