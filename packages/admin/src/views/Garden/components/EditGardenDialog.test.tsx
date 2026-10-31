import { createMemoryRouter, RouterProvider } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/__tests__/test-utils";
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

describe("EditGardenDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsBatch.hold = null;
    settingsBatch.lastReadAt = 0;
    settingsBatch.isSettlingHold = false;
  });

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
