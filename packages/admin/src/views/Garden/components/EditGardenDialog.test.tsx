import { useGardenWorkspaceController } from "@green-goods/shared/hooks/admin-ui/garden/useGardenWorkspaceController";
import { useDirtyClose } from "@green-goods/shared/hooks/admin-ui/useDirtyClose";
import { createMemoryRouter, RouterProvider, useLocation, useNavigate } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/__tests__/test-utils";
import { AdminViewActions } from "@/components/AdminViewActions";
import { EditGardenDialog, type EditGardenDialogProps } from "./EditGardenDialog";

const { settingsBatch } = vi.hoisted(() => ({
  settingsBatch: {
    available: false,
    hold: null as unknown,
    saved: [] as unknown[],
    lastReadAt: 0,
    isSettlingHold: false,
    send: vi.fn(),
    checkAgain: vi.fn(),
    moveOn: vi.fn(),
  },
}));

vi.mock("@green-goods/shared/hooks/garden/useUpdateGarden", () => {
  const mutation = () => ({ mutateAsync: vi.fn(), isPending: false });
  return {
    // A new object per render, as the real hook returns.
    useGardenSettingsBatch: () => ({ ...settingsBatch }),
    useUpdateGardenName: mutation,
    useUpdateGardenDescription: mutation,
    useUpdateGardenLocation: mutation,
    useUpdateGardenBannerImage: mutation,
    useSetOpenJoining: mutation,
    useSetMaxGardeners: mutation,
  };
});

