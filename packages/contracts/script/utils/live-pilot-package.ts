import { getAddress, Interface } from "ethers";
import {
  type CLCReleaseManifest,
  type CLCReleasePlan,
  getCLCBaseManifest,
  getCLCIssuerBindings,
  inspectCLCReleaseManifest,
  validateCLCReleasePlan,
} from "./clc-member-release";
import {
  inspectSourceUpgradeManifest,
  type SourceUpgradeArtifacts,
  type SourceUpgradeManifest,
  type SourceUpgradePlan,
  validateSourceUpgradePlan,
} from "./source-upgrade-release";
import {
  inspectStewardManifest,
  type StewardArtifacts,
  type StewardPlan,
  validateStewardPlan,
} from "./steward-safe-release";
import {
  inspectVoucherManifest,
  type VoucherArtifact,
  type VoucherArtifacts,
  type VoucherPlan,
  validateVoucherPlan,
  voucherDigest,
} from "./voucher-release";

const MANIFEST_REFS = {
  sourceUpgrades: "config/source-upgrade-release.json",
  stewardSafe: "config/steward-safe-release.json",
  vouchers: "config/voucher-pilot-release.json",
  clc: "config/clc-pilot-release.json",
} as const;
type Component = keyof typeof MANIFEST_REFS;
export interface LivePilotPackageConfig {
  schemaVersion: 1;
  releaseId: string;
  manifests: typeof MANIFEST_REFS;
  earnedFeeReserveMinimumWei: string | null;
}
export interface LivePilotManifests {
  sourceUpgrades: unknown;
  stewardSafe: unknown;
  vouchers: unknown;
  clc: unknown;
}
export interface LivePilotPlans {
  sourceUpgrades: SourceUpgradePlan;
  stewardSafe: StewardPlan;
  vouchers: VoucherPlan;
  clc: CLCReleasePlan;
}
export interface LivePilotArtifacts {
  sourceUpgrades: SourceUpgradeArtifacts;
  stewardSafe: StewardArtifacts;
  vouchers: VoucherArtifacts;
  clc: VoucherArtifact;
}
export interface LivePilotBuildInputs {
  config: unknown;
  manifests: LivePilotManifests;
  plans: Record<Component, unknown>;
  artifacts: LivePilotArtifacts;
  sourceCommit: string;
}
interface PreparedTransaction {
  chainId: number;
  from: string | null;
  to: string | null;
  value: "0";
  data: string | null;
  operation: string;
  reviewOnly: true;
  missing: string[];
  nonce?: number;
  safeNonce?: number;
  expectedAddress?: string;
  requiresNonceRefreeze?: true;
}
interface Stage {
  id: string;
  reviewOnly: true;
  transactions: PreparedTransaction[];
  gates: string[];
  instructions: string[];
}
export interface LivePilotPackage {
  schemaVersion: 1;
  kind: "LIVE_PILOT_PREPARATION";
  releaseId: string;
  sourceCommit: string;
  configHash: string;
  componentHashes: Record<Component, { manifestHash: string; planHash: string }>;
  nativeNonceRanges: Array<{
    phase: "source" | "downstream";
    chainId: number;
    from: string;
    firstNonce: number;
    lastNonce: number;
    count: number;
    requiresNonceRefreeze: boolean;
  }>;
  stages: Stage[];
  deploymentMissing: string[];
  activationMissing: string[];
  executionReady: false;
  activationIncluded: false;
  liveBroadcast: false;
}
const GG_SAFE = "0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19";
const LIVE_GATES = [
  "live.hatsUpgradeAndOwnerReadbackBeforeNonceFreeze",
  "live.techAndSunSafeReceiverReadback",
  "live.sourceUpgradeReadbackAndDownstreamNonceRefreeze",
  "live.sameAddressMemberSigningCeremony",
  "live.providerAndNativeGasPath",
  "live.nativeTransportFuelAndInitialRefresh",
  "live.authenticatedCCIPDeliveryAndRevocation",
  "live.sourceAndEndpointPostState",
  "live.explicitActivationAuthorization",
];
function exactObject(value: unknown, allowed: string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unknown ${label}.${key}`);
  for (const key of allowed) if (!Object.hasOwn(value, key)) throw new Error(`Missing ${label}.${key}`);
  return value as Record<string, unknown>;
}
export function inspectLivePilotPackageConfig(value: unknown): LivePilotPackageConfig {
  const config = exactObject(
    value,
    ["schemaVersion", "releaseId", "manifests", "earnedFeeReserveMinimumWei"],
    "package",
  );
  if (
    config.schemaVersion !== 1 ||
    typeof config.releaseId !== "string" ||
    !/^[a-z0-9][a-z0-9-]{0,79}$/.test(config.releaseId)
  )
    throw new Error("Invalid live pilot package identity");
  const floor = config.earnedFeeReserveMinimumWei;
  if (floor !== null && (typeof floor !== "string" || !/^[1-9][0-9]*$/.test(floor) || BigInt(floor) >= 1n << 256n))
    throw new Error("Invalid earned fee reserve minimum");
  const refs = exactObject(config.manifests, Object.keys(MANIFEST_REFS), "manifests");
  for (const key of Object.keys(MANIFEST_REFS) as Component[])
    if (refs[key] !== MANIFEST_REFS[key]) throw new Error(`Package must use owned manifest ${key}`);
  return structuredClone(value) as LivePilotPackageConfig;
}
function match(a: string | null | undefined, b: string | null | undefined, label: string): void {
  if (a && b && getAddress(a) !== getAddress(b)) throw new Error(`Mismatched ${label}`);
}
function componentInputs(value: LivePilotManifests) {
  exactObject(value, Object.keys(MANIFEST_REFS), "component inputs");
  return {
    sourceUpgrades: inspectSourceUpgradeManifest(value.sourceUpgrades),
    stewardSafe: inspectStewardManifest(value.stewardSafe),
    vouchers: inspectVoucherManifest(value.vouchers),
    clc: inspectCLCReleaseManifest(value.clc),
  };
}
export function inspectLivePilotPackageInputs(
  config: unknown,
  manifests: LivePilotManifests,
): { config: LivePilotPackageConfig; deploymentMissing: string[]; activationMissing: string[] } {
  const parsed = inspectLivePilotPackageConfig(config);
  const reports = componentInputs(manifests);
  const source = reports.sourceUpgrades.manifest;
  const steward = reports.stewardSafe.manifest;
  const voucher = reports.vouchers.manifest;
  const clc = getCLCBaseManifest(reports.clc.manifest);
  match(source.authority.address, GG_SAFE, "source owner Safe");
  match(steward.greenGoodsSafe, GG_SAFE, "steward Green Goods Safe");
  for (const role of ["greenGoods", "sharedPool"] as const) {
    const safe = voucher.governance[role];
    if (safe.address === null || safe.threshold !== 2 || safe.ownerCount !== 5)
      throw new Error("Preserve existing Green Goods 2-of-5 control");
    match(safe.address, GG_SAFE, role);
  }
  if (
    source.authority.threshold !== 2 ||
    source.authority.owners.length !== 5 ||
    voucher.governance.techAndSun.threshold !== 2
  )
    throw new Error("Preserve fixed-two pilot Safe policy");
  match(voucher.governance.techAndSun.address, clc.techAndSunSafe, "Tech and Sun Safe");
  match(voucher.networks.arbitrum.commitmentPooling, source.pooling.proxy, "source Pooling proxy");
  match(voucher.networks.arbitrum.hatsModule, steward.hatsModule, "source Hats proxy");
  for (const network of ["arbitrum", "gnosis"] as const) {
    match(voucher.networks[network].owner, GG_SAFE, `${network} endpoint owner`);
    match(voucher.networks[network].router, steward.networks[network].router, `${network} CCIP router`);
  }
  const deploymentMissing = [
    ...reports.sourceUpgrades.missing.map((key) => `sourceUpgrades.${key}`),
    ...reports.stewardSafe.missing.map((key) => `stewardSafe.${key}`),
    ...reports.vouchers.missing.map((key) => `vouchers.${key}`),
    ...reports.clc.deploymentMissing.map((key) => `clc.${key}`),
  ];
  const activationMissing = [
    ...reports.stewardSafe.activationMissing.map((key) => `stewardSafe.${key}`),
    ...reports.vouchers.activationMissing.map((key) => `vouchers.${key}`),
    ...reports.clc.activationMissing.map((key) => `clc.${key}`),
    ...LIVE_GATES,
    ...(parsed.earnedFeeReserveMinimumWei === null ? ["live.earnedFeeReserveMinimumWei"] : []),
    "live.earnedFeeReserveConfigurationAndFundedBalanceReadback",
  ];
  return { config: parsed, deploymentMissing, activationMissing };
}
export function buildLivePilotPackage(input: LivePilotBuildInputs): LivePilotPackage {
  const report = inspectLivePilotPackageInputs(input.config, input.manifests);
  if (report.deploymentMissing.length)
    throw new Error(`Missing live package deployment inputs: ${report.deploymentMissing.join(", ")}`);
  if (!/^[a-f0-9]{40}$/.test(input.sourceCommit)) throw new Error("Exact package source revision required");
  const { plans: provided, artifacts: a, manifests: m, sourceCommit } = input;
  exactObject(provided, Object.keys(MANIFEST_REFS), "component plans");
  validateSourceUpgradePlan(provided.sourceUpgrades, m.sourceUpgrades, a.sourceUpgrades, sourceCommit);
  validateStewardPlan(provided.stewardSafe, m.stewardSafe, a.stewardSafe, sourceCommit);
  validateVoucherPlan(provided.vouchers, m.vouchers, a.vouchers, sourceCommit);
  validateCLCReleasePlan(provided.clc, m.clc as CLCReleaseManifest, a.clc, sourceCommit);
  const p: LivePilotPlans = {
    sourceUpgrades: provided.sourceUpgrades,
    stewardSafe: provided.stewardSafe,
    vouchers: provided.vouchers,
    clc: provided.clc,
  };
  const source = m.sourceUpgrades as SourceUpgradeManifest;
  const clc = getCLCBaseManifest(m.clc as CLCReleaseManifest);
  const proxy = (name: string) => {
    const tx = p.vouchers.transactions.find((t) => t.contract === name && t.kind === "proxy");
    if (!tx) throw new Error(`Missing validated voucher proxy ${name}`);
    return tx.address;
  };
  match(clc.earnedAdapter, proxy("GnosisVoucherAdapter"), "planned earned adapter proxy");
  const groups = new Map<string, LivePilotPackage["nativeNonceRanges"][number]>();
  const owners = new Set([
    GG_SAFE,
    getAddress(source.authority.address),
    ...(clc.techAndSunSafe ? [getAddress(clc.techAndSunSafe)] : []),
  ]);
  const reserveNonce = (sender: string, nonce: number, chainId: number, phase: "source" | "downstream") => {
    if (!Number.isSafeInteger(nonce)) throw new Error("Native nonce overflow");
    const from = getAddress(sender);
    const key = `${phase}:${chainId}:${from}`;
    if (owners.has(from)) throw new Error("Native sender cannot be an owner Safe");
    const previous = groups.get(key);
    const preceding = previous ?? (phase === "downstream" ? groups.get(`source:${chainId}:${from}`) : undefined);
    if (preceding && nonce !== preceding.lastNonce + 1)
      throw new Error("Native nonce overlap, gap or stage order mismatch");
    groups.set(key, {
      phase,
      chainId,
      from,
      firstNonce: previous?.firstNonce ?? nonce,
      lastNonce: nonce,
      count: (previous?.count ?? 0) + 1,
      requiresNonceRefreeze: phase === "downstream",
    });
  };
  const native = (
    tx: { from: string; nonce: number; to: string | null; value: "0"; data: string; address: string },
    chainId: number,
    phase: "source" | "downstream",
  ): PreparedTransaction => {
    const from = getAddress(tx.from);
    reserveNonce(from, tx.nonce, chainId, phase);
    return {
      chainId,
      from,
      to: tx.to,
      value: tx.value,
      data: tx.data,
      nonce: tx.nonce,
      expectedAddress: tx.address,
      operation: "native-deployment",
      missing: phase === "downstream" ? ["live.sourceUpgradeReadbackAndDownstreamNonceRefreeze"] : [],
      reviewOnly: true,
      ...(phase === "downstream" ? { requiresNonceRefreeze: true as const } : {}),
    };
  };
  const stage = (
    id: string,
    transactions: PreparedTransaction[],
    gates: string[] = [],
    instructions: string[] = [],
  ): Stage => ({ id, reviewOnly: true, transactions, gates, instructions });
  const ownerCall = (
    chainId: number,
    from: string | null,
    to: string | null,
    operation: string,
    data: string | null,
    missing: string[] = [],
  ): PreparedTransaction => ({ chainId, from, to, operation, data, value: "0", reviewOnly: true, missing });
  const sourceNative = p.sourceUpgrades.deployments.map((tx) => native(tx, 42161, "source"));
  // Each Safe call is submitted directly by the deployer after CREATEs; its Safe nonce stays independent.
  p.sourceUpgrades.ownerCalls.forEach((_, index) =>
    reserveNonce(source.deployer!, source.nonce! + p.sourceUpgrades.deployments.length + index, 42161, "source"),
  );
  const stewardNative = p.stewardSafe.transactions.map((tx) => native(tx, tx.chainId, "downstream"));
  const voucherNative = p.vouchers.transactions.map((tx) => native(tx, tx.chainId, "downstream"));
  const clcNative = p.clc.transactions.map((tx) => native(tx, 100, "downstream"));
  const pooling = new Interface([
    "function pinEarnedVoucherModule(address)",
    "function pinVoucherServiceSetupModule(address)",
  ]);
  const bindingCalls = [
    ownerCall(
      42161,
      GG_SAFE,
      source.pooling.proxy,
      "pinEarnedVoucherModule",
      pooling.encodeFunctionData("pinEarnedVoucherModule", [proxy("VoucherEntitlementModule")]),
    ),
    ownerCall(
      42161,
      GG_SAFE,
      source.pooling.proxy,
      "pinVoucherServiceSetupModule",
      pooling.encodeFunctionData("pinVoucherServiceSetupModule", [proxy("VoucherRedemptionModule")]),
    ),
  ];
  const issuerCalls = getCLCIssuerBindings(m.clc as CLCReleaseManifest, p.clc).map(
    ({ authority, reserve, token, missing }) => {
      return ownerCall(
        42161,
        GG_SAFE,
        proxy("VoucherEntitlementModule"),
        "setIssuerAuthority",
        authority
          ? new Interface(["function setIssuerAuthority(address,address,address)"]).encodeFunctionData(
              "setIssuerAuthority",
              [reserve, token, authority],
            )
          : null,
        missing,
      );
    },
  );
  const componentHashes = Object.fromEntries(
    (Object.keys(MANIFEST_REFS) as Component[]).map((key) => [
      key,
      { manifestHash: voucherDigest(m[key]), planHash: voucherDigest(p[key]) },
    ]),
  ) as LivePilotPackage["componentHashes"];
  const stages = [
    stage(
      "external-hats-upgrade",
      [],
      [LIVE_GATES[0]],
      [
        "Complete and verify bun run contracts -- upgrade hats-module --network arbitrum --mode simulate, then the separately authorized upgrade, before nonce freeze. Read back the exact Hats proxy, implementation and owner before observer registration.",
      ],
    ),
    stage("source-deployments", sourceNative),
    stage(
      "source-paused-upgrades",
      p.sourceUpgrades.ownerCalls.map((tx) => ({
        ...ownerCall(42161, tx.from, tx.to, tx.action, tx.data),
        safeNonce: tx.safeNonce,
      })),
      ["live.revalidatedSafeAndPendingDeployerNonces"],
    ),
    stage(
      "source-upgrade-boundary",
      [],
      ["live.sourceUpgradeReadbackAndDownstreamNonceRefreeze"],
      [
        "Stop after the paused source upgrade. VoucherRedemptionModule.initialize requires source serviceOfferProtocolVersion() and voucherAcceptanceProtocolVersion() equal 1. Verify actual source protocol, implementation, owner and pause state; then regenerate downstream plans and pending deployment nonces at the same committed source revision. This unsigned package cannot certify completion from a supplied JSON report.",
      ],
    ),
    stage("steward-deployments", stewardNative, ["live.sourceUpgradeReadbackAndDownstreamNonceRefreeze"]),
    stage("voucher-deployments", voucherNative, ["live.sourceUpgradeReadbackAndDownstreamNonceRefreeze"]),
    stage("clc-deployments", clcNative, ["live.sourceUpgradeReadbackAndDownstreamNonceRefreeze"]),
    stage("source-bindings", bindingCalls, ["live.upgradedPoolingPausedReadback"]),
    stage(
      "steward-observer",
      [
        ownerCall(
          42161,
          null,
          p.stewardSafe.observerRegistration.to,
          "setStewardObserver",
          p.stewardSafe.observerRegistration.data,
          ["live.verifiedHatsModuleOwner"],
        ),
      ],
      [LIVE_GATES[0]],
    ),
    stage("source-issuer-authorities", issuerCalls, [LIVE_GATES[1]]),
    stage(
      "earned-fee-reserve",
      [
        ownerCall(
          42161,
          GG_SAFE,
          proxy("VoucherEntitlementModule"),
          "setFeeReserveMinimum",
          report.config.earnedFeeReserveMinimumWei === null
            ? null
            : new Interface(["function setFeeReserveMinimum(uint256)"]).encodeFunctionData("setFeeReserveMinimum", [
                report.config.earnedFeeReserveMinimumWei,
              ]),
          report.config.earnedFeeReserveMinimumWei === null ? ["live.earnedFeeReserveMinimumWei"] : [],
        ),
      ],
      ["live.earnedFeeReserveConfigurationAndFundedBalanceReadback"],
      [
        "While paused, select and configure a positive retained minimum on the reviewed earned-source implementation. Fund the endpoint for the minimum plus dispatch fees; read back implementation, configured minimum and native balance before separately authorized activation.",
      ],
    ),
    stage(
      "clc-configuration",
      p.clc.configurationTransactions.map((tx) =>
        ownerCall(tx.chainId, tx.from, tx.to, tx.operation, tx.data, tx.missing),
      ),
      [LIVE_GATES[1]],
    ),
    stage(
      "clc-issuance",
      p.clc.issuanceTransactions.map((tx) => ownerCall(tx.chainId, tx.from, tx.to, tx.operation, tx.data, tx.missing)),
      report.activationMissing,
    ),
    stage("final-activation", [], report.activationMissing, [
      "Review fresh post-state and nonce receipts. After all signer, member, provider, terms, capacity, fuel and CCIP gates pass, separately authorize endpoint unpause and source Pooling resume. No activation transaction is prepared or sent automatically.",
    ]),
  ];
  return {
    schemaVersion: 1,
    kind: "LIVE_PILOT_PREPARATION",
    releaseId: report.config.releaseId,
    sourceCommit,
    configHash: voucherDigest(report.config),
    componentHashes,
    nativeNonceRanges: [...groups.values()],
    stages,
    deploymentMissing: report.deploymentMissing,
    activationMissing: report.activationMissing,
    executionReady: false,
    activationIncluded: false,
    liveBroadcast: false,
  };
}
