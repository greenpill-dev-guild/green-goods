/**
 * VaultEventHistory pages through a garden's vault activity, links each transaction to the chain's
 * explorer, and says when there is no activity or no amount.
 */

import type { VaultEvent } from "@green-goods/shared/types/vaults";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fireEvent, renderWithProviders, screen, within } from "../test-utils";

const vaultEvents = vi.hoisted(() => ({
  current: { events: [] as VaultEvent[], isLoading: false },
}));

vi.mock("@green-goods/shared/hooks/vault/useVaultEvents", () => ({
  useVaultEvents: () => vaultEvents.current,
}));
vi.mock("@green-goods/shared/hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 11155111,
}));
vi.mock("@green-goods/shared/config/blockchain", () => ({
  getNetworkConfig: () => ({ blockExplorer: "https://explorer.example" }),
}));
vi.mock("@/components/EnsAddressText", () => ({
  EnsAddressText: ({ address }: { address: string }) => address,
}));

import { VaultEventHistory } from "@/components/Vault/VaultEventHistory";

const GARDEN = "0x2222222222222222222222222222222222222222";

function vaultEvent(index: number, overrides: Partial<VaultEvent> = {}): VaultEvent {
  return {
    id: `event-${index}`,
    chainId: 11155111,
    garden: GARDEN,
    asset: "0x3333333333333333333333333333333333333333",
    vaultAddress: "0x4444444444444444444444444444444444444444",
    eventType: "DEPOSIT",
    actor: "0x5555555555555555555555555555555555555555",
    amount: 1_000_000_000_000_000_000n,
    shares: null,
    txHash: `0x${String(index).padStart(64, "0")}`,
    timestamp: 1_760_000_000 + index,
    ...overrides,
  };
}

function tableRows() {
  return within(screen.getByRole("table")).getAllByRole("row").slice(1);
}

beforeEach(() => {
  vaultEvents.current = { events: [], isLoading: false };
});

describe("VaultEventHistory", () => {
  it("shows one page of events at a time and drops the control once every event is shown", () => {
    vaultEvents.current.events = Array.from({ length: 5 }, (_, index) => vaultEvent(index));
    renderWithProviders(<VaultEventHistory gardenAddress={GARDEN} initialVisibleCount={2} />);

    expect(tableRows()).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Load More" }));
    expect(tableRows()).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Load More" }));
    expect(tableRows()).toHaveLength(5);
    expect(screen.queryByRole("button", { name: "Load More" })).toBeNull();
  });

  it("links each transaction to the chain's block explorer", () => {
    vaultEvents.current.events = [vaultEvent(7)];
    renderWithProviders(<VaultEventHistory gardenAddress={GARDEN} />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      `https://explorer.example/tx/0x${"7".padStart(64, "0")}`,
      `https://explorer.example/tx/0x${"7".padStart(64, "0")}`,
    ]);
  });

  it("says when the garden's vaults have no activity yet", () => {
    renderWithProviders(<VaultEventHistory gardenAddress={GARDEN} />);

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("No endowment events yet")).toBeInTheDocument();
  });

  it("marks an event without an amount instead of showing zero", () => {
    vaultEvents.current.events = [vaultEvent(1, { eventType: "EMERGENCY_PAUSED", amount: null })];
    renderWithProviders(<VaultEventHistory gardenAddress={GARDEN} />);

    const [row] = tableRows();
    expect(within(row).getByText("N/A")).toBeInTheDocument();
    expect(within(row).queryByText(/^0(\.0+)?$/)).toBeNull();
  });
});
