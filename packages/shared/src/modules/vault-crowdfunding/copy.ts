import enMessages from "../../i18n/en.json";
import {
  EVMAVERICKS_REQUIRED_MANIFEST_FIELDS,
  GREENPILL_NYC_REQUIRED_MANIFEST_FIELDS,
  OCTANT_V2_ETHEREUM_CHAIN_ID,
} from "./manifest";
import type {
  KnownOctantVaultCampaignSlug,
  OctantVaultCampaignAssetManifest,
  OctantVaultCampaignManifest,
  OctantVaultCampaignSlug,
  OctantVaultManifestField,
  OctantVaultStrategyFactoryEvidence,
  OctantVaultYieldSource,
} from "./manifest";

export interface OctantVaultCampaignCopy {
  headline: string;
  summary: string;
  fundingPurpose: string;
  recipientLogic: string;
  riskNote: string;
}

type SharedLocaleMessageId = keyof typeof enMessages;

export type OctantVaultCampaignCopyField = keyof OctantVaultCampaignCopy;

export type OctantVaultCampaignCopyMessageIds = Record<
  OctantVaultCampaignCopyField,
  SharedLocaleMessageId
>;

export type OctantVaultManifestFieldLabelMessageIds = Record<
  OctantVaultManifestField,
  SharedLocaleMessageId
>;

export function enMessage(id: SharedLocaleMessageId): string {
  return enMessages[id];
}

export function campaignCopyFromMessageIds(
  messageIds: OctantVaultCampaignCopyMessageIds
): OctantVaultCampaignCopy {
  return {
    headline: enMessage(messageIds.headline),
    summary: enMessage(messageIds.summary),
    fundingPurpose: enMessage(messageIds.fundingPurpose),
    recipientLogic: enMessage(messageIds.recipientLogic),
    riskNote: enMessage(messageIds.riskNote),
  };
}

export interface OctantVaultAssetDisplayPolicy {
  /** Primary donor-facing unit. WETH vault deposits are presented as ETH contributions. */
  donorSymbol: string;
  /** Settlement unit for receipt/review copy. */
  settlementSymbol: string;
  /** Exact token symbol used by the deployed vault. */
  technicalSymbol: string;
}

export const OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS = {
  chainId: "public.vaults.field.chainId",
  vaultAddress: "public.vaults.field.vaultAddress",
  assetAddress: "public.vaults.field.assetAddress",
  assetSymbol: "public.vaults.field.assetSymbol",
  assetDecimals: "public.vaults.field.assetDecimals",
  recipientRoutingSummary: "public.vaults.field.recipientRoutingSummary",
  protocolGuildDestinationContext: "public.vaults.field.protocolGuildDestinationContext",
  explorerLink: "public.vaults.field.explorerLink",
  campaignCopy: "public.vaults.field.campaignCopy",
} as const satisfies OctantVaultManifestFieldLabelMessageIds;

export const OCTANT_VAULT_MANIFEST_FIELD_LABELS: Record<OctantVaultManifestField, string> = {
  chainId: enMessage(OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS.chainId),
  vaultAddress: enMessage(OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS.vaultAddress),
  assetAddress: enMessage(OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS.assetAddress),
  assetSymbol: enMessage(OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS.assetSymbol),
  assetDecimals: enMessage(OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS.assetDecimals),
  recipientRoutingSummary: enMessage(
    OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS.recipientRoutingSummary
  ),
  protocolGuildDestinationContext: enMessage(
    OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS.protocolGuildDestinationContext
  ),
  explorerLink: enMessage(OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS.explorerLink),
  campaignCopy: enMessage(OCTANT_VAULT_MANIFEST_FIELD_LABEL_MESSAGE_IDS.campaignCopy),
};

export const OCTANT_VAULT_CAMPAIGN_COPY_MESSAGE_IDS = {
  "greenpill-nyc": {
    headline: "public.vaults.campaign.greenpill-nyc.headline",
    summary: "public.vaults.campaign.greenpill-nyc.summary",
    fundingPurpose: "public.vaults.campaign.greenpill-nyc.fundingPurpose",
    recipientLogic: "public.vaults.campaign.greenpill-nyc.recipientLogic",
    riskNote: "public.vaults.campaign.greenpill-nyc.riskNote",
  },
  evmavericks: {
    headline: "public.vaults.campaign.evmavericks.headline",
    summary: "public.vaults.campaign.evmavericks.summary",
    fundingPurpose: "public.vaults.campaign.evmavericks.fundingPurpose",
    recipientLogic: "public.vaults.campaign.evmavericks.recipientLogic",
    riskNote: "public.vaults.campaign.evmavericks.riskNote",
  },
} as const satisfies Record<KnownOctantVaultCampaignSlug, OctantVaultCampaignCopyMessageIds>;

