export type RevenuePresetId = "bootstrap" | "hybrid" | "protocol-scale";

export interface RevenueExplorerInputs {
  // Revenue: core fees
  gardensPerYear: number;
  gardenFee: number;
  reportsPerYear: number;
  reportFee: number;
  cookieJarsPerYear: number;
  cookieJarCreateFee: number;
  cookieJarDepositVolume: number;
  cookieJarTakeRate: number;
  // Revenue: market and yield
  vaultTvl: number;
  vaultApy: number;
  yieldTakeRate: number;
  hypercertMintsPerYear: number;
  hypercertMintFee: number;
  hypercertSalesVolume: number;
  hypercertTakeRate: number;
  // Revenue: offchain
  grantsContracts: number;
  licensing: number;
  revnetRevenue: number;
  protocolPrincipal: number;
  principalApy: number;
  // Expenses
  teamCompensation: number;
  infrastructure: number;
  gasSponsorship: number;
  legalCompliance: number;
  operational: number;
  operatorIncentives: number;
  gardenerIncentives: number;
  // Treasury & retro
  startingTreasury: number;
  retroObligation: number;
  retroCashPercent: number;
  // Token
  tokenSupply: number;
  contributorAllocationPercent: number;
  operatorAllocationPercent: number;
  gardenerAllocationPercent: number;
  revenueMultiple: number;
}

export type RevenueFieldKey = keyof RevenueExplorerInputs;

export interface InputFieldDefinition {
  key: RevenueFieldKey;
  label: string;
  description: string;
  step: number;
  min?: number;
  max?: number;
  prefix?: string;
  suffix?: string;
}

export interface InputSectionDefinition {
  title: string;
  description: string;
  fields: InputFieldDefinition[];
}

export interface RevenuePresetDefinition {
  id: RevenuePresetId;
  label: string;
  description: string;
  inputs: RevenueExplorerInputs;
}

export interface RevenueStream {
  key: string;
  label: string;
  amount: number;
  category: "onchain" | "offchain";
}

export interface StageDefinition {
  id: RevenuePresetId;
  label: string;
  description: string;
}

export interface RevenueInsight {
  title: string;
  body: string;
}

export interface RevenueSummary {
  streams: RevenueStream[];
  totalAnnualRevenue: number;
  onchainRevenue: number;
  offchainRevenue: number;
  totalExpenses: number;
  netMargin: number;
  monthlyBurn: number;
  monthlySavings: number;
  runwayMonths: number;
  treasuryAfterOneYear: number;
  retroCashDrain: number;
  coverageRatio: number;
  requiredTvl: number;
  requiredPrincipal: number;
  yieldFeeRevenue: number;
  endowmentYieldRevenue: number;
  impliedValuation: number;
  tokenPrice: number;
  stage: StageDefinition;
  topStreams: RevenueStream[];
  insights: RevenueInsight[];
}

const EXPENSE_KEYS: RevenueFieldKey[] = [
  "teamCompensation",
  "infrastructure",
  "gasSponsorship",
  "legalCompliance",
  "operational",
  "operatorIncentives",
  "gardenerIncentives",
];

export function computeTotalExpenses(inputs: RevenueExplorerInputs): number {
  let total = 0;
  for (const key of EXPENSE_KEYS) {
    total += inputs[key];
  }
  return total;
}

const INPUT_KEYS: RevenueFieldKey[] = [
  "gardensPerYear",
  "gardenFee",
  "reportsPerYear",
  "reportFee",
  "cookieJarsPerYear",
  "cookieJarCreateFee",
  "cookieJarDepositVolume",
  "cookieJarTakeRate",
  "vaultTvl",
  "vaultApy",
  "yieldTakeRate",
  "hypercertMintsPerYear",
  "hypercertMintFee",
  "hypercertSalesVolume",
  "hypercertTakeRate",
  "grantsContracts",
  "licensing",
  "revnetRevenue",
  "protocolPrincipal",
  "principalApy",
  "teamCompensation",
  "infrastructure",
  "gasSponsorship",
  "legalCompliance",
  "operational",
  "operatorIncentives",
  "gardenerIncentives",
  "startingTreasury",
  "retroObligation",
  "retroCashPercent",
  "tokenSupply",
  "contributorAllocationPercent",
  "operatorAllocationPercent",
  "gardenerAllocationPercent",
  "revenueMultiple",
];

