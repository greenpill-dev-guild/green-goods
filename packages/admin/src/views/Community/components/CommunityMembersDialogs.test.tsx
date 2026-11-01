import {
  buildCommunityViewActions,
  resolveCommunityMode,
} from "@green-goods/shared/hooks/admin-ui/community/community.utils";
import { createMemoryRouter, RouterProvider, useLocation, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/__tests__/test-utils";
import { AdminViewActions } from "@/components/AdminViewActions";
import { CommunityMembersDialogs } from "./CommunityMembersDialogs";
import { storyGarden, storyRoleMembers } from "./communityStoryFixtures";

const addGardener = vi.hoisted(() => vi.fn());

// The chain and the wallet are this suite's edges; the action, the URL and the dialogs are real.
vi.mock("@green-goods/shared/hooks/garden/useGardenOperations", () => ({
  useGardenOperations: () => ({ isLoading: false, addGardener }),
  useAddMembersBatch: () => ({
    hold: null,
    saved: [],
    lastReadAt: 0,
    isSettlingHold: false,
    available: false,
  }),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useEnsAddress", () => ({
  useEnsAddress: () => ({ data: null, isFetching: false }),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: null }),
  useEnsNames: () => new Map(),
}));
vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({ data: null }),
}));
vi.mock("@green-goods/shared/hooks/roles/useGardenRoleHat", () => ({
  useGardenRoleHat: () => ({ wearsHat: undefined }),
}));

const TAB_URL = `/community/endowment?gardenId=${storyGarden.id}`;
const NEW_MEMBER = "0x7777777777777777777777777777777777777777";

