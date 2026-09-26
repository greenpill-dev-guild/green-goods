import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/__tests__/test-utils";
import { EditGardenDialog, type EditGardenDialogProps } from "./EditGardenDialog";

vi.mock("@green-goods/shared/hooks/garden/useUpdateGarden", () => {
  const mutation = () => ({ mutateAsync: vi.fn(), isPending: false });
  return {
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
  it("opens a capped garden with Limit gardeners on and its cap shown", async () => {
    renderDialog(CAPPED_GARDEN);

    expect(await screen.findByRole("switch", { name: "Limit gardeners" })).toBeChecked();
    expect(screen.getByLabelText("Maximum gardeners")).toHaveValue(25);
  });
});
