import { describe, expect, it } from "vitest";
import enMessages from "../../i18n/en.json";
import {
  EVMAVERICKS_REQUIRED_MANIFEST_FIELDS,
  GREENPILL_NYC_REQUIRED_MANIFEST_FIELDS,
  getOctantVaultAssetDisplayPolicy,
  hasRequiredOctantVaultFundingBalance,
  getOctantVaultCampaignBySlug,
  getOctantVaultCampaignCopy,
  getOctantVaultCampaignCopyMessageIds,
  getOctantVaultCampaigns,
  getOctantVaultCampaignTransactionState,
  OCTANT_VAULT_CAMPAIGN_COPY_MESSAGE_IDS,
  OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS,
  OCTANT_VAULT_MANIFEST_FIELD_LABELS,
  OCTANT_VAULT_ROUTE_MANAGEMENT_URL,
  prepareOctantVaultCardEndowFallbackPlan,
  prepareOctantVaultCardEndowReadiness,
  isOctantVaultCampaignTransactionReady,
  meetsOctantVaultCardEndowUsdMinimum,
  OCTANT_VAULT_CARD_ENDOW_MIN_USD_CENTS,
  prepareOctantVaultWalletEndow,
  validateOctantVaultCardEndowManifest,
  validateOctantVaultCardEndowProof,
  validateOctantVaultCardEndowReceiver,
  validateOctantVaultCardOnrampCompletion,
  validateOctantVaultCardOnrampQuote,
  validateOctantVaultCampaignManifest,
  validateOctantVaultWalletEndowManifest,
  validateOctantVaultRouteManageProof,
  validateOctantVaultShareOwnershipProof,
  type OctantVaultCardEndowProofExpectation,
  type OctantVaultCardEndowProofInput,
  type OctantVaultCardOnrampCompletionExpectation,
  type OctantVaultCardOnrampRouteExpectation,
  type OctantVaultCampaignManifest,
} from "../../modules/vault-crowdfunding";

const OCTANT_V2_ETHEREUM_CHAIN_ID = 1;
const VALID_RECEIVER_ADDRESS = "0x3333333333333333333333333333333333333333";
const VALID_TRANSACTION_HASH = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const VALID_AMOUNT = "2500000";
const MAINNET_WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

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
      fundingPurpose: "Support public goods work through a dedicated vault.",
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
    recipientRoutingSummary: "Yield routes to a verified public goods recipient.",
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

function makeCardEndowProofForCampaign(
  campaign: OctantVaultCampaignManifest,
  overrides: Partial<OctantVaultCardEndowProofInput> = {}
): OctantVaultCardEndowProofInput {
  return makeCardEndowProof({
    chainId: campaign.vault?.chainId,
    vaultAddress: campaign.vault?.vaultAddress,
    destinationAddress: campaign.vault?.vaultAddress,
    asset: campaign.vault?.asset,
    ...overrides,
  });
}

function makeShareOwnershipProof(overrides = {}) {
  return {
    campaign: makeCompleteManifest(),
    ownerAddress: VALID_RECEIVER_ADDRESS,
    receiverAddress: VALID_RECEIVER_ADDRESS,
    vaultAddress: "0x1111111111111111111111111111111111111111",
    shareBalance: "1000",
    sharesVisible: true,
    ...overrides,
  };
}

function makeShareOwnershipProofForCampaign(campaign: OctantVaultCampaignManifest, overrides = {}) {
  return makeShareOwnershipProof({
    campaign,
    vaultAddress: campaign.vault?.vaultAddress,
    ...overrides,
  });
}

function makeRouteManageProof(overrides = {}) {
  return {
    campaign: makeCompleteManifest(),
    ownerAddress: VALID_RECEIVER_ADDRESS,
    receiverAddress: VALID_RECEIVER_ADDRESS,
    vaultAddress: "0x1111111111111111111111111111111111111111",
    routePath: "/vaults",
    managementUrl: OCTANT_VAULT_ROUTE_MANAGEMENT_URL,
    sharesVisible: true,
    withdrawAvailable: true,
    ...overrides,
  };
}

