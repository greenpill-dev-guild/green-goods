/**
 * octant-vault-card-wallet-cache tests
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { Address } from "../../types/domain";
import {
  forgetOctantVaultCardWalletPositions,
  getOctantVaultCardWalletOwners,
  getOctantVaultCardWalletPositionRefs,
  getOctantVaultPendingFundedCardWalletRefs,
  rememberOctantVaultCardWalletPosition,
} from "../../modules/octant-vault-card-wallet-cache";

const WALLET_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const WALLET_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address;
const VAULT_NYC = "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5" as Address;
const VAULT_EVM = "0x0bCe8c16974FFD3B410A32365c5bCf27a5A630Fc" as Address;
const STORAGE_KEY = "gg:octant-vault-card-wallets:v1";

describe("modules/octant-vault-card-wallet-cache", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("remembers and reads back a card-wallet position with only safe fields", () => {
    rememberOctantVaultCardWalletPosition(
      {
        recoveredWalletAddress: WALLET_A,
        campaignSlug: "greenpill-nyc",
        vaultAddress: VAULT_NYC,
        chainId: 1,
      },
      1000
    );

    const refs = getOctantVaultCardWalletPositionRefs();
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({
      recoveredWalletAddress: WALLET_A,
      campaignSlug: "greenpill-nyc",
      vaultAddress: VAULT_NYC,
      chainId: 1,
      updatedAt: 1000,
      status: "confirmed",
    });

    // No private identifiers were ever persisted.
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? "";
    expect(raw).not.toMatch(/email|otp|provider|receipt|token|secret/i);
  });

  it("reads back a legacy confirmed entry without a status field (backward compatibility)", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          recoveredWalletAddress: WALLET_A,
          campaignSlug: "greenpill-nyc",
          vaultAddress: VAULT_NYC,
          chainId: 1,
          updatedAt: 1000,
        },
      ])
    );

    const refs = getOctantVaultCardWalletPositionRefs();
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({
      recoveredWalletAddress: WALLET_A,
      campaignSlug: "greenpill-nyc",
      vaultAddress: VAULT_NYC,
      chainId: 1,
      updatedAt: 1000,
    });
    // A legacy entry is never a pending-funded recovery candidate.
    expect(getOctantVaultPendingFundedCardWalletRefs()).toEqual([]);
    expect(getOctantVaultCardWalletOwners()).toEqual([WALLET_A]);
  });

  it("persists a pending-funded entry with only safe public recovery metadata", () => {
    rememberOctantVaultCardWalletPosition(
      {
        recoveredWalletAddress: WALLET_A,
        campaignSlug: "greenpill-nyc",
        vaultAddress: VAULT_NYC,
        chainId: 1,
        status: "pending_funded",
        tokenAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address,
        expectedAmount: "10000000000000000",
      },
      1000
    );

    const pending = getOctantVaultPendingFundedCardWalletRefs();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toEqual({
      recoveredWalletAddress: WALLET_A,
      campaignSlug: "greenpill-nyc",
      vaultAddress: VAULT_NYC,
      chainId: 1,
      updatedAt: 1000,
      status: "pending_funded",
      tokenAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      expectedAmount: "10000000000000000",
    });

    // Owner addresses include the pending wallet so management can offer recovery.
    expect(getOctantVaultCardWalletOwners()).toEqual([WALLET_A]);

    // Nothing private-looking is persisted alongside the safe tuple.
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? "";
    expect(raw).not.toMatch(/email|otp|provider|receipt|secret|session/i);
  });

  it("upgrades a pending-funded entry to confirmed by (wallet, vault) upsert", () => {
    rememberOctantVaultCardWalletPosition(
      {
        recoveredWalletAddress: WALLET_A,
        campaignSlug: "greenpill-nyc",
        vaultAddress: VAULT_NYC,
        chainId: 1,
        status: "pending_funded",
        tokenAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address,
        expectedAmount: "10000000000000000",
      },
      1000
    );
    rememberOctantVaultCardWalletPosition(
      {
        recoveredWalletAddress: WALLET_A,
        campaignSlug: "greenpill-nyc",
        vaultAddress: VAULT_NYC,
        chainId: 1,
        status: "confirmed",
      },
      2000
    );

    const refs = getOctantVaultCardWalletPositionRefs();
    expect(refs).toHaveLength(1);
    expect(refs[0].status).toBe("confirmed");
    expect(refs[0].updatedAt).toBe(2000);
    // The recovery tuple does not survive confirmation.
    expect(refs[0].tokenAddress).toBeUndefined();
    expect(refs[0].expectedAmount).toBeUndefined();
    expect(getOctantVaultPendingFundedCardWalletRefs()).toEqual([]);
  });

  it("drops stored entries whose lifecycle fields are malformed", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        // Bad status value.
        {
          recoveredWalletAddress: WALLET_A,
          campaignSlug: "greenpill-nyc",
          vaultAddress: VAULT_NYC,
          chainId: 1,
          updatedAt: 1000,
          status: "totally_private",
        },
        // Bad token address.
        {
          recoveredWalletAddress: WALLET_A,
          campaignSlug: "evmavericks",
          vaultAddress: VAULT_EVM,
          chainId: 1,
          updatedAt: 2000,
          status: "pending_funded",
          tokenAddress: "not-an-address",
          expectedAmount: "1",
        },
        // Bad amount (not base units).
        {
          recoveredWalletAddress: WALLET_B,
          campaignSlug: "greenpill-nyc",
          vaultAddress: VAULT_NYC,
          chainId: 1,
          updatedAt: 3000,
          status: "pending_funded",
          tokenAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
          expectedAmount: "1.5 ETH",
        },
        // Valid confirmed entry survives.
        {
          recoveredWalletAddress: WALLET_B,
          campaignSlug: "evmavericks",
          vaultAddress: VAULT_EVM,
          chainId: 1,
          updatedAt: 4000,
          status: "confirmed",
        },
      ])
    );

    const refs = getOctantVaultCardWalletPositionRefs();
    expect(refs).toHaveLength(1);
    expect(refs[0].vaultAddress).toBe(VAULT_EVM);
    expect(getOctantVaultPendingFundedCardWalletRefs()).toEqual([]);
  });

  it("strips unknown private-looking fields from stored entries instead of round-tripping them", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          recoveredWalletAddress: WALLET_A,
          campaignSlug: "greenpill-nyc",
          vaultAddress: VAULT_NYC,
          chainId: 1,
          updatedAt: 1000,
          status: "confirmed",
          email: "donor@example.org",
          providerSessionId: "ps_123",
          receiptToken: "tok_123",
        },
      ])
    );

    const refs = getOctantVaultCardWalletPositionRefs();
    expect(refs).toHaveLength(1);
    expect(refs[0]).not.toHaveProperty("email");
    expect(refs[0]).not.toHaveProperty("providerSessionId");
    expect(refs[0]).not.toHaveProperty("receiptToken");

    // A subsequent write persists only the sanitized allowlist.
    rememberOctantVaultCardWalletPosition(
      {
        recoveredWalletAddress: WALLET_B,
        campaignSlug: "evmavericks",
        vaultAddress: VAULT_EVM,
        chainId: 1,
      },
      2000
    );
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? "";
    expect(raw).not.toMatch(/donor@example\.org|ps_123|tok_123/);
  });

  it("upserts by (wallet, vault) instead of duplicating, keeping the latest timestamp", () => {
    rememberOctantVaultCardWalletPosition(
      {
        recoveredWalletAddress: WALLET_A,
        campaignSlug: "greenpill-nyc",
        vaultAddress: VAULT_NYC,
        chainId: 1,
      },
      1000
    );
    rememberOctantVaultCardWalletPosition(
      {
        recoveredWalletAddress: WALLET_A,
        campaignSlug: "greenpill-nyc",
        vaultAddress: VAULT_NYC,
        chainId: 1,
      },
      2000
    );

    const refs = getOctantVaultCardWalletPositionRefs();
    expect(refs).toHaveLength(1);
    expect(refs[0].updatedAt).toBe(2000);
  });

  it("keeps distinct (wallet, vault) entries and returns newest first", () => {
    rememberOctantVaultCardWalletPosition(
      {
        recoveredWalletAddress: WALLET_A,
        campaignSlug: "greenpill-nyc",
        vaultAddress: VAULT_NYC,
        chainId: 1,
      },
      1000
    );
    rememberOctantVaultCardWalletPosition(
      {
        recoveredWalletAddress: WALLET_A,
        campaignSlug: "evmavericks",
        vaultAddress: VAULT_EVM,
        chainId: 1,
      },
      3000
    );
    rememberOctantVaultCardWalletPosition(
      {
        recoveredWalletAddress: WALLET_B,
        campaignSlug: "greenpill-nyc",
        vaultAddress: VAULT_NYC,
        chainId: 1,
      },
      2000
    );

    const refs = getOctantVaultCardWalletPositionRefs();
    expect(refs.map((r) => r.updatedAt)).toEqual([3000, 2000, 1000]);
  });

  it("exposes distinct owner addresses (deduped, newest first)", () => {
    rememberOctantVaultCardWalletPosition(
      {
        recoveredWalletAddress: WALLET_A,
        campaignSlug: "greenpill-nyc",
        vaultAddress: VAULT_NYC,
        chainId: 1,
      },
      1000
    );
    rememberOctantVaultCardWalletPosition(
      {
        recoveredWalletAddress: WALLET_A,
        campaignSlug: "evmavericks",
        vaultAddress: VAULT_EVM,
        chainId: 1,
      },
      3000
    );
    rememberOctantVaultCardWalletPosition(
      {
        recoveredWalletAddress: WALLET_B,
        campaignSlug: "greenpill-nyc",
        vaultAddress: VAULT_NYC,
        chainId: 1,
      },
      2000
    );

    expect(getOctantVaultCardWalletOwners()).toEqual([WALLET_A, WALLET_B]);
  });

  it("rejects malformed input without writing", () => {
    rememberOctantVaultCardWalletPosition(
      {
        recoveredWalletAddress: "not-an-address" as Address,
        campaignSlug: "x",
        vaultAddress: VAULT_NYC,
        chainId: 1,
      },
      1000
    );
    expect(getOctantVaultCardWalletPositionRefs()).toHaveLength(0);
  });

  it("drops malformed stored entries on read", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          recoveredWalletAddress: WALLET_A,
          campaignSlug: "greenpill-nyc",
          vaultAddress: VAULT_NYC,
          chainId: 1,
          updatedAt: 1000,
        },
        { recoveredWalletAddress: "bad", chainId: 1 },
        "garbage",
      ])
    );
    const refs = getOctantVaultCardWalletPositionRefs();
    expect(refs).toHaveLength(1);
    expect(refs[0].recoveredWalletAddress).toBe(WALLET_A);
  });

  it("returns [] for non-JSON storage contents", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    expect(getOctantVaultCardWalletPositionRefs()).toEqual([]);
  });

  it("forgets all entries with no predicate", () => {
    rememberOctantVaultCardWalletPosition(
      {
        recoveredWalletAddress: WALLET_A,
        campaignSlug: "greenpill-nyc",
        vaultAddress: VAULT_NYC,
        chainId: 1,
      },
      1000
    );
    forgetOctantVaultCardWalletPositions();
    expect(getOctantVaultCardWalletPositionRefs()).toEqual([]);
  });

  it("forgets only matching entries with a predicate", () => {
    rememberOctantVaultCardWalletPosition(
      {
        recoveredWalletAddress: WALLET_A,
        campaignSlug: "greenpill-nyc",
        vaultAddress: VAULT_NYC,
        chainId: 1,
      },
      1000
    );
    rememberOctantVaultCardWalletPosition(
      {
        recoveredWalletAddress: WALLET_B,
        campaignSlug: "evmavericks",
        vaultAddress: VAULT_EVM,
        chainId: 1,
      },
      2000
    );
    forgetOctantVaultCardWalletPositions((ref) => ref.recoveredWalletAddress === WALLET_A);
    const refs = getOctantVaultCardWalletPositionRefs();
    expect(refs).toHaveLength(1);
    expect(refs[0].recoveredWalletAddress).toBe(WALLET_B);
  });
});