vi.mock("@green-goods/shared/hooks/garden/useSetGardenDomains", () => ({
  useSetGardenDomains: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// The on-chain identifiers beside the form look up ENS names, which this test is not about.
vi.mock("@/components/Garden/GardenMetadata", () => ({ GardenMetadata: () => null }));

// The workspace's reads are this file's edges when it walks the real controller.
vi.mock("@green-goods/shared/hooks/garden/useAdminGardenWorkspaceSelection", () => ({
  useAdminGardenWorkspaceSelection: () => ({
    selectedGarden: { id: GARDEN_ADDRESS },
    gardenOptions: [],
    handleSelectGarden: () => {},
  }),
}));
vi.mock("@green-goods/shared/hooks/garden/useGardenDetailData", () => ({
  useGardenDetailData: () => ({
    garden: CAPPED_GARDEN,
    canManage: true,
    isOwner: true,
    endowmentByAsset: [],
  }),
}));
vi.mock("@green-goods/shared/hooks/garden/useGardenDerivedState", () => ({
  useGardenDerivedState: () => ({ filteredActivityEvents: [] }),
}));
vi.mock("@green-goods/shared/hooks/garden/useKarmaIntegration", () => ({
  useKarmaIntegration: () => ({}),
}));
vi.mock("@green-goods/shared/hooks/roles/useEffectiveToolbarPermissions", () => ({
  useEffectiveToolbarPermissions: () => ({ showCommunity: true, isLoading: false }),
}));
vi.mock("@green-goods/shared/hooks/ui/useMediaQuery", () => ({ useMediaQuery: () => true }));

const GARDEN_ADDRESS = "0x1234567890123456789012345678901234567890";

const CAPPED_GARDEN = {
  id: GARDEN_ADDRESS,
  tokenAddress: GARDEN_ADDRESS,
  tokenID: "12",
  chainId: 42161,
  name: "Rio Rainforest Lab",
  description: "Community-driven restoration.",
  location: "Rio de Janeiro, Brazil",
  bannerImage: "",
  domainMask: 3,
  openJoining: true,
  maxGardeners: 25,
} as unknown as EditGardenDialogProps["garden"];

function renderDialog(garden: EditGardenDialogProps["garden"]) {
  // The close guard blocks navigation through useBlocker, which needs a data router.
  const router = createMemoryRouter(
    [
      {
        path: "/garden/settings",
        element: <EditGardenDialog open onClose={vi.fn()} garden={garden} canManage isOwner />,
      },
    ],
    { initialEntries: ["/garden/settings"] }
  );
  renderWithProviders(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  settingsBatch.hold = null;
  settingsBatch.lastReadAt = 0;
  settingsBatch.isSettlingHold = false;
});

describe("EditGardenDialog", () => {
  it("opens a capped garden with Limit gardeners on and its cap shown", async () => {
    renderDialog(CAPPED_GARDEN);

    expect(await screen.findByRole("switch", { name: "Limit gardeners" })).toBeChecked();
    expect(screen.getByLabelText("Maximum gardeners")).toHaveValue(25);
  });

  it("puts an unknown save at the top, locks its fields, and settles it on request", async () => {
    const user = userEvent.setup();
    settingsBatch.lastReadAt = 1;
    settingsBatch.hold = {
      operationIds: ["a"],
      fields: ["name", "openJoining"],
      attempted: [
        { field: "name", value: "Tech and Sun Hub" },
        { field: "openJoining", value: false },
      ],
      onChain: [
        { field: "name", value: "Tech and Sun" },
        { field: "openJoining", value: true },
      ],
    };
    renderDialog(CAPPED_GARDEN);

    expect(await screen.findByText("We couldn’t confirm your last save.")).toBeVisible();
    expect(screen.getByText("Name on chain: Tech and Sun")).toBeVisible();
    expect(screen.getByText("Open joining on chain: On")).toBeVisible();
    // The form shows what was sent, locked, and has nothing else to save.
    expect(screen.getByLabelText(/Name/)).toHaveValue("Tech and Sun Hub");
    expect(screen.getByLabelText(/Name/)).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Open joining" })).toBeDisabled();
    expect(screen.getByLabelText("Description")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Check Again" }));
    expect(settingsBatch.checkAgain).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Move On" }));
    expect(settingsBatch.moveOn).toHaveBeenCalledTimes(1);
  });

  it("keeps Save off while held saves are being read", async () => {
    const user = userEvent.setup();
    settingsBatch.isSettlingHold = true;
    renderDialog(CAPPED_GARDEN);

    const nameInput = await screen.findByLabelText(/Name/);
    await user.clear(nameInput);
    await user.type(nameInput, "Tech and Sun Hub");

    expect(screen.getByText("1 change · 1 wallet confirmation")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
  });

  it("keeps Move On off until every held value has been read", async () => {
    settingsBatch.lastReadAt = 1;
    settingsBatch.hold = {
      operationIds: ["a"],
      fields: ["name", "openJoining"],
      attempted: [
        { field: "name", value: "Tech and Sun Hub" },
        { field: "openJoining", value: false },
      ],
      onChain: [{ field: "name", value: "Tech and Sun" }],
    };
    renderDialog(CAPPED_GARDEN);

    expect(
      await screen.findByText("Some values couldn’t be read just now. Check again to move on.")
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Move On" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Check Again" })).toBeEnabled();
  });
});

/** Stands in for the Promises tab's dialogs, which stay mounted while closed. */
function ClosedPoolDialog() {
  useDirtyClose({ isDirty: false, onClose: () => undefined });
  return null;
}

function GardenRoute() {
  const workspace = useGardenWorkspaceController();
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <AdminViewActions items={workspace.desktopActions} />
      {workspace.garden ? (
        <EditGardenDialog
          open={workspace.settingsOpen}
          onClose={workspace.handleSettingsClose}
          garden={workspace.garden}
          canManage={workspace.canManage}
          isOwner={workspace.isOwner}
        />
      ) : null}
      {/* After the dialog, so its blocker is the one the router asks. */}
      {workspace.view === "pool" ? <ClosedPoolDialog /> : null}
      <button type="button" data-testid="browser-back" onClick={() => navigate(-1)} />
      <output data-testid="location">{`${location.pathname}${location.search}`}</output>
    </>
  );
}

function renderWorkspaceAt(path: string, before?: string) {
  const router = createMemoryRouter([{ path: "*", element: <GardenRoute /> }], {
    initialEntries: before ? [before, path] : [path],
    initialIndex: before ? 1 : 0,
  });
  renderWithProviders(<RouterProvider router={router} />);
}

const editButton = () => screen.getByRole("button", { name: "Edit Garden" });
const editDialog = () => screen.queryByRole("dialog", { name: "Edit Garden" });
const currentUrl = () => screen.getByTestId("location").textContent;

describe("Edit Garden over the current tab (DL-140)", () => {
  it.each([
    "health",
    "impact",
    "activity",
    "pool",
  ] as const)("opens over %s and returns there on close", async (tab) => {
    const user = userEvent.setup();
    const tabUrl = `/garden/${tab}?gardenId=${GARDEN_ADDRESS}&range=90d`;
    renderWorkspaceAt(tabUrl);
    expect(editDialog()).not.toBeInTheDocument();

    const opener = editButton();
    await user.click(opener);

    expect(editDialog()).toBeInTheDocument();
    expect(currentUrl()).toBe(`${tabUrl}&item=edit-garden`);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(editDialog()).not.toBeInTheDocument());
    expect(currentUrl()).toBe(tabUrl);
    await waitFor(() => expect(opener).toHaveFocus());

    // The handled item is gone, so the next press opens it again.
    await user.click(editButton());
    expect(editDialog()).toBeInTheDocument();
  });

  it("reopens on the same tab from a direct link or a reload, and closes in place", async () => {
    const user = userEvent.setup();
    const tabUrl = `/garden/impact?gardenId=${GARDEN_ADDRESS}`;
    renderWorkspaceAt(`${tabUrl}&item=edit-garden`);

    expect(editDialog()).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(editDialog()).not.toBeInTheDocument());
    expect(currentUrl()).toBe(tabUrl);
  });

  it("asks before dropping unsaved edits over Promises, whose closed dialogs register later", async () => {
    const user = userEvent.setup();
    const before = `/garden/health?gardenId=${GARDEN_ADDRESS}`;
    const tabUrl = `/garden/pool?gardenId=${GARDEN_ADDRESS}`;
    renderWorkspaceAt(tabUrl, before);

    await user.click(editButton());
    await user.type(await screen.findByLabelText(/Name/), " Annex");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("Discard Changes?")).toBeVisible();
    expect(currentUrl()).toBe(`${tabUrl}&item=edit-garden`);

    await user.click(screen.getByRole("button", { name: "Keep Editing" }));
    expect(editDialog()).toBeInTheDocument();

    // Browser Back asks too.
    fireEvent.click(screen.getByTestId("browser-back"));
    expect(await screen.findByText("Discard Changes?")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Discard" }));

    await waitFor(() => expect(editDialog()).not.toBeInTheDocument());
    expect(currentUrl()).toBe(tabUrl);
  });
});