function isKnownOctantVaultCampaignSlug(
  slug: OctantVaultCampaignSlug
): slug is KnownOctantVaultCampaignSlug {
  return slug === "greenpill-nyc" || slug === "evmavericks";
}

const OCTANT_VAULT_CAMPAIGN_COPY_FALLBACK_MESSAGE_IDS = {
  summary: "public.vaults.campaign.fallback.summary",
  fundingPurpose: "public.vaults.campaign.fallback.fundingPurpose",
  recipientLogic: "public.vaults.campaign.fallback.recipientLogic",
  riskNote: "public.vaults.campaign.fallback.riskNote",
} as const satisfies Omit<OctantVaultCampaignCopyMessageIds, "headline">;

export const greenpillNycPreviewCopy = campaignCopyFromMessageIds(
  OCTANT_VAULT_CAMPAIGN_COPY_MESSAGE_IDS["greenpill-nyc"]
);

export const evmavericksPreviewCopy = campaignCopyFromMessageIds(
  OCTANT_VAULT_CAMPAIGN_COPY_MESSAGE_IDS.evmavericks
);

const WETH_ASSET_MANIFEST = {
  address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  symbol: "WETH",
  decimals: 18,
} as const satisfies OctantVaultCampaignAssetManifest;

const PILOT_YEARN_V3_WETH_SOURCE = {
  address: "0xc56413869c6CDf96496f2b1eF801fEDBdFA7dDB0",
  kind: "yearn-v3",
  chainId: OCTANT_V2_ETHEREUM_CHAIN_ID,
} as const satisfies OctantVaultYieldSource;

const PILOT_STRATEGY_FACTORY_CREATOR = {
  address: "0x9A6c9aA80D4A0d8Da29EcbA62c40ccBBB321abB6",
  name: "YearnV3StrategyFactory",
  evidenceType: "pilot_strategy_factory_creator",
  sourcePath: "src/factories/yieldDonating/YearnV3StrategyFactory.sol",
  explorerLink: "https://etherscan.io/address/0x9A6c9aA80D4A0d8Da29EcbA62c40ccBBB321abB6",
  roleClarification:
    "Shared pilot strategy-factory/creator evidence only; not a proven MultistrategyVaultFactory deployment or successful FACTORY() return.",
  factoryAccessorProofStatus: "reverted",
} as const satisfies OctantVaultStrategyFactoryEvidence;

export const OCTANT_VAULT_CAMPAIGN_MANIFEST = [
  {
    slug: "greenpill-nyc",
    displayName: "Greenpill NYC",
    communityName: "Greenpill NYC",
    fixtureRole: "first_available_transaction_fixture",
    routePath: "/vaults",
    targetProtocol: "octant-v2-ethereum",
    previewCopy: greenpillNycPreviewCopy,
    campaignCopy: greenpillNycPreviewCopy,
    recipientRoutingSummary:
      "Contributions deposit into the Greenpill NYC Octant vault; generated yield supports local civic tech initiatives surfaced via Decentral Park.",
    vault: {
      chainId: OCTANT_V2_ETHEREUM_CHAIN_ID,
      vaultAddress: "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5",
      vaultName: "Greenpill NYC",
      vaultSymbol: "gpWETH",
      vaultDecimals: 18,
      asset: WETH_ASSET_MANIFEST,
      explorerLink: "https://etherscan.io/address/0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5",
      strategyFactory: PILOT_STRATEGY_FACTORY_CREATOR,
      yieldSource: PILOT_YEARN_V3_WETH_SOURCE,
      yieldStrategy: {
        address: "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5",
        chainId: OCTANT_V2_ETHEREUM_CHAIN_ID,
        evidence:
          "Plan-recorded Blockscout metadata verifies this campaign contract as a YieldDonatingTokenizedStrategy proxy; use it for strategy.totalAssets() - vault.totalDebt() reads.",
      },
    },
    requiredManifestFields: GREENPILL_NYC_REQUIRED_MANIFEST_FIELDS,
  },
  {
    slug: "evmavericks",
    displayName: "EVMavericks Fantasy Football League",
    communityName: "EVMavericks",
    fixtureRole: "standard_campaign",
    routePath: "/vaults",
    targetProtocol: "octant-v2-ethereum",
    previewCopy: evmavericksPreviewCopy,
    vault: {
      chainId: OCTANT_V2_ETHEREUM_CHAIN_ID,
      vaultAddress: "0x0bCe8c16974FFD3B410A32365c5bCf27a5A630Fc",
      vaultName: "EVMavs PGF",
      vaultSymbol: "evmWETH",
      vaultDecimals: 18,
      asset: WETH_ASSET_MANIFEST,
      explorerLink: "https://etherscan.io/address/0x0bCe8c16974FFD3B410A32365c5bCf27a5A630Fc",
      strategyFactory: PILOT_STRATEGY_FACTORY_CREATOR,
      yieldSource: PILOT_YEARN_V3_WETH_SOURCE,
      yieldStrategy: {
        address: "0x0bCe8c16974FFD3B410A32365c5bCf27a5A630Fc",
        chainId: OCTANT_V2_ETHEREUM_CHAIN_ID,
        evidence:
          "Plan-recorded Blockscout metadata verifies this campaign contract as a YieldDonatingTokenizedStrategy proxy; use it for strategy.totalAssets() - vault.totalDebt() reads.",
      },
    },
    requiredManifestFields: EVMAVERICKS_REQUIRED_MANIFEST_FIELDS,
  },
] as const satisfies readonly OctantVaultCampaignManifest[];

