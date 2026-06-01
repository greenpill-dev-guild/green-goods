import { describe, expect, it } from "vitest";
import {
  EVMAVERICKS_REQUIRED_MANIFEST_FIELDS,
  GREENPILL_NYC_REQUIRED_MANIFEST_FIELDS,
  getOctantVaultCampaignBySlug,
  getOctantVaultCampaigns,
  getOctantVaultCampaignTransactionState,
  isOctantVaultCampaignTransactionReady,
  validateOctantVaultCampaignManifest,
  type OctantVaultCampaignManifest,
} from "../../modules/vault-crowdfunding";

const OCTANT_V2_ETHEREUM_CHAIN_ID = 1;

function makeCompleteManifest(
  overrides: Partial<OctantVaultCampaignManifest> = {}
): OctantVaultCampaignManifest {
  return {
    slug: "synthetic-complete",
    displayName: "Synthetic complete campaign",
    communityName: "Synthetic Community",
    fixtureRole: "standard_campaign",
    routePath: "/vaults",
    targetProtocol: "octant-v2-ethereum",
    campaignCopy: {
      headline: "Fund a complete Octant vault",
      summary: "A complete fixture for manifest validation.",
      fundingPurpose: "Support public-goods work through a dedicated vault.",
      recipientLogic: "Yield routes through the supplied recipient configuration.",
      riskNote: "Vault deposits depend on the underlying token and Octant vault strategy.",
    },
    vault: {
      chainId: OCTANT_V2_ETHEREUM_CHAIN_ID,
      vaultAddress: "0x1111111111111111111111111111111111111111",
      asset: {
        address: "0x2222222222222222222222222222222222222222",
        symbol: "USDC",
        decimals: 6,
      },
      explorerLink: "https://etherscan.io/address/0x1111111111111111111111111111111111111111",
    },
    recipientRoutingSummary: "Yield routes to a verified public-goods recipient.",
    protocolGuildDestinationContext: "Protocol Guild allocation context is recorded.",
    ...overrides,
  };
}

describe("Octant vault crowdfunding manifest", () => {
  it("keeps both pilot fixture slots in a stable order", () => {
    const campaigns = getOctantVaultCampaigns();

    expect(campaigns.map((campaign) => campaign.slug)).toEqual(["greenpill-nyc", "evmavericks"]);
    expect(campaigns[0]).toMatchObject({
      slug: "greenpill-nyc",
      fixtureRole: "first_available_transaction_fixture",
    });
    expect(campaigns[1]).toMatchObject({
      slug: "evmavericks",
      fixtureRole: "blocked_pending_manifest",
    });
  });

  it("keeps Greenpill NYC transaction disabled until complete deployed vault metadata is recorded", () => {
    const campaign = getOctantVaultCampaignBySlug("greenpill-nyc");

    expect(campaign).toBeDefined();
    expect(GREENPILL_NYC_REQUIRED_MANIFEST_FIELDS).toEqual([
      "chainId",
      "vaultAddress",
      "assetAddress",
      "assetSymbol",
      "assetDecimals",
      "recipientRoutingSummary",
      "explorerLink",
      "campaignCopy",
    ]);
    expect(getOctantVaultCampaignTransactionState(campaign!)).toMatchObject({
      status: "blocked_pending_manifest",
      missingFields: GREENPILL_NYC_REQUIRED_MANIFEST_FIELDS,
      walletEndowEnabled: false,
      cardEndowVisible: false,
    });
  });

  it("requires the Protocol Guild destination context before EVMavericks can enable transactions", () => {
    const campaign = getOctantVaultCampaignBySlug("evmavericks");

    expect(campaign).toBeDefined();
    expect(EVMAVERICKS_REQUIRED_MANIFEST_FIELDS).toContain("protocolGuildDestinationContext");
    expect(getOctantVaultCampaignTransactionState(campaign!)).toMatchObject({
      status: "blocked_pending_manifest",
      missingFields: EVMAVERICKS_REQUIRED_MANIFEST_FIELDS,
      walletEndowEnabled: false,
      cardEndowVisible: false,
    });
  });

  it("validates a complete Octant V2 Ethereum vault manifest", () => {
    const completeManifest = makeCompleteManifest();

    expect(validateOctantVaultCampaignManifest(completeManifest)).toMatchObject({
      status: "complete",
      missingFields: [],
    });
  });

  it("does not treat a complete manifest as executable Wallet Endow readiness in Phase 2", () => {
    const completeManifest = makeCompleteManifest();

    expect(isOctantVaultCampaignTransactionReady(completeManifest)).toBe(false);
    expect(getOctantVaultCampaignTransactionState(completeManifest)).toMatchObject({
      manifestStatus: "complete",
      status: "blocked_pending_wallet_endow",
      walletEndowEnabled: false,
      cardEndowVisible: false,
      disabledReason: "wallet_endow_not_implemented",
    });
  });

  it("keeps non-Ethereum or mismatched explorer tuples blocked", () => {
    const wrongChainManifest = makeCompleteManifest({
      vault: {
        ...makeCompleteManifest().vault!,
        chainId: 42161,
      },
    });
    const mismatchedExplorerManifest = makeCompleteManifest({
      vault: {
        ...makeCompleteManifest().vault!,
        explorerLink: "https://etherscan.io/address/0x3333333333333333333333333333333333333333",
      },
    });

    expect(validateOctantVaultCampaignManifest(wrongChainManifest)).toMatchObject({
      status: "blocked_pending_manifest",
      missingFields: ["chainId"],
    });
    expect(validateOctantVaultCampaignManifest(mismatchedExplorerManifest)).toMatchObject({
      status: "blocked_pending_manifest",
      missingFields: ["explorerLink"],
    });
  });
});