export const DEFAULT_PRESET_ID: RevenuePresetId = "bootstrap";

export const REVENUE_PRESETS: Record<RevenuePresetId, RevenuePresetDefinition> = {
  bootstrap: {
    id: "bootstrap",
    label: "Bootstrap",
    description: "Grant-led launch with modest protocol fees and early treasury formation.",
    inputs: {
      gardensPerYear: 8,
      gardenFee: 25,
      reportsPerYear: 24,
      reportFee: 150,
      cookieJarsPerYear: 12,
      cookieJarCreateFee: 10,
      cookieJarDepositVolume: 12000,
      cookieJarTakeRate: 0,
      vaultTvl: 20000,
      vaultApy: 6,
      yieldTakeRate: 20,
      hypercertMintsPerYear: 12,
      hypercertMintFee: 75,
      hypercertSalesVolume: 12000,
      hypercertTakeRate: 5,
      grantsContracts: 150000,
      licensing: 0,
      revnetRevenue: 0,
      protocolPrincipal: 25000,
      principalApy: 5,
      // Expenses sum to 100000 (matches old targetAnnualOpex)
      teamCompensation: 60000,
      infrastructure: 5000,
      gasSponsorship: 3000,
      legalCompliance: 5000,
      operational: 7000,
      operatorIncentives: 10000,
      gardenerIncentives: 10000,
      // Treasury & retro
      startingTreasury: 50000,
      retroObligation: 80000,
      retroCashPercent: 40,
      // Token
      tokenSupply: 10000000,
      contributorAllocationPercent: 20,
      operatorAllocationPercent: 15,
      gardenerAllocationPercent: 15,
      revenueMultiple: 5,
    },
  },
  hybrid: {
    id: "hybrid",
    label: "Hybrid",
    description: "Balanced mix of operator fees, marketplace activity, and early treasury yield.",
    inputs: {
      gardensPerYear: 18,
      gardenFee: 40,
      reportsPerYear: 48,
      reportFee: 250,
      cookieJarsPerYear: 24,
      cookieJarCreateFee: 15,
      cookieJarDepositVolume: 40000,
      cookieJarTakeRate: 0.25,
      vaultTvl: 130000,
      vaultApy: 6,
      yieldTakeRate: 20,
      hypercertMintsPerYear: 36,
      hypercertMintFee: 100,
      hypercertSalesVolume: 80000,
      hypercertTakeRate: 6,
      grantsContracts: 60000,
      licensing: 15000,
      revnetRevenue: 12000,
      protocolPrincipal: 150000,
      principalApy: 5,
      // Expenses sum to 180000
      teamCompensation: 100000,
      infrastructure: 12000,
      gasSponsorship: 8000,
      legalCompliance: 15000,
      operational: 15000,
      operatorIncentives: 15000,
      gardenerIncentives: 15000,
      // Treasury & retro
      startingTreasury: 200000,
      retroObligation: 80000,
      retroCashPercent: 50,
      // Token
      tokenSupply: 10000000,
      contributorAllocationPercent: 20,
      operatorAllocationPercent: 15,
      gardenerAllocationPercent: 15,
      revenueMultiple: 8,
    },
  },
  "protocol-scale": {
    id: "protocol-scale",
    label: "Protocol Scale",
    description: "Recurring onchain activity and treasury yield materially cover annual operating needs.",
    inputs: {
      gardensPerYear: 40,
      gardenFee: 75,
      reportsPerYear: 120,
      reportFee: 400,
      cookieJarsPerYear: 60,
      cookieJarCreateFee: 20,
      cookieJarDepositVolume: 180000,
      cookieJarTakeRate: 0.35,
      vaultTvl: 2500000,
      vaultApy: 7,
      yieldTakeRate: 12,
      hypercertMintsPerYear: 96,
      hypercertMintFee: 125,
      hypercertSalesVolume: 1200000,
      hypercertTakeRate: 7,
      grantsContracts: 25000,
      licensing: 50000,
      revnetRevenue: 90000,
      protocolPrincipal: 1250000,
      principalApy: 6,
      // Expenses sum to 350000
      teamCompensation: 180000,
      infrastructure: 30000,
      gasSponsorship: 20000,
      legalCompliance: 30000,
      operational: 30000,
      operatorIncentives: 30000,
      gardenerIncentives: 30000,
      // Treasury & retro
      startingTreasury: 500000,
      retroObligation: 80000,
      retroCashPercent: 30,
      // Token
      tokenSupply: 10000000,
      contributorAllocationPercent: 15,
      operatorAllocationPercent: 15,
      gardenerAllocationPercent: 20,
      revenueMultiple: 12,
    },
  },
};

