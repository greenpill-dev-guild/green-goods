import { describe, expect, it } from "vitest";
import {
  EVMAVERICKS_REQUIRED_MANIFEST_FIELDS,
  GREENPILL_NYC_REQUIRED_MANIFEST_FIELDS,
  getOctantVaultCampaignBySlug,
  getOctantVaultCampaigns,
  getOctantVaultCampaignTransactionState,
  isOctantVaultCampaignTransactionReady,
  validateOctantVaultCardEndowProof,
  validateOctantVaultCardEndowReceiver,
  validateOctantVaultCampaignManifest,
  type OctantVaultCardEndowProofExpectation,
  type OctantVaultCardEndowProofInput,
  type OctantVaultCampaignManifest,
} from "../../modules/vault-crowdfunding";

const OCTANT_V2_ETHEREUM_CHAIN_ID = 1;
const VALID_RECEIVER_ADDRESS = "0x3333333333333333333333333333333333333333";
const VALID_TRANSACTION_HASH = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const VALID_AMOUNT = "2500000";

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

function makeCardEndowProof(
  overrides: Partial<OctantVaultCardEndowProofInput> = {}
): OctantVaultCardEndowProofInput {
  const base: OctantVaultCardEndowProofInput = {
    intentKind: "card_endow",
    provider: "thirdweb",
    paymentMethod: "card",
    chainId: OCTANT_V2_ETHEREUM_CHAIN_ID,
    vaultAddress: "0x1111111111111111111111111111111111111111",
    destinationAddress: "0x1111111111111111111111111111111111111111",
    asset: {
      address: "0x2222222222222222222222222222222222222222",
      symbol: "USDC",
      decimals: 6,
    },
    amount: VALID_AMOUNT,
    receiverAddress: VALID_RECEIVER_ADDRESS,
    receiverCustody: "user_owned_recovered_wallet",
    transactionHash: VALID_TRANSACTION_HASH,
  };

  return {
    ...base,
    ...overrides,
    asset: {
      ...base.asset,
      ...overrides.asset,
    },
  };
}

