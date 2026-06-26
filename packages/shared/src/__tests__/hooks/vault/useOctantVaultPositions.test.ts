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
  byVault: Record<
    string,
    { shares: bigint; value: bigint; redeemableShares: bigint; redeemAssets: bigint }
  >
) {
  mockReadContract.mockImplementation(
    (call: { address: string; functionName: string; args?: readonly unknown[] }) => {
      const entry = byVault[call.address.toLowerCase()];
      if (!entry) return Promise.resolve(0n);
      if (call.functionName === "balanceOf") return Promise.resolve(entry.shares);
      if (call.functionName === "convertToAssets") {
        return Promise.resolve(
          call.args?.[0] === entry.redeemableShares ? entry.redeemAssets : entry.value
        );
      }
      if (call.functionName === "maxRedeem") return Promise.resolve(entry.redeemableShares);
      return Promise.resolve(0n);
    }
  );
}

describe("hooks/vault/useOctantVaultPositions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only active positions (shares > 0) with value and redeemable shares", async () => {
    mockReads({
      [VAULT_A.toLowerCase()]: {
        shares: 500n,
        value: 600n,
        redeemableShares: 400n,
        redeemAssets: 480n,
      },
      [VAULT_B.toLowerCase()]: { shares: 0n, value: 0n, redeemableShares: 0n, redeemAssets: 0n },
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
    expect(position.shareDecimals).toBe(18);
    expect(position.positionValue).toBe(600n);
    expect(position.redeemableShares).toBe(400n);
    expect(position.estimatedRedeemAssets).toBe(480n);
    expect(position.assetSymbol).toBe("WETH");
    expect(position.chainId).toBe(1);

    // Multistrategy vaults are read at the 1% default maxLoss so displayed
    // shares match what the redeem paths will accept.
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "maxRedeem", args: [OWNER, 100n, []] })
    );
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "convertToAssets", args: [400n] })
    );
  });

  it("falls back to TokenizedStrategy maxRedeem(owner, maxLoss) when the multistrategy overload is unavailable", async () => {
    mockReadContract.mockImplementation(
      (call: { address: string; functionName: string; args?: readonly unknown[] }) => {
        if (call.address.toLowerCase() === VAULT_B.toLowerCase()) return Promise.resolve(0n);
        if (call.functionName === "balanceOf") return Promise.resolve(500n);
        if (call.functionName === "convertToAssets") return Promise.resolve(600n);
        if (call.functionName === "maxRedeem" && call.args?.length === 3) {
          return Promise.reject(new Error("selector unavailable"));
        }
        if (call.functionName === "maxRedeem" && call.args?.length === 2) {
          return Promise.resolve(500n);
        }
        return Promise.resolve(0n);
      }
    );

    const { result } = renderHook(() => useOctantVaultPositions(OWNER, { campaigns: CAMPAIGNS }), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.positions).toHaveLength(1);
    expect(result.current.positions[0]).toMatchObject({
      shares: 500n,
      redeemableShares: 500n,
      estimatedRedeemAssets: 600n,
    });
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "maxRedeem", args: [OWNER, 100n, []] })
    );
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "maxRedeem", args: [OWNER, 100n] })
    );
  });

  it("preserves redeemable shares when the estimated proceeds preview fails", async () => {
    mockReadContract.mockImplementation(
      (call: { address: string; functionName: string; args?: readonly unknown[] }) => {
        if (call.address.toLowerCase() === VAULT_B.toLowerCase()) return Promise.resolve(0n);
        if (call.functionName === "balanceOf") return Promise.resolve(500n);
        if (call.functionName === "maxRedeem") return Promise.resolve(400n);
        if (call.functionName === "convertToAssets") {
          if (call.args?.[0] === 400n) return Promise.reject(new Error("preview unavailable"));
          return Promise.resolve(600n);
        }
        return Promise.resolve(0n);
      }
    );

    const { result } = renderHook(() => useOctantVaultPositions(OWNER, { campaigns: CAMPAIGNS }), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.positions).toHaveLength(1);
    expect(result.current.positions[0]).toMatchObject({
      shares: 500n,
      positionValue: 600n,
      redeemableShares: 400n,
      estimatedRedeemAssets: null,
    });
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
      if (call.functionName === "maxRedeem") return Promise.resolve(550n);
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
