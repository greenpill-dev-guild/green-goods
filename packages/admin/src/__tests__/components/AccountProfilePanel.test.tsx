/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "../test-utils";
import userEvent from "@testing-library/user-event";
import type { Address, Garden } from "@green-goods/shared";
import { AccountProfilePanel } from "@/components/Layout/AccountProfilePanel";

const accountProfilePanelMocks = vi.hoisted(() => ({
  closeSheet: vi.fn(),
  gardenOne: {
    id: "0x1111111111111111111111111111111111111111",
    name: "Garden One",
    location: "Quito",
  } as Garden,
  gardenTwo: {
    id: "0x2222222222222222222222222222222222222222",
    name: "Garden Two",
    location: "Lisbon",
  } as Garden,
  setGarden: vi.fn(),
}));

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  return {
    ...actual,
    AddressDisplay: ({ address }: { address: Address }) => <span>{address}</span>,
    useAuthActions: () => ({ signOut: vi.fn() }),
    useAuthState: () => ({
      authMode: "wallet",
      eoaAddress: "0x9999999999999999999999999999999999999999" as Address,
    }),
    useEligibleAdminGardens: () => ({
      eligibleGardens: [accountProfilePanelMocks.gardenOne, accountProfilePanelMocks.gardenTwo],
      resolvedDefaultGarden: accountProfilePanelMocks.gardenOne,
      persistedGardenId: null,
      scopeKey: "test",
      canCreateGarden: true,
      isLoaded: true,
    }),
    useAdminGardenWorkspaceSelection: () => ({
      eligibleGardens: [accountProfilePanelMocks.gardenOne, accountProfilePanelMocks.gardenTwo],
      selectedGarden: accountProfilePanelMocks.gardenOne,
      setSelectedGarden: vi.fn(),
      gardenOptions: [accountProfilePanelMocks.gardenOne, accountProfilePanelMocks.gardenTwo],
      handleSelectGarden: vi.fn(),
    }),
    useAuth: () => ({
      authMode: "wallet",
      eoaAddress: "0x9999999999999999999999999999999999999999" as Address,
      isAuthenticated: true,
      isReady: true,
      signOut: vi.fn(),
    }),
    useEnsAvatar: () => ({ data: null }),
    useEnsName: () => ({ data: null }),
    useOffline: () => ({ isOnline: true }),
    mediaResourceManager: {
      cleanupUrls: vi.fn(),
      getOrCreateUrl: vi.fn(() => "blob:preview"),
    },
    useGardenUrlSync: () => ({
      setGarden: accountProfilePanelMocks.setGarden,
    }),
    useRole: () => ({ role: "operator" }),
    useSheetOrchestratorStore: <T,>(selector: (state: { closeSheet: () => void }) => T) =>
      selector({ closeSheet: accountProfilePanelMocks.closeSheet }),
  };
});
vi.mock("@green-goods/shared/profile-avatar", () => ({
  getProfileAvatarStageMessage: () => null,
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

describe("AccountProfilePanel", () => {
  it("offers the same accessible avatar editor from the account inspector", () => {
    render(<AccountProfilePanel />);

    expect(screen.getByRole("button", { name: /edit profile photo/i })).toBeVisible();
  });

  it("switches garden context and closes the account sheet", async () => {
    const user = userEvent.setup();

    render(<AccountProfilePanel />);

    await user.click(screen.getByRole("radio", { name: "Garden Two" }));

    expect(accountProfilePanelMocks.setGarden).toHaveBeenCalledWith(
      accountProfilePanelMocks.gardenTwo
    );
    expect(accountProfilePanelMocks.closeSheet).toHaveBeenCalledTimes(1);
  });
});
