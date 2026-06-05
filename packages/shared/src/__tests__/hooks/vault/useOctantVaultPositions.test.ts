/**
 * useOctantVaultPositions Hook Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OctantVaultCampaignManifest } from "../../../modules/vault-crowdfunding";
import type { Address } from "../../../types/domain";

const mockReadContract = vi.fn();

vi.mock("../../../config/pimlico", () => ({
  createPublicClientForChain: () => ({ readContract: (args: unknown) => mockReadContract(args) }),
}));

const OWNER = "0x1111111111111111111111111111111111111111" as Address;
const VAULT_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const VAULT_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address;
const ASSET = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address;

function campaign(slug: string, vaultAddress: Address): OctantVaultCampaignManifest {
  return {
    slug,
    displayName: `Campaign ${slug}`,
    communityName: `Community ${slug}`,
    fixtureRole: "standard_campaign",
    routePath: "/vaults",
    targetProtocol: "octant-v2-ethereum",
    vault: {
      chainId: 1,
      vaultAddress,
      asset: { address: ASSET, symbol: "WETH", decimals: 18 },
    },
  } as OctantVaultCampaignManifest;
}

const CAMPAIGNS = [campaign("greenpill-nyc", VAULT_A), campaign("evmavericks", VAULT_B)];

const { useOctantVaultPositions } = await import("../../../hooks/vault/useOctantVaultPositions");

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

/** Resolve reads by functionName + vault address so allSettled interleaving is irrelevant. */
function mockReads(
  byVault: Record<string, { shares: bigint; value: bigint; withdrawable: bigint }>
) {
  mockReadContract.mockImplementation((call: { address: string; functionName: string }) => {
    const entry = byVault[call.address.toLowerCase()];
    if (!entry) return Promise.resolve(0n);
    if (call.functionName === "balanceOf") return Promise.resolve(entry.shares);
    if (call.functionName === "convertToAssets") return Promise.resolve(entry.value);
    if (call.functionName === "maxWithdraw") return Promise.resolve(entry.withdrawable);
    return Promise.resolve(0n);
  });
}

describe("hooks/vault/useOctantVaultPositions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only active positions (shares > 0) with value and withdrawable", async () => {
    mockReads({
      [VAULT_A.toLowerCase()]: { shares: 500n, value: 600n, withdrawable: 550n },
      [VAULT_B.toLowerCase()]: { shares: 0n, value: 0n, withdrawable: 0n },
    });

    const { result } = renderHook(() => useOctantVaultPositions(OWNER, { campaigns: CAMPAIGNS }), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.positions).toHaveLength(1);
    expect(result.current.hasPositions).toBe(true);
    const position = result.current.positions[0];
    expect(position.campaignSlug).toBe("greenpill-nyc");
    expect(position.vaultAddress).toBe(VAULT_A);
    expect(position.shares).toBe(500n);
    expect(position.positionValue).toBe(600n);
    expect(position.withdrawable).toBe(550n);
    expect(position.assetSymbol).toBe("WETH");
    expect(position.chainId).toBe(1);

    // maxWithdraw is read at the 1% default maxLoss so the displayed withdrawable
    // matches what the withdraw paths will accept.
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "maxWithdraw", args: [OWNER, 100n, []] })
    );
  });

  it("is disabled and reads nothing without an owner", async () => {
    mockReads({});
    const { result } = renderHook(
      () => useOctantVaultPositions(undefined, { campaigns: CAMPAIGNS }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.positions).toEqual([]);
    expect(result.current.hasPositions).toBe(false);
    expect(mockReadContract).not.toHaveBeenCalled();
  });

  it("surfaces an error when every vault read fails", async () => {
    mockReadContract.mockRejectedValue(new Error("rpc down"));

    const { result } = renderHook(() => useOctantVaultPositions(OWNER, { campaigns: CAMPAIGNS }), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.hasPositions).toBe(false);
  });

  it("renders surviving positions when only some vault reads fail", async () => {
    mockReadContract.mockImplementation((call: { address: string; functionName: string }) => {
      if (call.address.toLowerCase() === VAULT_B.toLowerCase()) {
        return Promise.reject(new Error("vault B rpc error"));
      }
      if (call.functionName === "balanceOf") return Promise.resolve(500n);
      if (call.functionName === "convertToAssets") return Promise.resolve(600n);
      if (call.functionName === "maxWithdraw") return Promise.resolve(550n);
      return Promise.resolve(0n);
    });

    const { result } = renderHook(() => useOctantVaultPositions(OWNER, { campaigns: CAMPAIGNS }), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.positions).toHaveLength(1);
    expect(result.current.positions[0].vaultAddress).toBe(VAULT_A);
  });
});