export const INPUT_SECTIONS: InputSectionDefinition[] = [
  {
    title: "Core fee surfaces",
    description: "Annual counts and fee assumptions for the operator-facing protocol actions.",
    fields: [
      {
        key: "gardensPerYear",
        label: "Gardens created / year",
        description: "New gardens launched through the operator flow.",
        step: 1,
        min: 0,
      },
      {
        key: "gardenFee",
        label: "Garden creation fee",
        description: "Flat protocol fee or activation charge per garden.",
        step: 5,
        min: 0,
        prefix: "$",
      },
      {
        key: "reportsPerYear",
        label: "Impact reports / year",
        description: "Assessment or report issuances that create billable protocol work.",
        step: 1,
        min: 0,
      },
      {
        key: "reportFee",
        label: "Impact report fee",
        description: "Operator-paid application-layer fee for minting or packaging reports.",
        step: 10,
        min: 0,
        prefix: "$",
      },
      {
        key: "cookieJarsPerYear",
        label: "Cookie jars created / year",
        description: "Annualized count of jar creation events with a one-time protocol fee.",
        step: 1,
        min: 0,
      },
      {
        key: "cookieJarCreateFee",
        label: "Cookie jar creation fee",
        description: "Flat fee or bond collected when a jar is created.",
        step: 5,
        min: 0,
        prefix: "$",
      },
      {
        key: "cookieJarDepositVolume",
        label: "Cookie jar deposit volume / year",
        description: "Annual deposit volume routed through jars if you want to test a bps take.",
        step: 1000,
        min: 0,
        prefix: "$",
      },
      {
        key: "cookieJarTakeRate",
        label: "Cookie jar take rate",
        description: "Percent of deposit volume captured by the protocol. Set to 0 for a no-take model.",
        step: 0.05,
        min: 0,
        suffix: "%",
      },
    ],
  },
  {
    title: "Market and yield",
    description: "Revenue tied to capital formation, impact certificates, and vault economics.",
    fields: [
      {
        key: "vaultTvl",
        label: "Vault TVL",
        description: "Total value locked across Octant-aligned vaults.",
        step: 5000,
        min: 0,
        max: 5000000,
        prefix: "$",
      },
      {
        key: "vaultApy",
        label: "Vault APY",
        description: "Average annualized yield generated by vault strategies.",
        step: 0.25,
        min: 0,
        suffix: "%",
      },
      {
        key: "yieldTakeRate",
        label: "Protocol share of yield",
        description: "Portion of harvested yield routed to protocol revenue rather than garden-only destinations.",
        step: 0.25,
        min: 0,
        suffix: "%",
      },
      {
        key: "hypercertMintsPerYear",
        label: "Hypercert mints / year",
        description: "Annual issuance count for impact certificates.",
        step: 1,
        min: 0,
      },
      {
        key: "hypercertMintFee",
        label: "Hypercert mint fee",
        description: "Flat fee charged when a certificate is minted.",
        step: 5,
        min: 0,
        prefix: "$",
      },
      {
        key: "hypercertSalesVolume",
        label: "Hypercert sales volume / year",
        description: "Gross marketplace volume across primary and secondary sales you want to model.",
        step: 5000,
        min: 0,
        prefix: "$",
      },
      {
        key: "hypercertTakeRate",
        label: "Hypercert marketplace take",
        description: "Take rate on Hypercert sales volume.",
        step: 0.25,
        min: 0,
        suffix: "%",
      },
    ],
  },
  {
    title: "Offchain revenue",
    description: "Non-protocol revenue streams including grants, licensing, and treasury yield.",
    fields: [
      {
        key: "grantsContracts",
        label: "Grants and contracts",
        description: "Annual non-dilutive funding, pilots, implementation contracts, and sponsored programs.",
        step: 5000,
        min: 0,
        prefix: "$",
      },
      {
        key: "licensing",
        label: "Licensing and white-label",
        description: "Annual revenue from hosted/operator licensing or institutional packages.",
        step: 5000,
        min: 0,
        prefix: "$",
      },
      {
        key: "revnetRevenue",
        label: "Revnet and tokenization revenue",
        description: "Annual net protocol revenue expected from Juicebox or revnet treasury flows.",
        step: 5000,
        min: 0,
        prefix: "$",
      },
      {
        key: "protocolPrincipal",
        label: "Protocol-owned principal",
        description: "Treasury principal that can fund operations through its own yield.",
        step: 5000,
        min: 0,
        prefix: "$",
      },
      {
        key: "principalApy",
        label: "Protocol principal APY",
        description: "Annual yield rate on protocol-owned capital.",
        step: 0.25,
        min: 0,
        suffix: "%",
      },
    ],
  },
  {
    title: "Costs & compensation",
    description: "Annual operating expenses broken down by category.",
    fields: [
      {
        key: "teamCompensation",
        label: "Team compensation",
        description: "Ongoing salaries, stipends, and contractor payments.",
        step: 5000,
        min: 0,
        max: 300000,
        prefix: "$",
      },
      {
        key: "infrastructure",
        label: "Infrastructure",
        description: "Hosting, RPC nodes, indexer services, and cloud costs.",
        step: 1000,
        min: 0,
        prefix: "$",
      },
      {
        key: "gasSponsorship",
        label: "Gas sponsorship",
        description: "Subsidized transactions for users and operators.",
        step: 1000,
        min: 0,
        prefix: "$",
      },
      {
        key: "legalCompliance",
        label: "Legal & compliance",
        description: "Entity maintenance, audits, and regulatory costs.",
        step: 1000,
        min: 0,
        prefix: "$",
      },
      {
        key: "operational",
        label: "Operational",
        description: "Travel, tooling, subscriptions, and miscellaneous costs.",
        step: 1000,
        min: 0,
        prefix: "$",
      },
      {
        key: "operatorIncentives",
        label: "Operator incentives",
        description: "Rewards, rebates, and incentive programs for operators.",
        step: 1000,
        min: 0,
        max: 100000,
        prefix: "$",
      },
      {
        key: "gardenerIncentives",
        label: "Gardener incentives",
        description: "Token rewards, yield bonuses, and engagement incentives for gardeners.",
        step: 1000,
        min: 0,
        max: 100000,
        prefix: "$",
      },
    ],
  },
  {
    title: "Treasury & token",
    description: "Treasury position, retro compensation obligations, and token allocation model.",
    fields: [
      {
        key: "startingTreasury",
        label: "Starting treasury",
        description: "Current treasury balance available for operations and retro compensation.",
        step: 5000,
        min: 0,
        max: 1000000,
        prefix: "$",
      },
      {
        key: "retroObligation",
        label: "Retro obligation",
        description: "Total value of uncompensated early contributor work to be settled.",
        step: 5000,
        min: 0,
        prefix: "$",
      },
      {
        key: "retroCashPercent",
        label: "Retro cash portion",
        description: "Percentage of retro obligation paid in cash (remainder paid in tokens).",
        step: 5,
        min: 0,
        suffix: "%",
      },
      {
        key: "tokenSupply",
        label: "Token supply",
        description: "Total token pool for the protocol.",
        step: 100000,
        min: 0,
      },
      {
        key: "contributorAllocationPercent",
        label: "Contributor allocation",
        description: "Percentage of token supply reserved for retro and early contributors.",
        step: 1,
        min: 0,
        suffix: "%",
      },
      {
        key: "operatorAllocationPercent",
        label: "Operator allocation",
        description: "Percentage of token supply reserved for operator reward programs.",
        step: 1,
        min: 0,
        suffix: "%",
      },
      {
        key: "gardenerAllocationPercent",
        label: "Gardener allocation",
        description: "Percentage of token supply reserved for gardener reward programs.",
        step: 1,
        min: 0,
        suffix: "%",
      },
      {
        key: "revenueMultiple",
        label: "Revenue multiple",
        description: "Valuation multiple applied to annual revenue for token pricing.",
        step: 1,
        min: 0,
      },
    ],
  },
];

