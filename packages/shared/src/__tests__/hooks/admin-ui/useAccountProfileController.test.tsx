/** @vitest-environment jsdom */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address, Garden } from "../../../types/domain";
import { useAccountProfileController } from "../../../hooks/admin-ui/layout/useAccountProfileController";
import { renderHookWithProviders } from "../../test-utils";

const gardenOne = {
  id: "0x1111111111111111111111111111111111111111",
  name: "Garden One",
} as Garden;
const gardenTwo = {
  id: "0x2222222222222222222222222222222222222222",
  name: "Garden Two",
} as Garden;

const mocks = vi.hoisted(() => ({
  closeSheet: vi.fn(),
  setGarden: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../../../providers/Auth", () => ({
  useAuthActions: () => ({ signOut: mocks.signOut }),
  useAuthState: () => ({
    authMode: "wallet",
    eoaAddress: "0x9999999999999999999999999999999999999999" as Address,
  }),
}));
vi.mock("../../../hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: "garden.greengoods.eth" }),
}));
vi.mock("../../../hooks/garden/useEligibleAdminGardens", () => ({
  useEligibleAdminGardens: () => ({ eligibleGardens: [gardenOne, gardenTwo] }),
}));
vi.mock("../../../hooks/garden/useAdminGardenWorkspaceSelection", () => ({
  useAdminGardenWorkspaceSelection: () => ({ selectedGarden: gardenOne }),
}));
vi.mock("../../../hooks/gardener/useRole", () => ({
  useRole: () => ({ role: "operator" }),
}));
vi.mock("../../../hooks/navigation/useGardenUrlSync", () => ({
  useGardenUrlSync: () => ({ setGarden: mocks.setGarden }),
}));
vi.mock("../../../stores/useSheetOrchestratorStore", () => ({
  useSheetOrchestratorStore: (selector: (state: { closeSheet: () => void }) => unknown) =>
    selector({ closeSheet: mocks.closeSheet }),
}));

describe("useAccountProfileController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("projects identity and selected-garden state", () => {
    const { result } = renderHookWithProviders(() => useAccountProfileController());

    expect(result.current).toMatchObject({
      authMethodLabel: "Wallet",
      avatarFallback: "GA",
      headline: "garden",
      roleLabel: "operator",
      selectedGardenChoiceId: gardenOne.id,
    });
  });

  it("selects an eligible garden, closes the sheet, and ignores unknown ids", () => {
    const { result } = renderHookWithProviders(() => useAccountProfileController());

    act(() => result.current.selectGarden(gardenTwo.id));
    expect(mocks.setGarden).toHaveBeenCalledWith(gardenTwo);
    expect(mocks.closeSheet).toHaveBeenCalledOnce();

    act(() => result.current.selectGarden("0x3333333333333333333333333333333333333333"));
    expect(mocks.setGarden).toHaveBeenCalledOnce();
    expect(mocks.closeSheet).toHaveBeenCalledOnce();
  });
});
