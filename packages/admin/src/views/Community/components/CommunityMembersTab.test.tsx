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
    <CommunityMembersTab
      garden={storyGarden}
      canManage
      closeMembersModal={() => navigate(`/community/members?gardenId=${storyGarden.id}`)}
      memberCount={memberCount}
      memberSearch=""
      roleMembers={storyRoleMembers}
      roleSummary={roleSummary}
      scheduleBackgroundRefetch={() => {}}
      selectedItem={searchParams.get("item")}
      setMemberSearch={() => {}}
      visibleDirectory={storyDirectory}
    />
  );
}

describe("CommunityMembersTab", () => {
  it("counts people, not role seats, and leaves role counts to the filter", () => {
    // The steward also evaluates: three role seats held by two people (DL-049).
    const roleSummary = storyRoleSummary.map((entry) =>
      entry.role === "evaluator" ? { ...entry, count: 1 } : entry
    );
    renderWithProviders(
      <MemoryRouter initialEntries={[`/community/members?gardenId=${storyGarden.id}`]}>
        <MembersHarness memberCount={2} roleSummary={roleSummary} />
      </MemoryRouter>
    );

    const total = screen.getByText("Total members").parentElement as HTMLElement;
    expect(within(total).getByText("2")).toBeInTheDocument();
    // The rail no longer repeats role counts or the header's member actions (D9, D15).
    expect(screen.queryByRole("link", { name: /^Stewards/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Manage Members" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Evaluators \(1\)/ })).toBeInTheDocument();
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
