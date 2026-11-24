import type { GardenCreators } from "@green-goods/shared/hooks/gardener/useRole";
import type { Address } from "@green-goods/shared/types/domain";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../__tests__/test-utils";
import { GardenCreatorsCard } from "./GardenCreatorsCard";

// Nobody here has a photo or a Green Goods name, so the rows read neither from a wallet nor the network.
vi.mock("@green-goods/shared/hooks/profile/useProfileAvatar", async (importOriginal) => ({
  ...(await importOriginal()),
  useResolvedProfileAvatar: () => ({ avatarUri: null, isLoading: false }),
}));
vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({ data: null }),
}));
vi.mock("@green-goods/shared/utils/blockchain/ens", () => ({
  resolveEnsName: async () => null,
  resolveEnsAddress: async () => null,
}));

const CREATOR = "0x1111111111111111111111111111111111111111" as Address;
const NEW_CREATOR = "0x2222222222222222222222222222222222222222";

function creatorsWith(overrides: Partial<GardenCreators> = {}): GardenCreators {
  return {
    creators: [CREATOR],
    canManage: true,
    loading: false,
    isWriting: false,
    addCreator: vi.fn(async () => true),
    removeCreator: vi.fn(async () => true),
    ...overrides,
  };
}

async function openAddDialogAndType(address: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Add Creator" }));
  await user.type(screen.getByLabelText(/Ethereum Address or ENS Name/), address);
  return user;
}

function submitButton() {
  return screen
    .getAllByRole("button", { name: "Add Creator" })
    .find((button) => button.getAttribute("type") === "submit") as HTMLElement;
}

describe("GardenCreatorsCard", () => {
  it("stays out of the way for an account the registry does not let manage the allowlist", () => {
    const { container } = renderWithProviders(
      <GardenCreatorsCard creators={creatorsWith({ canManage: false })} />
    );

    expect(container.querySelector('[data-component="GardenCreators"]')).toBeNull();
  });

  it("adds a typed address through the registry and closes once the wallet accepts", async () => {
    const creators = creatorsWith();
    renderWithProviders(<GardenCreatorsCard creators={creators} />);

    const user = await openAddDialogAndType(NEW_CREATOR);
    await user.click(submitButton());

    await waitFor(() => expect(creators.addCreator).toHaveBeenCalledWith(NEW_CREATOR));
    await waitFor(() => expect(screen.queryByLabelText(/Ethereum Address or ENS Name/)).toBeNull());
  });

  it("never asks the wallet to add someone who can already create gardens", async () => {
    const creators = creatorsWith();
    renderWithProviders(<GardenCreatorsCard creators={creators} />);

    const user = await openAddDialogAndType(CREATOR.toUpperCase().replace("0X", "0x"));
    await user.click(submitButton());

    expect(await screen.findByText("This account can already create gardens.")).toBeInTheDocument();
    expect(creators.addCreator).not.toHaveBeenCalled();
  });

  it("puts the address back when the add does not go through", async () => {
    const creators = creatorsWith({ addCreator: vi.fn(async () => false) });
    renderWithProviders(<GardenCreatorsCard creators={creators} />);

    const user = await openAddDialogAndType(NEW_CREATOR);
    await user.click(submitButton());

    await waitFor(() => expect(creators.addCreator).toHaveBeenCalled());
    expect(await screen.findByDisplayValue(NEW_CREATOR)).toBeInTheDocument();
  });

  it("removes a creator only after the confirmation", async () => {
    const creators = creatorsWith();
    const user = userEvent.setup();
    renderWithProviders(<GardenCreatorsCard creators={creators} />);

    await user.click(screen.getByRole("button", { name: /^Remove / }));
    expect(creators.removeCreator).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Remove Creator" }));
    await waitFor(() => expect(creators.removeCreator).toHaveBeenCalledWith(CREATOR));
  });

  it("keeps the confirmation open to try again when the removal was not sent", async () => {
    const creators = creatorsWith({ removeCreator: vi.fn(async () => false) });
    const user = userEvent.setup();
    renderWithProviders(<GardenCreatorsCard creators={creators} />);

    await user.click(screen.getByRole("button", { name: /^Remove / }));
    await user.click(screen.getByRole("button", { name: "Remove Creator" }));

    await waitFor(() => expect(creators.removeCreator).toHaveBeenCalledWith(CREATOR));
    expect(screen.getByRole("button", { name: "Remove Creator" })).toBeInTheDocument();
  });

  it("says when the list cannot be read instead of showing it as empty", () => {
    renderWithProviders(
      <GardenCreatorsCard creators={creatorsWith({ creators: [], error: "read failed" })} />
    );

    expect(screen.getByText("Couldn't read the garden creators")).toBeInTheDocument();
    expect(screen.queryByText("No garden creators yet")).toBeNull();
  });
});
