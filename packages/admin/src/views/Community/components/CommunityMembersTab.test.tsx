import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate, useSearchParams } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../__tests__/test-utils";
import { CommunityMembersDialogs } from "./CommunityMembersDialogs";
import { CommunityMembersTab } from "./CommunityMembersTab";
import {
  storyDirectory,
  storyGarden,
  storyRoleMembers,
  storyRoleSummary,
} from "./communityStoryFixtures";

vi.mock("@green-goods/shared/hooks/garden/useGardenOperations", () => ({
  useGardenOperations: () => ({ isLoading: false }),
  useAddMembersBatch: () => ({
    hold: null,
    saved: [],
    lastReadAt: 0,
    isSettlingHold: false,
    available: false,
  }),
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
  roleSummary = storyRoleSummary,
}: {
  memberCount?: number;
  roleSummary?: typeof storyRoleSummary;
}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  return (
    <>
      <CommunityMembersDialogs
        garden={storyGarden}
        canManage
        closeMembersModal={() => navigate(`/community/members?gardenId=${storyGarden.id}`)}
        roleMembers={storyRoleMembers}
        scheduleBackgroundRefetch={() => {}}
        selectedItem={searchParams.get("item")}
      />
      <CommunityMembersTab
        garden={storyGarden}
        canManage
        memberCount={memberCount}
        memberSearch=""
        noteJoinRequestsRead={() => {}}
        keepJoinRequestCountGrant={() => {}}
        roleSummary={roleSummary}
        setMemberSearch={() => {}}
        visibleDirectory={storyDirectory}
      />
    </>
  );
}

describe("CommunityMembersTab", () => {
  it("keeps filters count-free, hides empty roles and puts each role count in the Members rail", () => {
    // The steward also evaluates: three role seats held by two people (DL-049).
    const roleSummary = storyRoleSummary.map((entry) =>
      entry.role === "evaluator" ? { ...entry, count: 1 } : entry
    );
    renderWithProviders(
      <MemoryRouter initialEntries={[`/community/members?gardenId=${storyGarden.id}`]}>
        <MembersHarness memberCount={2} roleSummary={roleSummary} />
      </MemoryRouter>
    );

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

  it("opens Manage Roles with the clicked member already filtered", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={[`/community/members?gardenId=${storyGarden.id}`]}>
        <MembersHarness />
      </MemoryRouter>
    );

    await user.click(screen.getAllByRole("link", { name: "Manage Roles" })[1]!);

    const dialog = await screen.findByRole("dialog", { name: "Manage Members" });
    expect(
      within(dialog).getByRole("textbox", {
        name: "Search members by address, ENS name, or role",
      })
    ).toHaveValue(storyDirectory[1]!.address);
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(1);
  });
});
