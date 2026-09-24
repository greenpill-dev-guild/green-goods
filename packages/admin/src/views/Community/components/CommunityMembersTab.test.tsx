import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate, useSearchParams } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../__tests__/test-utils";
import { CommunityMembersTab } from "./CommunityMembersTab";
import {
  storyDirectory,
  storyGarden,
  storyRoleMembers,
  storyRoleSummary,
} from "./communityStoryFixtures";

vi.mock("@green-goods/shared/hooks/garden/useGardenOperations", () => ({
  useGardenOperations: () => ({ isLoading: false }),
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

function MembersHarness() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  return (
    <CommunityMembersTab
      garden={storyGarden}
      canManage
      closeMembersModal={() => navigate(`/community/members?gardenId=${storyGarden.id}`)}
      memberSearch=""
      roleMembers={storyRoleMembers}
      roleSummary={storyRoleSummary}
      scheduleBackgroundRefetch={() => {}}
      selectedItem={searchParams.get("item")}
      setMemberSearch={() => {}}
      visibleDirectory={storyDirectory}
    />
  );
}

describe("CommunityMembersTab", () => {
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