function CommunityRoute({ canManage }: { canManage: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const actions = buildCommunityViewActions(
    resolveCommunityMode(location.pathname),
    canManage,
    true,
    true,
    navigate,
    { gardenAddress: storyGarden.id }
  );
  return (
    <>
      <AdminViewActions items={actions} />
      <CommunityMembersDialogs
        garden={storyGarden}
        canManage={canManage}
        closeMembersModal={() => navigate(`/community/members?gardenId=${storyGarden.id}`)}
        roleMembers={storyRoleMembers}
        scheduleBackgroundRefetch={() => {}}
        selectedItem={new URLSearchParams(location.search).get("item")}
      />
      <button type="button" data-testid="browser-back" onClick={() => navigate(-1)} />
      <output data-testid="location">{`${location.pathname}${location.search}`}</output>
    </>
  );
}

function renderAt(path: string, { before, canManage = true }: RenderOptions = {}) {
  // The dialog's close guard uses useBlocker, which needs a data router.
  const router = createMemoryRouter(
    [{ path: "*", element: <CommunityRoute canManage={canManage} /> }],
    {
      initialEntries: before ? [before, path] : [path],
      initialIndex: before ? 1 : 0,
    }
  );
  return renderWithProviders(<RouterProvider router={router} />);
}

interface RenderOptions {
  before?: string;
  canManage?: boolean;
}

const addButton = () => screen.getByRole("button", { name: "Add Member" });
const addDialog = () => screen.queryByRole("dialog", { name: "Add Members" });
const currentUrl = () => screen.getByTestId("location").textContent;
const pressBrowserBack = () => fireEvent.click(screen.getByTestId("browser-back"));
const addressField = () => screen.getByPlaceholderText("0x... or name.eth");

describe("CommunityMembersDialogs: Add Member (DL-140)", () => {
  it.each([
    "members",
    "coordination",
    "endowment",
    "payouts",
  ] as const)("opens over %s and returns there on close", async (tab) => {
    const user = userEvent.setup();
    const tabUrl = `/community/${tab}?gardenId=${storyGarden.id}`;
    renderAt(tabUrl);
    expect(addDialog()).not.toBeInTheDocument();

    const opener = addButton();
    await user.click(opener);

    expect(addDialog()).toBeInTheDocument();
    expect(currentUrl()).toBe(`${tabUrl}&item=add-member`);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(addDialog()).not.toBeInTheDocument());
    expect(currentUrl()).toBe(tabUrl);
    await waitFor(() => expect(opener).toHaveFocus());

    // The handled item is gone, so the next press opens it again.
    await user.click(addButton());
    expect(addDialog()).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(addDialog()).not.toBeInTheDocument());
    expect(currentUrl()).toBe(tabUrl);
  });

  it("reopens on the same tab from a direct link or a reload, and closes in place", async () => {
    const user = userEvent.setup();
    renderAt(`${TAB_URL}&item=add-member`);

    expect(addDialog()).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(addDialog()).not.toBeInTheDocument());
    expect(currentUrl()).toBe(TAB_URL);
  });

  it("leaves no dead Back step behind a press and a close, and Back itself closes it", async () => {
    const user = userEvent.setup();
    const before = `/community/members?gardenId=${storyGarden.id}`;
    renderAt(TAB_URL, { before });

    await user.click(addButton());
    pressBrowserBack();
    await waitFor(() => expect(addDialog()).not.toBeInTheDocument());
    expect(currentUrl()).toBe(TAB_URL);

    await user.click(addButton());
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(addDialog()).not.toBeInTheDocument());

    pressBrowserBack();
    await waitFor(() => expect(currentUrl()).toBe(before));
  });

  it("goes back once for a double click on Cancel", async () => {
    const user = userEvent.setup();
    renderAt(TAB_URL, { before: `/community/members?gardenId=${storyGarden.id}` });

    await user.click(addButton());
    await user.dblClick(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(addDialog()).not.toBeInTheDocument());
    expect(currentUrl()).toBe(TAB_URL);
  });

  it("stays closed for another route item and for a reader who cannot manage", () => {
    const { unmount } = renderAt(`${TAB_URL}&item=fund-jar`);
    expect(addDialog()).not.toBeInTheDocument();
    unmount();

    renderAt(`${TAB_URL}&item=add-member`, { canManage: false });
    expect(addDialog()).not.toBeInTheDocument();
  });

  it("opens over Manage Members without an item of its own, and hands back to it", async () => {
    const user = userEvent.setup();
    const manageUrl = `/community/members?gardenId=${storyGarden.id}&item=manage-members`;
    renderAt(manageUrl);

    const manage = await screen.findByRole("dialog", { name: "Manage Members" });
    await user.click(within(manage).getByRole("button", { name: "Add Members" }));
    const add = await screen.findByRole("dialog", { name: "Add Members" });
    expect(currentUrl()).toBe(manageUrl);

    await user.click(within(add).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(addDialog()).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "Manage Members" })).toBeInTheDocument();
    expect(currentUrl()).toBe(manageUrl);
  });

  it("asks before Back or the close button drops a draft, and keeps it on Keep Editing", async () => {
    const user = userEvent.setup();
    renderAt(TAB_URL, { before: `/community/members?gardenId=${storyGarden.id}` });

    await user.click(addButton());
    await user.type(addressField(), NEW_MEMBER);

    pressBrowserBack();
    expect(await screen.findByText("Discard Changes?")).toBeVisible();
    expect(currentUrl()).toBe(`${TAB_URL}&item=add-member`);
    await user.click(screen.getByRole("button", { name: "Keep Editing" }));
    expect(addressField()).toHaveValue(NEW_MEMBER);

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(await screen.findByRole("button", { name: "Discard" }));
    await waitFor(() => expect(addDialog()).not.toBeInTheDocument());
    expect(currentUrl()).toBe(TAB_URL);

    // The discarded draft does not come back with the next press.
    await user.click(addButton());
    expect(addressField()).toHaveValue("");
  });

  it("drops a draft on Cancel with no prompt", async () => {
    const user = userEvent.setup();
    renderAt(TAB_URL, { before: `/community/members?gardenId=${storyGarden.id}` });

    await user.click(addButton());
    await user.type(addressField(), NEW_MEMBER);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(addDialog()).not.toBeInTheDocument());
    expect(screen.queryByText("Discard Changes?")).not.toBeInTheDocument();
    expect(currentUrl()).toBe(TAB_URL);
  });

  it("holds Back while an add sends, then closes to the tab with no prompt", async () => {
    const user = userEvent.setup();
    let finish: (result: { success: boolean }) => void = () => {};
    addGardener.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    renderAt(TAB_URL, { before: `/community/members?gardenId=${storyGarden.id}` });

    await user.click(addButton());
    await user.type(addressField(), NEW_MEMBER);
    await user.click(screen.getByRole("button", { name: /^Add 1 / }));
    await waitFor(() => expect(addGardener).toHaveBeenCalled());

    pressBrowserBack();
    await act(async () => {
      await Promise.resolve();
    });
    expect(currentUrl()).toBe(`${TAB_URL}&item=add-member`);
    expect(screen.queryByText("Discard Changes?")).not.toBeInTheDocument();

    await act(async () => finish({ success: true }));

    await waitFor(() => expect(addDialog()).not.toBeInTheDocument());
    expect(screen.queryByText("Discard Changes?")).not.toBeInTheDocument();
    expect(currentUrl()).toBe(TAB_URL);
  });

  it("closes Manage Members and Add Members over it when Back leaves its item", async () => {
    const user = userEvent.setup();
    renderAt(`/community/members?gardenId=${storyGarden.id}&item=manage-members`, {
      before: TAB_URL,
    });

    const manage = await screen.findByRole("dialog", { name: "Manage Members" });
    await user.click(within(manage).getByRole("button", { name: "Add Members" }));
    await screen.findByRole("dialog", { name: "Add Members" });

    pressBrowserBack();

    await waitFor(() => expect(addDialog()).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Manage Members" })).not.toBeInTheDocument()
    );
    expect(currentUrl()).toBe(TAB_URL);
  });
});