function makeCardEndowExpectation(
  campaign: OctantVaultCampaignManifest = makeCompleteManifest()
): OctantVaultCardEndowProofExpectation {
  return {
    campaign,
    amount: VALID_AMOUNT,
    receiverAddress: VALID_RECEIVER_ADDRESS,
    transactionHash: VALID_TRANSACTION_HASH,
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

describe("Octant vault Card Endow public contracts", () => {
  it("rejects missing or invalid recovered-wallet receivers", () => {
    expect(
      validateOctantVaultCardEndowReceiver({
        receiverCustody: "user_owned_recovered_wallet",
      })
    ).toMatchObject({
      status: "invalid",
      errors: ["receiver_required"],
    });
    expect(
      validateOctantVaultCardEndowReceiver({
        receiverAddress: "0xnot-an-address",
        receiverCustody: "user_owned_recovered_wallet",
      })
    ).toMatchObject({
      status: "invalid",
      errors: ["receiver_invalid"],
    });
  });

  it("rejects provider-owned Card Endow custody", () => {
    expect(
      validateOctantVaultCardEndowReceiver({
        receiverAddress: VALID_RECEIVER_ADDRESS,
        receiverCustody: "provider_owned_custody",
      })
    ).toMatchObject({
      status: "invalid",
      errors: ["provider_owned_receiver"],
    });
    expect(
      validateOctantVaultCardEndowProof(
        makeCardEndowProof({ receiverCustody: "provider_owned_custody" }),
        makeCardEndowExpectation()
      )
    ).toMatchObject({
      status: "invalid",
      errors: expect.arrayContaining(["provider_owned_receiver"]),
    });
  });

  it("accepts an exact Card Endow tuple only for complete fixtures", () => {
    const completeManifest = makeCompleteManifest();
    const evmavericks = getOctantVaultCampaignBySlug("evmavericks");

    expect(
      validateOctantVaultCardEndowProof(
        makeCardEndowProof(),
        makeCardEndowExpectation(completeManifest)
      )
    ).toMatchObject({
      status: "valid",
      errors: [],
    });
    expect(evmavericks).toBeDefined();
    expect(
      validateOctantVaultCardEndowProof(
        makeCardEndowProof(),
        makeCardEndowExpectation(evmavericks!)
      )
    ).toMatchObject({
      status: "invalid",
      errors: expect.arrayContaining(["manifest_incomplete"]),
    });
  });

  it.each([
    ["chain", { chainId: 42161 }, "chain_mismatch"],
    ["vault", { vaultAddress: "0x4444444444444444444444444444444444444444" }, "vault_mismatch"],
    [
      "destination",
      { destinationAddress: "0x4444444444444444444444444444444444444444" },
      "destination_mismatch",
    ],
    [
      "asset address",
      { asset: { address: "0x4444444444444444444444444444444444444444" } },
      "asset_address_mismatch",
    ],
    ["asset symbol", { asset: { symbol: "DAI" } }, "asset_symbol_mismatch"],
    ["asset decimals", { asset: { decimals: 18 } }, "asset_decimals_mismatch"],
    ["amount", { amount: "2500001" }, "amount_mismatch"],
    [
      "receiver",
      { receiverAddress: "0x4444444444444444444444444444444444444444" },
      "receiver_mismatch",
    ],
    ["intent", { intentKind: "wallet_endow" }, "intent_mismatch"],
  ])("rejects a mismatched Card Endow %s tuple", (_label, overrides, expectedError) => {
    expect(
      validateOctantVaultCardEndowProof(makeCardEndowProof(overrides), makeCardEndowExpectation())
    ).toMatchObject({
      status: "invalid",
      errors: expect.arrayContaining([expectedError]),
    });
  });

  it.each([
    ["missing provider", { provider: undefined }, "provider_mismatch"],
    ["wrong provider", { provider: "coinbase" }, "provider_mismatch"],
    ["missing payment method", { paymentMethod: undefined }, "payment_method_mismatch"],
    ["wrong payment method", { paymentMethod: "wallet" }, "payment_method_mismatch"],
    ["missing transaction hash", { transactionHash: undefined }, "transaction_hash_mismatch"],
    [
      "malformed transaction hash",
      { transactionHash: "0xnot-a-transaction" },
      "transaction_hash_mismatch",
    ],
    ["missing destination", { destinationAddress: undefined }, "destination_mismatch"],
    ["malformed destination", { destinationAddress: "0xnot-an-address" }, "destination_mismatch"],
    ["missing asset address", { asset: { address: undefined } }, "asset_address_mismatch"],
    [
      "malformed asset address",
      { asset: { address: "0xnot-an-address" } },
      "asset_address_mismatch",
    ],
    ["missing asset symbol", { asset: { symbol: undefined } }, "asset_symbol_mismatch"],
    ["missing asset decimals", { asset: { decimals: undefined } }, "asset_decimals_mismatch"],
  ])("rejects malformed Card Endow proof input: %s", (_label, overrides, expectedError) => {
    expect(
      validateOctantVaultCardEndowProof(makeCardEndowProof(overrides), makeCardEndowExpectation())
    ).toMatchObject({
      status: "invalid",
      errors: expect.arrayContaining([expectedError]),
    });
  });

  it("rejects a Card Endow proof when the manifest is missing vault metadata", () => {
    expect(
      validateOctantVaultCardEndowProof(
        makeCardEndowProof(),
        makeCardEndowExpectation(makeCompleteManifest({ vault: undefined }))
      )
    ).toMatchObject({
      status: "invalid",
      errors: expect.arrayContaining(["manifest_incomplete"]),
    });
  });

  it("does not let Card Donate proof unlock Card Endow", () => {
    expect(
      validateOctantVaultCardEndowProof(
        makeCardEndowProof({ intentKind: "card_donate" }),
        makeCardEndowExpectation()
      )
    ).toMatchObject({
      status: "invalid",
      errors: expect.arrayContaining(["intent_mismatch"]),
    });
  });

  it("keeps Phase 2 /vaults transaction flags unchanged", () => {
    const states = getOctantVaultCampaigns().map((campaign) =>
      getOctantVaultCampaignTransactionState(campaign)
    );

    expect(states).toEqual([
      {
        manifestStatus: "blocked_pending_manifest",
        status: "blocked_pending_manifest",
        walletEndowEnabled: false,
        cardEndowVisible: false,
        missingFields: GREENPILL_NYC_REQUIRED_MANIFEST_FIELDS,
        disabledReason: "manifest_incomplete",
      },
      {
        manifestStatus: "blocked_pending_manifest",
        status: "blocked_pending_manifest",
        walletEndowEnabled: false,
        cardEndowVisible: false,
        missingFields: EVMAVERICKS_REQUIRED_MANIFEST_FIELDS,
        disabledReason: "manifest_incomplete",
      },
    ]);
  });
});