export function getOctantVaultAssetDisplayPolicy(
  symbol: string | null | undefined
): OctantVaultAssetDisplayPolicy {
  const technicalSymbol = symbol?.trim() || "tokens";
  if (technicalSymbol.toUpperCase() === "WETH") {
    return {
      donorSymbol: "ETH",
      settlementSymbol: "WETH",
      technicalSymbol: "WETH",
    };
  }

  return {
    donorSymbol: technicalSymbol,
    settlementSymbol: technicalSymbol,
    technicalSymbol,
  };
}

function cloneCampaign(campaign: OctantVaultCampaignManifest): OctantVaultCampaignManifest {
  return {
    ...campaign,
    campaignCopy: campaign.campaignCopy ? { ...campaign.campaignCopy } : undefined,
    previewCopy: campaign.previewCopy ? { ...campaign.previewCopy } : undefined,
    requiredManifestFields: campaign.requiredManifestFields
      ? [...campaign.requiredManifestFields]
      : undefined,
    vault: campaign.vault
      ? {
          ...campaign.vault,
          asset: campaign.vault.asset ? { ...campaign.vault.asset } : undefined,
          strategyFactory: campaign.vault.strategyFactory
            ? { ...campaign.vault.strategyFactory }
            : undefined,
          yieldSource: campaign.vault.yieldSource ? { ...campaign.vault.yieldSource } : undefined,
          yieldStrategy: campaign.vault.yieldStrategy
            ? { ...campaign.vault.yieldStrategy }
            : undefined,
        }
      : undefined,
  };
}

export function getOctantVaultCampaigns(): OctantVaultCampaignManifest[] {
  return OCTANT_VAULT_CAMPAIGN_MANIFEST.map(cloneCampaign);
}

export function getOctantVaultCampaignBySlug(
  slug: OctantVaultCampaignSlug
): OctantVaultCampaignManifest | undefined {
  const campaign = OCTANT_VAULT_CAMPAIGN_MANIFEST.find((entry) => entry.slug === slug);
  return campaign ? cloneCampaign(campaign) : undefined;
}

export function getOctantVaultCampaignCopyMessageIds(
  campaign: OctantVaultCampaignManifest
): OctantVaultCampaignCopyMessageIds | undefined {
  return isKnownOctantVaultCampaignSlug(campaign.slug)
    ? OCTANT_VAULT_CAMPAIGN_COPY_MESSAGE_IDS[campaign.slug]
    : undefined;
}

export function getOctantVaultCampaignCopy(
  campaign: OctantVaultCampaignManifest
): OctantVaultCampaignCopy {
  return (
    campaign.campaignCopy ??
    campaign.previewCopy ?? {
      headline: campaign.displayName,
      summary: enMessage(OCTANT_VAULT_CAMPAIGN_COPY_FALLBACK_MESSAGE_IDS.summary),
      fundingPurpose: enMessage(OCTANT_VAULT_CAMPAIGN_COPY_FALLBACK_MESSAGE_IDS.fundingPurpose),
      recipientLogic: enMessage(OCTANT_VAULT_CAMPAIGN_COPY_FALLBACK_MESSAGE_IDS.recipientLogic),
      riskNote: enMessage(OCTANT_VAULT_CAMPAIGN_COPY_FALLBACK_MESSAGE_IDS.riskNote),
    }
  );
}