function makeRouteManageProofForCampaign(campaign: OctantVaultCampaignManifest, overrides = {}) {
  return makeRouteManageProof({
    campaign,
    vaultAddress: campaign.vault?.vaultAddress,
    ...overrides,
  });
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
      fixtureRole: "standard_campaign",
    });
  });

  it("returns defensive copies of campaign manifests", () => {
    const campaigns = getOctantVaultCampaigns();
    const campaign = campaigns[0]!;

    campaign.displayName = "Mutated display";
    campaign.vault!.asset!.symbol = "MUTATED";
    campaign.campaignCopy!.headline = "Mutated headline";
    (campaign.requiredManifestFields as string[]).push("protocolGuildDestinationContext");

    const freshCampaign = getOctantVaultCampaignBySlug("greenpill-nyc");

    expect(freshCampaign?.displayName).toBe("Greenpill NYC");
    expect(freshCampaign?.vault?.asset?.symbol).toBe("WETH");
    expect(freshCampaign?.campaignCopy?.headline).toBe(
      "From local gatherings to onchain funding for local civic tech."
    );
    expect(freshCampaign?.requiredManifestFields).toEqual(GREENPILL_NYC_REQUIRED_MANIFEST_FIELDS);
  });

  it("records Greenpill NYC chain metadata and production-QA manifest completion", () => {
    const campaign = getOctantVaultCampaignBySlug("greenpill-nyc");

    expect(campaign).toBeDefined();
    expect(campaign?.vault).toMatchObject({
      chainId: 1,
      vaultAddress: "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5",
      asset: {
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        symbol: "WETH",
        decimals: 18,
      },
      explorerLink: "https://etherscan.io/address/0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5",
    });
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
      status: "ready",
      missingFields: [],
      walletEndowEnabled: true,
      cardEndowVisible: false,
      cardEndowStatus: "hidden_pending_proof",
    });
    expect(campaign?.campaignCopy).toBeDefined();
    expect(campaign?.recipientRoutingSummary).toContain("Decentral Park");
  });

  it("records both deployed pilot vaults as mainnet WETH vaults", () => {
    const greenpillNyc = getOctantVaultCampaignBySlug("greenpill-nyc");
    const evmavericks = getOctantVaultCampaignBySlug("evmavericks");

    expect(greenpillNyc?.vault).toMatchObject({
      chainId: 1,
      vaultName: "Greenpill NYC",
      vaultSymbol: "gpWETH",
      vaultDecimals: 18,
      asset: {
        address: MAINNET_WETH_ADDRESS,
        symbol: "WETH",
        decimals: 18,
      },
    });
    expect(evmavericks?.vault).toMatchObject({
      chainId: 1,
      vaultName: "EVMavs PGF",
      vaultSymbol: "evmWETH",
      vaultDecimals: 18,
      asset: {
        address: MAINNET_WETH_ADDRESS,
        symbol: "WETH",
        decimals: 18,
      },
    });
  });

  it("keeps WETH technical while presenting ETH as the donor amount label", () => {
    expect(getOctantVaultAssetDisplayPolicy("WETH")).toEqual({
      donorSymbol: "ETH",
      settlementSymbol: "WETH",
      technicalSymbol: "WETH",
    });
    expect(getOctantVaultAssetDisplayPolicy("USDC")).toEqual({
      donorSymbol: "USDC",
      settlementSymbol: "USDC",
      technicalSymbol: "USDC",
    });
  });

  it("keeps EVMavericks wallet and card tuples ready from deployed vault metadata", () => {
    const campaign = getOctantVaultCampaignBySlug("evmavericks");

    expect(campaign).toBeDefined();
    expect(EVMAVERICKS_REQUIRED_MANIFEST_FIELDS).toContain("protocolGuildDestinationContext");
    expect(validateOctantVaultCampaignManifest(campaign!)).toMatchObject({
      status: "blocked_pending_manifest",
      missingFields: ["recipientRoutingSummary", "protocolGuildDestinationContext", "campaignCopy"],
    });
    expect(validateOctantVaultWalletEndowManifest(campaign!)).toMatchObject({
      status: "complete",
      missingFields: [],
    });
    expect(validateOctantVaultCardEndowManifest(campaign!)).toMatchObject({
      status: "complete",
      missingFields: [],
    });
    expect(getOctantVaultCampaignTransactionState(campaign!)).toMatchObject({
      status: "ready",
      missingFields: ["recipientRoutingSummary", "protocolGuildDestinationContext", "campaignCopy"],
      walletEndowEnabled: true,
      cardEndowVisible: false,
      cardEndowStatus: "hidden_pending_proof",
    });
  });

  it("keeps EVMavericks preview copy from satisfying transaction-enabling fields", () => {
    const greenpillNyc = getOctantVaultCampaignBySlug("greenpill-nyc");
    const evmavericks = getOctantVaultCampaignBySlug("evmavericks");

    expect(greenpillNyc).toBeDefined();
    expect(evmavericks).toBeDefined();
    expect(greenpillNyc?.previewCopy).toBeDefined();
    expect(evmavericks?.previewCopy).toBeDefined();
    expect(getOctantVaultCampaignCopy(greenpillNyc!)).toEqual(greenpillNyc?.campaignCopy);
    expect(getOctantVaultCampaignCopy(evmavericks!)).toEqual(evmavericks?.previewCopy);
    expect(greenpillNyc?.campaignCopy).toBeDefined();
    expect(greenpillNyc?.recipientRoutingSummary).toBeDefined();
    expect(evmavericks?.campaignCopy).toBeUndefined();
    expect(evmavericks?.recipientRoutingSummary).toBeUndefined();
    expect(evmavericks?.protocolGuildDestinationContext).toBeUndefined();
    expect(validateOctantVaultCampaignManifest(greenpillNyc!)).toMatchObject({
      status: "complete",
      missingFields: [],
    });
    expect(validateOctantVaultCampaignManifest(evmavericks!)).toMatchObject({
      status: "blocked_pending_manifest",
      missingFields: ["recipientRoutingSummary", "protocolGuildDestinationContext", "campaignCopy"],
    });
    expect(validateOctantVaultWalletEndowManifest(evmavericks!)).toMatchObject({
      status: "complete",
      missingFields: [],
    });
    expect(validateOctantVaultCardEndowManifest(evmavericks!)).toMatchObject({
      status: "complete",
      missingFields: [],
    });
  });

  it("sources donor-facing campaign copy and field labels from shared locale keys", () => {
    const greenpillNyc = getOctantVaultCampaignBySlug("greenpill-nyc");
    const evmavericks = getOctantVaultCampaignBySlug("evmavericks");
    const fallbackCampaign = makeCompleteManifest({
      slug: "unlisted-campaign",
      displayName: "Unlisted campaign",
      campaignCopy: undefined,
      previewCopy: undefined,
    });

    expect(greenpillNyc).toBeDefined();
    expect(evmavericks).toBeDefined();
    expect(getOctantVaultCampaignCopyMessageIds(greenpillNyc!)).toBe(
      OCTANT_VAULT_CAMPAIGN_COPY_MESSAGE_IDS["greenpill-nyc"]
    );
    expect(getOctantVaultCampaignCopyMessageIds(evmavericks!)).toBe(
      OCTANT_VAULT_CAMPAIGN_COPY_MESSAGE_IDS.evmavericks
    );
    expect(getOctantVaultCampaignCopy(greenpillNyc!).headline).toBe(
      enMessages[OCTANT_VAULT_CAMPAIGN_COPY_MESSAGE_IDS["greenpill-nyc"].headline]
    );
    expect(getOctantVaultCampaignCopy(evmavericks!).summary).toBe(
      enMessages[OCTANT_VAULT_CAMPAIGN_COPY_MESSAGE_IDS.evmavericks.summary]
    );
    expect(OCTANT_VAULT_MANIFEST_FIELD_LABELS.protocolGuildDestinationContext).toBe(
      enMessages[OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS.protocolGuildDestinationContext]
    );
    expect(getOctantVaultCampaignCopy(fallbackCampaign)).toMatchObject({
      headline: "Unlisted campaign",
      summary: enMessages["public.vaults.campaign.fallback.summary"],
      fundingPurpose: enMessages["public.vaults.campaign.fallback.fundingPurpose"],
      recipientLogic: enMessages["public.vaults.campaign.fallback.recipientLogic"],
      riskNote: enMessages["public.vaults.campaign.fallback.riskNote"],
    });
  });

  it("validates a complete Octant V2 Ethereum vault manifest", () => {
    const completeManifest = makeCompleteManifest();

    expect(validateOctantVaultCampaignManifest(completeManifest)).toMatchObject({
      status: "complete",
      missingFields: [],
    });
  });

  it("enables Wallet Endow readiness only for a complete manifest", () => {
    const completeManifest = makeCompleteManifest();

    expect(isOctantVaultCampaignTransactionReady(completeManifest)).toBe(true);
    expect(getOctantVaultCampaignTransactionState(completeManifest)).toMatchObject({
      manifestStatus: "complete",
      status: "ready",
      walletEndowEnabled: true,
      cardEndowVisible: false,
      missingFields: [],
    });
  });

  it("prepares a Wallet Endow transaction for a complete synthetic fixture", () => {
    const completeManifest = makeCompleteManifest();

    expect(
      prepareOctantVaultWalletEndow({
        campaign: completeManifest,
        amount: 2500000n,
        receiverAddress: VALID_RECEIVER_ADDRESS,
      })
    ).toEqual({
      status: "ready",
      errors: [],
      transaction: {
        intentKind: "wallet_endow",
        paymentMethod: "wallet",
        chainId: 1,
        vaultAddress: "0x1111111111111111111111111111111111111111",
        assetAddress: "0x2222222222222222222222222222222222222222",
        assetSymbol: "USDC",
        assetDecimals: 6,
        amount: 2500000n,
        receiver: {
          intentKind: "wallet_endow",
          paymentMethod: "wallet",
          receiverKind: "connected_wallet",
          receiverCustody: "connected_wallet",
          receiverAddress: VALID_RECEIVER_ADDRESS,
        },
      },
    });
  });

  it("prepares Wallet Endow for EVMavericks and blocks invalid confirmation input", () => {
    const evmavericks = getOctantVaultCampaignBySlug("evmavericks");
    const completeManifest = makeCompleteManifest();

    expect(evmavericks).toBeDefined();
    expect(
      prepareOctantVaultWalletEndow({
        campaign: evmavericks!,
        amount: 2500000n,
        receiverAddress: VALID_RECEIVER_ADDRESS,
      })
    ).toEqual({
      status: "ready",
      errors: [],
      transaction: {
        intentKind: "wallet_endow",
        paymentMethod: "wallet",
        chainId: 1,
        vaultAddress: "0x0bCe8c16974FFD3B410A32365c5bCf27a5A630Fc",
        assetAddress: MAINNET_WETH_ADDRESS,
        assetSymbol: "WETH",
        assetDecimals: 18,
        amount: 2500000n,
        receiver: {
          intentKind: "wallet_endow",
          paymentMethod: "wallet",
          receiverKind: "connected_wallet",
          receiverCustody: "connected_wallet",
          receiverAddress: VALID_RECEIVER_ADDRESS,
        },
      },
    });
    expect(
      prepareOctantVaultWalletEndow({
        campaign: completeManifest,
        amount: 0n,
        receiverAddress: VALID_RECEIVER_ADDRESS,
      })
    ).toMatchObject({
      status: "blocked",
      errors: expect.arrayContaining(["amount_required"]),
    });
    expect(
      prepareOctantVaultWalletEndow({
        campaign: completeManifest,
        amount: 2500000n,
      })
    ).toMatchObject({
      status: "blocked",
      errors: expect.arrayContaining(["receiver_required"]),
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
  it("prepares the fallback plan by funding the recovered wallet before user-authorized approval and deposit", () => {
    const campaign = makeCompleteManifest();

    expect(
      prepareOctantVaultCardEndowFallbackPlan({
        campaign,
        amount: VALID_AMOUNT,
        receiverAddress: VALID_RECEIVER_ADDRESS,
      })
    ).toEqual({
      status: "ready",
      errors: [],
      plan: {
        providerFlow: "fund_recovered_wallet_then_user_authorized_deposit",
        cardFunding: {
          provider: "thirdweb",
          paymentMethod: "card",
          chainId: 1,
          destinationAddress: VALID_RECEIVER_ADDRESS,
          tokenAddress: "0x2222222222222222222222222222222222222222",
          tokenSymbol: "USDC",
          tokenDecimals: 6,
          amount: VALID_AMOUNT,
          receiverAddress: VALID_RECEIVER_ADDRESS,
        },
        receiptExpectation: {
          sourceRoute: "/vaults",
          managementUrl: OCTANT_VAULT_ROUTE_MANAGEMENT_URL,
          expectedVaultAddress: "0x1111111111111111111111111111111111111111",
          expectedTokenAddress: "0x2222222222222222222222222222222222222222",
          expectedAmount: VALID_AMOUNT,
          receiverAddress: VALID_RECEIVER_ADDRESS,
        },
        userAuthorizedTransactions: [
          {
            role: "approval",
            chainId: 1,
            contractAddress: "0x2222222222222222222222222222222222222222",
            functionName: "approve",
            args: ["0x1111111111111111111111111111111111111111", VALID_AMOUNT],
          },
          {
            role: "funding",
            chainId: 1,
            contractAddress: "0x1111111111111111111111111111111111111111",
            functionName: "deposit",
            args: [VALID_AMOUNT, VALID_RECEIVER_ADDRESS],
          },
        ],
        shareVerification: {
          role: "share_verification",
          chainId: 1,
          contractAddress: "0x1111111111111111111111111111111111111111",
          functionName: "balanceOf",
          args: [VALID_RECEIVER_ADDRESS],
          expectedResult: "positive_share_balance",
        },
      },
    });
  });

  it("keeps pilot wallet and card fallback plans on WETH ERC20 approval/deposit", () => {
    const greenpillNyc = getOctantVaultCampaignBySlug("greenpill-nyc");

    expect(greenpillNyc).toBeDefined();
    expect(
      prepareOctantVaultWalletEndow({
        campaign: greenpillNyc!,
        amount: 10000000000000000n,
        receiverAddress: VALID_RECEIVER_ADDRESS,
      })
    ).toMatchObject({
      status: "ready",
      transaction: {
        chainId: 1,
        assetAddress: MAINNET_WETH_ADDRESS,
        assetSymbol: "WETH",
        assetDecimals: 18,
        amount: 10000000000000000n,
      },
    });

    const fallback = prepareOctantVaultCardEndowFallbackPlan({
      campaign: greenpillNyc!,
      amount: "10000000000000000",
      receiverAddress: VALID_RECEIVER_ADDRESS,
    });

    expect(fallback).toMatchObject({
      status: "ready",
      plan: {
        cardFunding: {
          chainId: 1,
          tokenAddress: MAINNET_WETH_ADDRESS,
          tokenSymbol: "WETH",
          tokenDecimals: 18,
        },
        userAuthorizedTransactions: [
          {
            role: "approval",
            functionName: "approve",
            contractAddress: MAINNET_WETH_ADDRESS,
          },
          {
            role: "funding",
            functionName: "deposit",
            contractAddress: greenpillNyc!.vault?.vaultAddress,
            args: ["10000000000000000", VALID_RECEIVER_ADDRESS],
          },
        ],
      },
    });
    expect(JSON.stringify(fallback)).not.toMatch(/payable|msg\.value|native_eth/i);
  });

  it("prepares EVMavericks fallback Card Endow and blocks invalid receiver input", () => {
    const evmavericks = getOctantVaultCampaignBySlug("evmavericks");
    const completeManifest = makeCompleteManifest();

    expect(evmavericks).toBeDefined();
    const fallback = prepareOctantVaultCardEndowFallbackPlan({
      campaign: evmavericks!,
      amount: VALID_AMOUNT,
      receiverAddress: VALID_RECEIVER_ADDRESS,
    });

    expect(fallback).toMatchObject({
      status: "ready",
      plan: {
        cardFunding: {
          chainId: 1,
          tokenAddress: MAINNET_WETH_ADDRESS,
          tokenSymbol: "WETH",
          tokenDecimals: 18,
        },
        receiptExpectation: {
          expectedVaultAddress: evmavericks!.vault?.vaultAddress,
          expectedTokenAddress: MAINNET_WETH_ADDRESS,
        },
        userAuthorizedTransactions: [
          {
            role: "approval",
            functionName: "approve",
            contractAddress: MAINNET_WETH_ADDRESS,
          },
          {
            role: "funding",
            functionName: "deposit",
            contractAddress: evmavericks!.vault?.vaultAddress,
            args: [VALID_AMOUNT, VALID_RECEIVER_ADDRESS],
          },
        ],
      },
    });
    expect(
      prepareOctantVaultCardEndowFallbackPlan({
        campaign: completeManifest,
        amount: "0",
        receiverAddress: VALID_RECEIVER_ADDRESS,
      })
    ).toMatchObject({
      status: "blocked",
      errors: expect.arrayContaining(["amount_required"]),
    });
    expect(
      prepareOctantVaultCardEndowFallbackPlan({
        campaign: completeManifest,
        amount: VALID_AMOUNT,
        receiverAddress: "0xnot-an-address",
      })
    ).toMatchObject({
      status: "blocked",
      errors: expect.arrayContaining(["receiver_invalid"]),
    });
  });

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

  it("accepts an exact Card Endow tuple for transaction-ready fixtures", () => {
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
        makeCardEndowProofForCampaign(evmavericks!),
        makeCardEndowExpectation(evmavericks!)
      )
    ).toMatchObject({
      status: "valid",
      errors: [],
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

  it("keeps both pilots wallet-ready and Card Endow proof-gated", () => {
    const states = getOctantVaultCampaigns().map((campaign) =>
      getOctantVaultCampaignTransactionState(campaign)
    );

    expect(states).toEqual([
      {
        manifestStatus: "complete",
        status: "ready",
        walletEndowEnabled: true,
        cardEndowVisible: false,
        cardEndowStatus: "hidden_pending_proof",
        cardEndowProofErrors: undefined,
        missingFields: [],
      },
      {
        manifestStatus: "blocked_pending_manifest",
        status: "ready",
        walletEndowEnabled: true,
        cardEndowVisible: false,
        cardEndowStatus: "hidden_pending_proof",
        missingFields: [
          "recipientRoutingSummary",
          "protocolGuildDestinationContext",
          "campaignCopy",
        ],
        cardEndowProofErrors: undefined,
      },
    ]);
  });

  it("requires recovered-wallet share ownership and route-local manage proof before Card Endow visibility", () => {
    const campaign = makeCompleteManifest();
    const readiness = prepareOctantVaultCardEndowReadiness({
      campaign,
      amount: VALID_AMOUNT,
      receiverAddress: VALID_RECEIVER_ADDRESS,
      transactionHash: VALID_TRANSACTION_HASH,
      providerProof: makeCardEndowProof(),
      shareProof: makeShareOwnershipProof({ campaign }),
      manageProof: makeRouteManageProof({ campaign }),
    });

    expect(readiness).toMatchObject({
      status: "ready",
      cardEndowVisible: true,
      tuple: {
        intentKind: "card_endow",
        paymentMethod: "card",
        chainId: 1,
        vaultAddress: "0x1111111111111111111111111111111111111111",
        tokenAddress: "0x2222222222222222222222222222222222222222",
        amount: VALID_AMOUNT,
        destinationAddress: "0x1111111111111111111111111111111111111111",
        receiverAddress: VALID_RECEIVER_ADDRESS,
      },
    });
    expect(
      getOctantVaultCampaignTransactionState(campaign, { cardEndowReadiness: readiness })
    ).toMatchObject({
      cardEndowVisible: true,
      cardEndowStatus: "visible",
    });
  });

  it("rejects Card Endow readiness when shares are provider-owned, hidden, or not withdrawable from /vaults", () => {
    const campaign = makeCompleteManifest();

    expect(
      validateOctantVaultShareOwnershipProof(
        makeShareOwnershipProof({
          campaign,
          ownerAddress: "0x4444444444444444444444444444444444444444",
        })
      )
    ).toMatchObject({
      status: "invalid",
      errors: expect.arrayContaining(["owner_receiver_mismatch"]),
    });
    expect(
      validateOctantVaultShareOwnershipProof(
        makeShareOwnershipProof({
          campaign,
          sharesVisible: false,
        })
      )
    ).toMatchObject({
      status: "invalid",
      errors: expect.arrayContaining(["shares_not_visible"]),
    });
    expect(
      validateOctantVaultRouteManageProof(
        makeRouteManageProof({
          campaign,
          managementUrl: "/fund?manage=endowments",
          withdrawAvailable: false,
        })
      )
    ).toMatchObject({
      status: "invalid",
      errors: expect.arrayContaining(["management_url_mismatch", "withdraw_unavailable"]),
    });
  });

  it("exposes both pilot vaults with exact Card Endow proof", () => {
    const greenpillNyc = getOctantVaultCampaignBySlug("greenpill-nyc");
    const evmavericks = getOctantVaultCampaignBySlug("evmavericks");

    expect(greenpillNyc).toBeDefined();
    expect(evmavericks).toBeDefined();
    expect(
      prepareOctantVaultCardEndowReadiness({
        campaign: greenpillNyc!,
        amount: VALID_AMOUNT,
        receiverAddress: VALID_RECEIVER_ADDRESS,
        transactionHash: VALID_TRANSACTION_HASH,
        providerProof: makeCardEndowProofForCampaign(greenpillNyc!),
        shareProof: makeShareOwnershipProofForCampaign(greenpillNyc!),
        manageProof: makeRouteManageProofForCampaign(greenpillNyc!),
      })
    ).toMatchObject({
      status: "ready",
      cardEndowVisible: true,
      errors: [],
    });
    expect(
      prepareOctantVaultCardEndowReadiness({
        campaign: evmavericks!,
        amount: VALID_AMOUNT,
        receiverAddress: VALID_RECEIVER_ADDRESS,
        transactionHash: VALID_TRANSACTION_HASH,
        providerProof: makeCardEndowProofForCampaign(evmavericks!),
        shareProof: makeShareOwnershipProofForCampaign(evmavericks!),
        manageProof: makeRouteManageProofForCampaign(evmavericks!),
      })
    ).toMatchObject({
      status: "ready",
      cardEndowVisible: true,
      errors: [],
    });
  });
});

describe("Octant vault card onramp route proof", () => {
  const ROUTE_EXPECTATION: OctantVaultCardOnrampRouteExpectation = {
    chainId: OCTANT_V2_ETHEREUM_CHAIN_ID,
    tokenAddress: MAINNET_WETH_ADDRESS,
    receiverAddress: VALID_RECEIVER_ADDRESS,
    amount: "10000000000000000",
  };
  const COMPLETION_EXPECTATION: OctantVaultCardOnrampCompletionExpectation = {
    ...ROUTE_EXPECTATION,
    campaignSlug: "greenpill-nyc",
    vaultAddress: "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5",
  };

  it("accepts an exact WETH quote for the recovered receiver", () => {
    expect(
      validateOctantVaultCardOnrampQuote(
        {
          chainId: 1,
          tokenAddress: MAINNET_WETH_ADDRESS.toLowerCase(),
          receiver: VALID_RECEIVER_ADDRESS,
          amount: "10000000000000000",
          destinationAmount: 10000000000000000n,
        },
        ROUTE_EXPECTATION
      )
    ).toEqual({ status: "valid", errors: [] });
  });

  it("confirms the amount through destinationAmount alone when the intent omits it", () => {
    expect(
      validateOctantVaultCardOnrampQuote(
        {
          chainId: 1,
          tokenAddress: MAINNET_WETH_ADDRESS,
          receiver: VALID_RECEIVER_ADDRESS,
          destinationAmount: 10000000000000000n,
        },
        ROUTE_EXPECTATION
      )
    ).toEqual({ status: "valid", errors: [] });
  });

  it("fails each mismatched route field", () => {
    expect(
      validateOctantVaultCardOnrampQuote(
        {
          chainId: 137,
          tokenAddress: MAINNET_WETH_ADDRESS,
          receiver: VALID_RECEIVER_ADDRESS,
          destinationAmount: 10000000000000000n,
        },
        ROUTE_EXPECTATION
      ).errors
    ).toContain("chain_mismatch");

    expect(
      validateOctantVaultCardOnrampQuote(
        {
          chainId: 1,
          tokenAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
          receiver: VALID_RECEIVER_ADDRESS,
          destinationAmount: 10000000000000000n,
        },
        ROUTE_EXPECTATION
      ).errors
    ).toContain("token_mismatch");

    expect(
      validateOctantVaultCardOnrampQuote(
        {
          chainId: 1,
          tokenAddress: MAINNET_WETH_ADDRESS,
          receiver: "0x9999999999999999999999999999999999999999",
          destinationAmount: 10000000000000000n,
        },
        ROUTE_EXPECTATION
      ).errors
    ).toContain("receiver_mismatch");

    expect(
      validateOctantVaultCardOnrampQuote(
        {
          chainId: 1,
          tokenAddress: MAINNET_WETH_ADDRESS,
          receiver: VALID_RECEIVER_ADDRESS,
          destinationAmount: 9999999999999999n,
        },
        ROUTE_EXPECTATION
      ).errors
    ).toContain("amount_mismatch");

    // A contradicting intent amount fails even when destinationAmount matches.
    expect(
      validateOctantVaultCardOnrampQuote(
        {
          chainId: 1,
          tokenAddress: MAINNET_WETH_ADDRESS,
          receiver: VALID_RECEIVER_ADDRESS,
          amount: "20000000000000000",
          destinationAmount: 10000000000000000n,
        },
        ROUTE_EXPECTATION
      ).errors
    ).toContain("amount_mismatch");
  });

  it("rejects a quote that confirms nothing about the amount or is missing entirely", () => {
    expect(
      validateOctantVaultCardOnrampQuote(
        {
          chainId: 1,
          tokenAddress: MAINNET_WETH_ADDRESS,
          receiver: VALID_RECEIVER_ADDRESS,
        },
        ROUTE_EXPECTATION
      ).errors
    ).toContain("amount_mismatch");
    expect(validateOctantVaultCardOnrampQuote(null, ROUTE_EXPECTATION)).toEqual({
      status: "invalid",
      errors: ["quote_missing"],
    });
    // Empty intent (no echoed route facts) cannot prove the route.
    const emptyQuote = validateOctantVaultCardOnrampQuote({}, ROUTE_EXPECTATION);
    expect(emptyQuote.status).toBe("invalid");
    expect(emptyQuote.errors).toEqual(
      expect.arrayContaining([
        "chain_mismatch",
        "token_mismatch",
        "receiver_mismatch",
        "amount_mismatch",
      ])
    );
  });

  it("accepts COMPLETED with an absent or exactly-matching purchase tuple", () => {
    expect(
      validateOctantVaultCardOnrampCompletion({ status: "COMPLETED" }, COMPLETION_EXPECTATION)
    ).toEqual({ status: "valid", errors: [] });
    expect(
      validateOctantVaultCardOnrampCompletion(
        {
          status: "COMPLETED",
          purchaseData: {
            intent: "octant_vault_card_endow",
            route: "/vaults",
            campaignSlug: "greenpill-nyc",
            vaultAddress: "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5",
            tokenAddress: MAINNET_WETH_ADDRESS,
            receiverAddress: VALID_RECEIVER_ADDRESS,
            amount: "10000000000000000",
          },
        },
        COMPLETION_EXPECTATION
      )
    ).toEqual({ status: "valid", errors: [] });
  });

  it("rejects non-COMPLETED statuses and contradicting purchase tuples", () => {
    expect(
      validateOctantVaultCardOnrampCompletion({ status: "PENDING" }, COMPLETION_EXPECTATION).errors
    ).toContain("status_not_completed");

    const contradiction = validateOctantVaultCardOnrampCompletion(
      {
        status: "COMPLETED",
        purchaseData: {
          intent: "card_donate",
          route: "/fund",
          campaignSlug: "another-campaign",
          vaultAddress: "0x0bCe8c16974FFD3B410A32365c5bCf27a5A630Fc",
          tokenAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
          receiverAddress: "0x9999999999999999999999999999999999999999",
          amount: "1",
        },
      },
      COMPLETION_EXPECTATION
    );
    expect(contradiction.status).toBe("invalid");
    expect(contradiction.errors).toEqual(
      expect.arrayContaining([
        "intent_contradiction",
        "route_contradiction",
        "campaign_contradiction",
        "vault_contradiction",
        "token_contradiction",
        "receiver_contradiction",
        "amount_contradiction",
      ])
    );
  });

  it("requires the WETH funding balance to cover the expected amount", () => {
    expect(hasRequiredOctantVaultFundingBalance(10000000000000000n, "10000000000000000")).toBe(
      true
    );
    expect(hasRequiredOctantVaultFundingBalance(10000000000000001n, "10000000000000000")).toBe(
      true
    );
    expect(hasRequiredOctantVaultFundingBalance("10000000000000000", "10000000000000000")).toBe(
      true
    );
    expect(hasRequiredOctantVaultFundingBalance(9999999999999999n, "10000000000000000")).toBe(
      false
    );
    expect(hasRequiredOctantVaultFundingBalance(0n, "10000000000000000")).toBe(false);
    expect(hasRequiredOctantVaultFundingBalance(null, "10000000000000000")).toBe(false);
    expect(hasRequiredOctantVaultFundingBalance(undefined, "10000000000000000")).toBe(false);
    expect(hasRequiredOctantVaultFundingBalance(10000000000000000n, "not-a-number")).toBe(false);
  });
});

describe("Octant vault Card Endow USD minimum", () => {
  it("pins the provider minimum at $2.00 in cents", () => {
    expect(OCTANT_VAULT_CARD_ENDOW_MIN_USD_CENTS).toBe(200n);
  });

  it("rejects null and sub-minimum amounts and accepts the minimum and above", () => {
    expect(meetsOctantVaultCardEndowUsdMinimum(null)).toBe(false);
    expect(meetsOctantVaultCardEndowUsdMinimum(0n)).toBe(false);
    expect(meetsOctantVaultCardEndowUsdMinimum(199n)).toBe(false);
    expect(meetsOctantVaultCardEndowUsdMinimum(200n)).toBe(true);
    expect(meetsOctantVaultCardEndowUsdMinimum(2500n)).toBe(true);
  });
});
