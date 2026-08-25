/**
 * @vitest-environment jsdom
 */

import userEvent from "@testing-library/user-event";
import type { AccountProfileController } from "@green-goods/shared/hooks/admin-ui/layout/useAccountProfileController";
import type { Address, Garden } from "@green-goods/shared/types/domain";
import { describe, expect, it, vi } from "vitest";
import { AccountProfilePanel } from "@/components/Layout/AccountProfilePanel";
import { render, screen } from "../test-utils";

vi.mock("@green-goods/shared/components/AddressDisplay", () => ({
  AddressDisplay: ({ address }: { address: Address }) => <span>{address}</span>,
}));

vi.mock("@green-goods/shared/hooks/profile/useProfileAvatar", () => ({
  useProfileAvatarEditor: () => ({
    clear: vi.fn(),
    continueAfterReconnect: vi.fn(),
    discardDraft: vi.fn(),
    draft: null,
    isSaving: false,
    save: vi.fn(),
    stage: "idle",
  }),
  useResolvedProfileAvatar: () => ({
    avatarUri: null,
    error: null,
    isLoading: false,
    record: null,
    source: "fallback",
  }),
}));

vi.mock("@green-goods/shared/modules/profile-avatar/editor-messages", () => ({
  getProfileAvatarStageMessage: () => null,
}));

const gardenOne = {
  id: "0x1111111111111111111111111111111111111111",
  name: "Garden One",
  location: "Quito",
} as Garden;

const gardenTwo = {
  id: "0x2222222222222222222222222222222222222222",
  name: "Garden Two",
  location: "Lisbon",
} as Garden;

function createController(
  overrides: Partial<AccountProfileController> = {}
): AccountProfileController {
  return {
    authMethodLabel: "Wallet",
    avatarFallback: "0X",
    eligibleGardens: [gardenOne, gardenTwo],
    eoaAddress: "0x9999999999999999999999999999999999999999" as Address,
    headline: "0x9999...9999",
    roleLabel: "steward",
    selectedGardenChoiceId: gardenOne.id,
    selectGarden: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  } satisfies AccountProfileController;
}

describe("AccountProfilePanel", () => {
  it("renders the typed account fixture and accessible avatar editor", () => {
    render(<AccountProfilePanel controller={createController()} />);

    expect(screen.getByText("0x9999...9999")).toBeVisible();
    expect(screen.getByRole("button", { name: /edit profile photo/i })).toBeVisible();
  });

  it("delegates garden selection to the controller", async () => {
    const user = userEvent.setup();
    const controller = createController();

    render(<AccountProfilePanel controller={controller} />);
    await user.click(screen.getByRole("radio", { name: "Garden Two" }));

    expect(controller.selectGarden).toHaveBeenCalledWith(gardenTwo.id);
  });

  it("delegates sign out to the controller", async () => {
    const user = userEvent.setup();
    const controller = createController();

    render(<AccountProfilePanel controller={controller} />);
    await user.click(screen.getByRole("button", { name: "Disconnect" }));

    expect(controller.signOut).toHaveBeenCalledTimes(1);
  });
});