export function getPresetInputs(presetId: RevenuePresetId): RevenueExplorerInputs {
  return {...REVENUE_PRESETS[presetId].inputs};
}

export function calculateRevenueSummary(inputs: RevenueExplorerInputs): RevenueSummary {
  const streams: RevenueStream[] = [
    {
      key: "garden-fees",
      label: "Garden creation fees",
      amount: inputs.gardensPerYear * inputs.gardenFee,
      category: "onchain",
    },
    {
      key: "report-fees",
      label: "Impact report fees",
      amount: inputs.reportsPerYear * inputs.reportFee,
      category: "onchain",
    },
    {
      key: "cookie-jar-create",
      label: "Cookie jar creation fees",
      amount: inputs.cookieJarsPerYear * inputs.cookieJarCreateFee,
      category: "onchain",
    },
    {
      key: "cookie-jar-take",
      label: "Cookie jar deposit take",
      amount: percentOf(inputs.cookieJarDepositVolume, inputs.cookieJarTakeRate),
      category: "onchain",
    },
    {
      key: "vault-yield",
      label: "Vault yield take",
      amount: percentOf(percentOf(inputs.vaultTvl, inputs.vaultApy), inputs.yieldTakeRate),
      category: "onchain",
    },
    {
      key: "hypercert-mint",
      label: "Hypercert mint fees",
      amount: inputs.hypercertMintsPerYear * inputs.hypercertMintFee,
      category: "onchain",
    },
    {
      key: "hypercert-market",
      label: "Hypercert marketplace take",
      amount: percentOf(inputs.hypercertSalesVolume, inputs.hypercertTakeRate),
      category: "onchain",
    },
    {
      key: "grants",
      label: "Grants and contracts",
      amount: inputs.grantsContracts,
      category: "offchain",
    },
    {
      key: "licensing",
      label: "Licensing and white-label",
      amount: inputs.licensing,
      category: "offchain",
    },
    {
      key: "revnet",
      label: "Revnet and tokenization revenue",
      amount: inputs.revnetRevenue,
      category: "onchain",
    },
    {
      key: "principal-yield",
      label: "Protocol principal yield",
      amount: percentOf(inputs.protocolPrincipal, inputs.principalApy),
      category: "onchain",
    },
  ];

  const totalAnnualRevenue = sumAmounts(streams);
  const onchainRevenue = sumAmounts(streams.filter((stream) => stream.category === "onchain"));
  const offchainRevenue = sumAmounts(streams.filter((stream) => stream.category === "offchain"));
  const yieldFeeRevenue = getStreamAmount(streams, "vault-yield");
  const endowmentYieldRevenue = getStreamAmount(streams, "principal-yield");

  const totalExpenses = computeTotalExpenses(inputs);
  const netMargin = totalAnnualRevenue - totalExpenses;
  const monthlyBurn = netMargin < 0 ? Math.abs(netMargin) / 12 : 0;
  const monthlySavings = netMargin > 0 ? netMargin / 12 : 0;
  const retroCashDrain = inputs.retroObligation * (inputs.retroCashPercent / 100);
  const adjustedTreasury = inputs.startingTreasury - retroCashDrain;
  const runwayMonths = monthlyBurn > 0 ? Math.max(0, adjustedTreasury) / monthlyBurn : Number.POSITIVE_INFINITY;
  const treasuryAfterOneYear = adjustedTreasury + netMargin;

  const coverageRatio = totalExpenses > 0 ? totalAnnualRevenue / totalExpenses : 0;
  const requiredTvl = requiredCapital(totalExpenses, percentOfDecimal(inputs.vaultApy, inputs.yieldTakeRate));
  const requiredPrincipal = requiredCapital(totalExpenses, inputs.principalApy / 100);

  const impliedValuation = totalAnnualRevenue * inputs.revenueMultiple;
  const tokenPrice = inputs.tokenSupply > 0 ? impliedValuation / inputs.tokenSupply : 0;

  const topStreams = [...streams]
    .filter((stream) => stream.amount > 0)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 2);
  const stage = classifyStage(totalExpenses, streams, coverageRatio, onchainRevenue, offchainRevenue);
  const insights = buildInsights(totalExpenses, streams, coverageRatio, yieldFeeRevenue, endowmentYieldRevenue, netMargin, stage);

  return {
    streams,
    totalAnnualRevenue,
    onchainRevenue,
    offchainRevenue,
    totalExpenses,
    netMargin,
    monthlyBurn,
    monthlySavings,
    runwayMonths,
    treasuryAfterOneYear,
    retroCashDrain,
    coverageRatio,
    requiredTvl,
    requiredPrincipal,
    yieldFeeRevenue,
    endowmentYieldRevenue,
    impliedValuation,
    tokenPrice,
    stage,
    topStreams,
    insights,
  };
}

