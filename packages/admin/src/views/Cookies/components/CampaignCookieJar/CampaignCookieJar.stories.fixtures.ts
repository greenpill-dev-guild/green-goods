import {
  buildCampaignCookieJarMetadata,
  DEFAULT_CHAIN_ID,
  getCampaignCookieJarPayoutAssets,
  type Address,
  type CampaignCookieJarCampaign,
  type Garden,
} from "@green-goods/shared";
import type { IntlShape } from "react-intl";
import {
  STORYBOOK_ADMIN_DEPLOYER_SEEDS,
  STORYBOOK_ADMIN_GARDENS,
  STORYBOOK_PRIMARY_ADMIN_GARDEN,
} from "../../../../../../shared/.storybook/adminFixtures";
import { FIXTURE_IMAGE_AGROFORESTRY } from "../../../../../../shared/.storybook/fixtures";
import {
  withAdminIdentityRole,
  withCanvasFrame,
  withSeededQueryClient,
  withSelectedAdminGarden,
} from "../../../../../../shared/.storybook/decorators";
import type { CampaignCookieJarCreateFormProps } from "./CampaignCookieJarCreateForm";
import type { CampaignCookieJarPanelViewProps } from "./CampaignCookieJarPanelView.types";

export const STORYBOOK_CAMPAIGN_JAR = "0x7777777777777777777777777777777777777777" as Address;

export const campaignCookieJarStoryDecorators = [
  withAdminIdentityRole("deployer"),
  withSeededQueryClient(STORYBOOK_ADMIN_DEPLOYER_SEEDS),
  withSelectedAdminGarden(STORYBOOK_PRIMARY_ADMIN_GARDEN),
  withCanvasFrame({
    className: "p-0",
    heightClassName: "h-[760px]",
    workspace: "hub",
  }),
];

const formatMessage = ((descriptor: { id: string; defaultMessage?: string }) =>
  descriptor.defaultMessage ?? descriptor.id) as IntlShape["formatMessage"];

const panelViewFormatMessage = ((
  descriptor: { id: string; defaultMessage?: string },
  values?: { count?: number }
) => {
  if (descriptor.id === "cockpit.community.cookies.listDescription") {
    const count = typeof values?.count === "number" ? values.count : 0;
    return `${count} trusted campaign ${count === 1 ? "jar" : "jars"} indexed for this network.`;
  }

  return formatMessage(descriptor);
}) as IntlShape["formatMessage"];

const payoutAssets = getCampaignCookieJarPayoutAssets(DEFAULT_CHAIN_ID);

export const campaignCookieJarCreateFormProps: CampaignCookieJarCreateFormProps = {
  formatMessage,
  moduleConfigured: true,
  isDeployer: true,
  roleLoading: false,
  createError: null,
  createPending: false,
  gardensLoading: false,
  factoryLoading: false,
  payoutAssets,
  defaultPayoutAsset: payoutAssets[0],
  selectedAssetId: payoutAssets[0]?.id ?? "usdc",
  setSelectedAssetId: () => undefined,
  campaignTitle: "Earth Week rewards",
  setCampaignTitle: () => undefined,
  campaignDescription: "Rewards for the campaign's selected garden operators.",
  setCampaignDescription: () => undefined,
  campaignImage: FIXTURE_IMAGE_AGROFORESTRY,
  setCampaignImage: () => undefined,
  campaignImageFile: null,
  setCampaignImageFile: () => undefined,
  publicCampaignUrl: "https://greengoods.app/cookies?campaign=earth-week-rewards",
  claimAmount: "5",
  setClaimAmount: () => undefined,
  tokenSymbol: payoutAssets[0]?.symbol ?? "USDC",
  gardens: STORYBOOK_ADMIN_GARDENS,
  selectedGardenIds: [STORYBOOK_PRIMARY_ADMIN_GARDEN.id],
  toggleGarden: () => undefined,
  selectGardens: () => undefined,
  clearGardens: () => undefined,
  gardenSearch: "",
  setGardenSearch: () => undefined,
  aggregation: {
    allowlist: STORYBOOK_PRIMARY_ADMIN_GARDEN.operators,
    sources: [{ gardenAddress: STORYBOOK_PRIMARY_ADMIN_GARDEN.id }],
    missingOperatorGardens: [],
    invalidAddresses: [],
  },
  advancedOpen: false,
  setAdvancedOpen: () => undefined,
  customTokenAddress: "",
  setCustomTokenAddress: () => undefined,
  normalizedCustomTokenAddress: null,
  customTokenLoading: false,
  customTokenError: false,
  tokenDecimals: payoutAssets[0]?.decimals ?? 6,
  jarOwner: STORYBOOK_PRIMARY_ADMIN_GARDEN.owners[0] ?? STORYBOOK_CAMPAIGN_JAR,
  setJarOwner: () => undefined,
  normalizedJarOwner: STORYBOOK_PRIMARY_ADMIN_GARDEN.owners[0] ?? STORYBOOK_CAMPAIGN_JAR,
  withdrawalIntervalDays: "0",
  setWithdrawalIntervalDays: () => undefined,
  extraAddresses: "",
  setExtraAddresses: () => undefined,
  payoutLabel: `5 ${payoutAssets[0]?.symbol ?? "USDC"}`,
  canCreate: true,
  onCreate: () => undefined,
  onCancel: () => undefined,
};