export function getScenarioFromSearch(search: string): {
  presetId: RevenuePresetId;
  inputs: RevenueExplorerInputs;
} {
  const params = new URLSearchParams(search);
  const presetId = coercePresetId(params.get("preset"));
  const inputs = getPresetInputs(presetId);

  for (const key of INPUT_KEYS) {
    const raw = params.get(key);
    if (raw === null) continue;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) continue;

    inputs[key] = parsed;
  }

  return {presetId, inputs};
}

export function serializeScenarioToSearch(
  presetId: RevenuePresetId,
  inputs: RevenueExplorerInputs,
): string {
  const params = new URLSearchParams();
  const baseline = REVENUE_PRESETS[presetId].inputs;

  params.set("preset", presetId);

  for (const key of INPUT_KEYS) {
    if (!isDifferent(inputs[key], baseline[key])) continue;
    params.set(key, toParamValue(inputs[key]));
  }

  return params.toString();
}

function classifyStage(
  totalExpenses: number,
  streams: RevenueStream[],
  coverageRatio: number,
  onchainRevenue: number,
  offchainRevenue: number,
): StageDefinition {
  const grantShare = safeRatio(getStreamAmount(streams, "grants"), sumAmounts(streams));
  const offchainDominant = offchainRevenue > onchainRevenue;

  if (grantShare >= 0.45 || (offchainDominant && coverageRatio < 1)) {
    return {
      id: "bootstrap",
      label: "Bootstrap",
      description: "Offchain support still carries the model. Protocol fees are present but not decisive.",
    };
  }

  if (
    onchainRevenue >= totalExpenses * 0.85 &&
    grantShare < 0.25 &&
    coverageRatio >= 1
  ) {
    return {
      id: "protocol-scale",
      label: "Protocol Scale",
      description: "Recurring onchain and treasury-backed streams materially cover annual operating needs.",
    };
  }

  return {
    id: "hybrid",
    label: "Hybrid",
    description: "Protocol and offchain revenue both matter. The business is diversifying but not fully autonomous.",
  };
}

function buildInsights(
  totalExpenses: number,
  streams: RevenueStream[],
  coverageRatio: number,
  yieldFeeRevenue: number,
  endowmentYieldRevenue: number,
  netMargin: number,
  stage: StageDefinition,
): RevenueInsight[] {
  const totalRevenue = sumAmounts(streams);
  const grants = getStreamAmount(streams, "grants");
  const topStreams = [...streams]
    .filter((stream) => stream.amount > 0)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 2);

  const insights: RevenueInsight[] = [];

  if (topStreams.length === 0) {
    insights.push({
      title: "No revenue modeled",
      body:
        "Every stream is currently set to zero. Start by entering one or two active revenue surfaces to compare how the business model changes.",
    });
  } else {
    insights.push({
      title: "Primary drivers",
      body:
        topStreams.length === 1
          ? `${topStreams[0].label} is doing most of the work in this scenario.`
          : `${topStreams[0].label} and ${topStreams[1].label} are the dominant revenue drivers in this mix.`,
    });
  }

  if (grants > 0 && safeRatio(grants, totalRevenue) >= 0.4) {
    insights.push({
      title: "Grant dependence",
      body:
        "This scenario still leans heavily on grants and contracts. That is fine for launch, but it is not yet a self-propelled protocol business.",
    });
  }

  if (yieldFeeRevenue < totalExpenses * 0.25 && endowmentYieldRevenue < totalExpenses * 0.25) {
    insights.push({
      title: "Yield alone is not enough",
      body:
        "Vault take and protocol-owned principal yield are both too small to carry annual opex on their own. TVL, take rate, or principal needs to grow for a yield-led model to matter.",
    });
  } else if (endowmentYieldRevenue > yieldFeeRevenue * 1.25) {
    insights.push({
      title: "Treasury strength matters",
      body:
        "Protocol-owned principal is contributing more than the external vault take. In this range, building a protocol endowment changes the sustainability picture faster than waiting for third-party TVL alone.",
    });
  }

  if (netMargin > 0 && totalRevenue > 0) {
    insights.push({
      title: "Positive margin",
      body: "Revenue exceeds expenses. The surplus can fund treasury growth, retro compensation, or participant incentives.",
    });
  }

  if (stage.id === "protocol-scale") {
    insights.push({
      title: "Protocol scale reached",
      body:
        "Recurring onchain and treasury-backed revenue covers the current operating target. Grants become optional acceleration capital rather than a dependency.",
    });
  }

  return insights.slice(0, 4);
}