export const storybookCampaign: CampaignCookieJarCampaign = {
  address: STORYBOOK_CAMPAIGN_JAR,
  jarAddress: STORYBOOK_CAMPAIGN_JAR,
  slug: "earth-week",
  label: "Earth Week Cookie Jar",
  title: "Earth Week Cookie Jar",
  metadata: buildCampaignCookieJarMetadata({
    title: "Earth Week Cookie Jar",
    slug: "earth-week",
    description: "Shared campaign rewards for selected garden operators.",
    image: FIXTURE_IMAGE_AGROFORESTRY,
    externalUrl: "https://greengoods.app/cookies?campaign=earth-week",
    sourceGardens: [STORYBOOK_PRIMARY_ADMIN_GARDEN.id],
    extraAllowlist: [],
    chainId: DEFAULT_CHAIN_ID,
    createdAt: 1770000000,
  }),
  rawMetadata: "",
  creator: STORYBOOK_CAMPAIGN_JAR,
  createdAt: 1770000000,
  source: "indexed",
};

export const campaignCookieJarPanelViewProps: CampaignCookieJarPanelViewProps = {
  formatMessage: panelViewFormatMessage,
  moduleConfigured: true,
  isDeployer: true,
  roleLoading: false,
  campaigns: [storybookCampaign],
  campaignsLoading: false,
  campaignsError: null,
  campaignSearch: "",
  setCampaignSearch: () => undefined,
  visibleCampaigns: [storybookCampaign],
  gardensByAddress: new Map<string, Garden>(
    STORYBOOK_ADMIN_GARDENS.map((garden) => [garden.id.toLowerCase(), garden])
  ),
  setSelectedCampaign: () => undefined,
  selectedCampaign: null,
  selectedCampaignTitle: storybookCampaign.title,
  selectedCampaignPublicUrl: "https://greengoods.app/cookies?campaign=earth-week",
  syncAllowlist: { isPending: false },
  updateMetadata: { isPending: false },
  canSync: false,
  handleSync: () => undefined,
  syncCampaignDescription: "",
  setSyncCampaignDescription: () => undefined,
  syncCampaignImage: FIXTURE_IMAGE_AGROFORESTRY,
  setSyncCampaignImage: () => undefined,
  syncCampaignImageFile: null,
  setSyncCampaignImageFile: () => undefined,
  gardens: STORYBOOK_ADMIN_GARDENS,
  syncGardenIds: [],
  setSyncGardenIds: () => undefined,
  toggleSyncGarden: () => undefined,
  selectSyncGardens: () => undefined,
  syncGardenSearch: "",
  setSyncGardenSearch: () => undefined,
  syncExtraAddresses: "",
  setSyncExtraAddresses: () => undefined,
  syncAggregation: { allowlist: [], invalidAddresses: [] },
  syncDiff: { grant: [], revoke: [] },
  selectedJarAddress: null,
  syncJar: { jar: null },
};