function coercePresetId(value: string | null): RevenuePresetId {
  if (value === "bootstrap" || value === "hybrid" || value === "protocol-scale") {
    return value;
  }

  return DEFAULT_PRESET_ID;
}

function percentOf(amount: number, rate: number): number {
  return amount * (rate / 100);
}

function percentOfDecimal(firstRate: number, secondRate: number): number {
  return (firstRate / 100) * (secondRate / 100);
}

function requiredCapital(target: number, effectiveRate: number): number {
  if (target <= 0 || effectiveRate <= 0) return Number.POSITIVE_INFINITY;
  return target / effectiveRate;
}

function sumAmounts(streams: RevenueStream[]): number {
  return streams.reduce((sum, stream) => sum + stream.amount, 0);
}

function getStreamAmount(streams: RevenueStream[], key: string): number {
  return streams.find((stream) => stream.key === key)?.amount ?? 0;
}

function safeRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function isDifferent(left: number, right: number): boolean {
  return Math.abs(left - right) > 0.0001;
}

function toParamValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(4).replace(/\.?0+$/, "");
}

// ── Revenue projection over time ──

export interface ProjectionConfig {
  annualGrowthRate: number;
  years: number;
}

export interface ProjectionYearData {
  year: number;
  streams: Record<string, number>;
  totalAnnualRevenue: number;
  totalExpenses: number;
}

const SCALABLE_KEYS: RevenueFieldKey[] = [
  "gardensPerYear",
  "reportsPerYear",
  "cookieJarsPerYear",
  "cookieJarDepositVolume",
  "vaultTvl",
  "hypercertMintsPerYear",
  "hypercertSalesVolume",
  "grantsContracts",
  "licensing",
  "revnetRevenue",
  "protocolPrincipal",
];

function scaleInputs(
  inputs: RevenueExplorerInputs,
  multiplier: number,
): RevenueExplorerInputs {
  const scaled = {...inputs};
  for (const key of SCALABLE_KEYS) {
    scaled[key] = inputs[key] * multiplier;
  }
  return scaled;
}

export function projectRevenue(
  inputs: RevenueExplorerInputs,
  config: ProjectionConfig,
): ProjectionYearData[] {
  const results: ProjectionYearData[] = [];
  for (let year = 0; year < config.years; year++) {
    const multiplier = Math.pow(1 + config.annualGrowthRate / 100, year);
    const scaledInputs = scaleInputs(inputs, multiplier);
    const summary = calculateRevenueSummary(scaledInputs);
    const streamMap: Record<string, number> = {};
    for (const stream of summary.streams) {
      streamMap[stream.key] = stream.amount;
    }
    results.push({
      year: year + 1,
      streams: streamMap,
      totalAnnualRevenue: summary.totalAnnualRevenue,
      totalExpenses: summary.totalExpenses,
    });
  }
  return results;
}

// ── Monte Carlo confidence bands ──

export interface MonteCarloConfig {
  annualGrowthRate: number;
  volatility: number;
  years: number;
  simulations: number;
}

export interface MonteCarloYearBand {
  year: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export function monteCarloProjection(
  inputs: RevenueExplorerInputs,
  config: MonteCarloConfig,
): MonteCarloYearBand[] {
  const yearResults: number[][] = Array.from({length: config.years}, () => []);

  for (let sim = 0; sim < config.simulations; sim++) {
    let cumulativeMultiplier = 1;
    for (let year = 0; year < config.years; year++) {
      if (year > 0) {
        const randomGrowth = normalRandom(config.annualGrowthRate, config.volatility);
        cumulativeMultiplier *= 1 + Math.max(-50, randomGrowth) / 100;
      }
      const scaled = scaleInputs(inputs, cumulativeMultiplier);
      const summary = calculateRevenueSummary(scaled);
      yearResults[year].push(summary.totalAnnualRevenue);
    }
  }

  return yearResults.map((results, index) => {
    results.sort((a, b) => a - b);
    return {
      year: index + 1,
      p10: pickPercentile(results, 10),
      p25: pickPercentile(results, 25),
      p50: pickPercentile(results, 50),
      p75: pickPercentile(results, 75),
      p90: pickPercentile(results, 90),
    };
  });
}

function normalRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

function pickPercentile(sorted: number[], p: number): number {
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}
