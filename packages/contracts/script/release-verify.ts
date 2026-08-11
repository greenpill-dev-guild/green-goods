#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";
import { Contract, getAddress, JsonRpcProvider, keccak256, toUtf8Bytes, ZeroAddress } from "ethers";
import {
  assertManifestMatchesNetworkDirectory,
  buildReleaseLock,
  CONTRACTS_ROOT,
  loadReleaseManifest,
  type ReleaseIdentity,
  type ReleaseNetwork,
  type ReleaseStage,
} from "./utils/release-manifest";
import { NetworkManager } from "./utils/network";
import { buildStageTransactionPlan, type ReleaseTransactionBoundary } from "./utils/release-plan";

const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const OWNER_ABI = ["function owner() view returns (address)", "function paused() view returns (bool)"];

interface Check {
  label: string;
  ok: boolean;
  expected: string;
  actual: string;
}

function parseArgs(args: string[]) {
  let network = "arbitrum";
  let pureSimulation = false;
  let artifactPath: string | undefined;
  let stage: ReleaseStage | undefined;
  let boundaryIndex: number | undefined;
  let baseSalt: string | undefined;
  let ownerPhase: "deployment" | "safe" = "deployment";
  for (let index = 2; index < args.length; index++) {
    if (args[index] === "--network") network = args[++index];
    else if (args[index] === "--pure-simulation") pureSimulation = true;
    else if (args[index] === "--artifact") artifactPath = args[++index];
    else if (args[index] === "--stage") stage = args[++index] as ReleaseStage;
    else if (args[index] === "--boundary-index") boundaryIndex = Number(args[++index]);
    else if (args[index] === "--salt") baseSalt = args[++index];
    else if (args[index] === "--owner-phase") {
      const value = args[++index];
      if (value !== "deployment" && value !== "safe") throw new Error("--owner-phase requires deployment or safe");
      ownerPhase = value;
    } else if (args[index] === "--help" || args[index] === "-h") {
      console.log(`
Read-only Commitment release verifier

Usage: bun script/release-verify.ts --network arbitrum|celo [--stage name] [--boundary-index n]
       [--artifact path] [--salt value] [--owner-phase deployment|safe] [--pure-simulation]

  --artifact          Verify an explicit recovery/simulation artifact instead of canonical latest JSON
  --stage             Scope verification to one exact release stage
  --boundary-index    Verify one transaction boundary; requires --stage
  --salt              Exact CREATE2 base salt used by the scoped plan
  --owner-phase       Exact expected proxy owner phase (default: deployment)
  --pure-simulation   Validate all expected identities and artifact rules without making RPC calls
`);
      process.exit(0);
    } else throw new Error(`Unknown option: ${args[index]}`);
  }
  if (network !== "arbitrum" && network !== "celo") throw new Error(`Unsupported release network ${network}`);
  if (stage && !["pooling", "settlement-module", "credit-registry", "settlement-executor"].includes(stage)) {
    throw new Error(`Unsupported release stage ${stage}`);
  }
  if (boundaryIndex !== undefined && (!Number.isSafeInteger(boundaryIndex) || boundaryIndex <= 0 || !stage)) {
    throw new Error("--boundary-index requires --stage and a positive safe integer");
  }
  return {
    network: network as ReleaseNetwork,
    pureSimulation,
    artifactPath,
    stage,
    boundaryIndex,
    baseSalt,
    ownerPhase,
  };
}

function artifactKey(identity: ReleaseIdentity): string {
  if (identity.kind === "library") {
    return `${identity.stage === "pooling" ? "poolingLibraries" : "settlementLibraries"}.${identity.name}`;
  }
  const base =
    identity.name === "CommitmentPoolingModule"
      ? "commitmentPoolingModule"
      : identity.name[0].toLowerCase() + identity.name.slice(1);
  return identity.kind === "proxy" ? base : `${base}Impl`;
}

function loadArtifact(explicitPath: string | undefined, chainId: string) {
  const artifactPath = explicitPath ?? path.join(CONTRACTS_ROOT, "deployments", `${chainId}-latest.json`);
  if (!fs.existsSync(artifactPath)) throw new Error(`Deployment artifact not found: ${artifactPath}`);
  return { artifactPath, value: JSON.parse(fs.readFileSync(artifactPath, "utf8")) as Record<string, unknown> };
}

function check(checks: Check[], label: string, expected: unknown, actual: unknown, normalizeHex = false) {
  const expectedText = String(expected);
  const actualText = String(actual);
  checks.push({
    label,
    expected: expectedText,
    actual: actualText,
    ok: normalizeHex ? expectedText.toLowerCase() === actualText.toLowerCase() : expectedText === actualText,
  });
}

function addressFromSlot(slot: string): string {
  return getAddress(`0x${slot.slice(-40)}`);
}

async function verifyCode(
  provider: JsonRpcProvider,
  identity: ReleaseIdentity,
  artifact: Record<string, unknown>,
  checks: Check[],
) {
  const key = artifactKey(identity);
  const artifactValue =
    identity.kind === "library"
      ? (artifact[key.split(".")[0]] as Record<string, unknown> | undefined)?.[identity.name]
      : artifact[key];
  check(checks, `artifact.${key}`, identity.address, artifactValue, true);
  const code = await provider.getCode(identity.address);
  check(checks, `${identity.kind}.${identity.name}.code-present`, true, code !== "0x");
  if (code === "0x") return;
  if (!identity.immutableRuntime) {
    check(
      checks,
      `${identity.kind}.${identity.name}.runtime-hash`,
      identity.runtimeTemplateHash,
      keccak256(code),
      true,
    );
  }
}

async function verifyProxy(
  provider: JsonRpcProvider,
  proxy: ReleaseIdentity,
  implementation: ReleaseIdentity,
  expectedOwner: string,
  checks: Check[],
) {
  const implementationSlot = await provider.getStorage(proxy.address, IMPLEMENTATION_SLOT);
  check(checks, `${proxy.name}.implementation-slot`, implementation.address, addressFromSlot(implementationSlot), true);
  const contract = new Contract(proxy.address, OWNER_ABI, provider);
  check(checks, `${proxy.name}.owner`, expectedOwner, await contract.owner(), true);
  if (
    ["CommitmentPoolingModule", "SettlementModule", "CreditRegistry", "CeloSettlementExecutor"].includes(proxy.name)
  ) {
    check(checks, `${proxy.name}.paused`, true, await contract.paused());
  }
}

async function verifySettlement(
  provider: JsonRpcProvider,
  address: string,
  network: ReleaseNetwork,
  lock: ReturnType<typeof buildReleaseLock>,
  checks: Check[],
) {
  const manifest = loadReleaseManifest();
  if (network === "arbitrum") {
    const expected = manifest.chains.arbitrum;
    const contract = new Contract(
      address,
      [
        "function CCIP_ROUTER() view returns (address)",
        "function SOURCE_CHAIN_SELECTOR() view returns (uint64)",
        "function DESTINATION_EVM_CHAIN_ID() view returns (uint64)",
        "function protocolGarden() view returns (address)",
        "function gDollarToken() view returns (address)",
        "function hatsModule() view returns (address)",
        "function commitmentPoolingModule() view returns (address)",
        "function creditRegistry() view returns (address)",
        "function ccipRoute() view returns (tuple(uint64 destinationChainSelector,address destinationExecutor,address previousDestinationExecutor,uint64 previousPeerExpiresAt,uint32 destinationGasLimit,uint8 protocolVersion))",
        "function batchSizeLimit() view returns (uint16)",
        "function dispatcher() view returns (address)",
        "function feeReserveMinimum() view returns (uint256)",
      ],
      provider,
    );
    check(checks, "SettlementModule.CCIP_ROUTER", expected.router, await contract.CCIP_ROUTER(), true);
    check(
      checks,
      "SettlementModule.SOURCE_CHAIN_SELECTOR",
      expected.ccipSelector,
      await contract.SOURCE_CHAIN_SELECTOR(),
    );
    check(
      checks,
      "SettlementModule.DESTINATION_EVM_CHAIN_ID",
      manifest.chains.celo.evmChainId,
      await contract.DESTINATION_EVM_CHAIN_ID(),
    );
    check(checks, "SettlementModule.protocolGarden", expected.protocolGarden, await contract.protocolGarden(), true);
    check(checks, "SettlementModule.gDollarToken", manifest.chains.celo.gDollar, await contract.gDollarToken(), true);
    check(checks, "SettlementModule.hatsModule", expected.hatsModule, await contract.hatsModule(), true);
    check(
      checks,
      "SettlementModule.commitmentPoolingModule",
      releaseProxy(lock, "CommitmentPoolingModule"),
      await contract.commitmentPoolingModule(),
      true,
    );
    const creditRegistry = releaseProxy(lock, "CreditRegistry");
    const creditCodePresent = (await provider.getCode(creditRegistry)) !== "0x";
    check(
      checks,
      "SettlementModule.creditRegistry",
      creditCodePresent ? creditRegistry : ZeroAddress,
      await contract.creditRegistry(),
      true,
    );
    const route = await contract.ccipRoute();
    const routeUnset = getAddress(route.destinationExecutor) === ZeroAddress;
    const executor = releaseProxy(lock, "CeloSettlementExecutor");
    const frozenGas = manifest.chains.arbitrum.destinationGasLimit ?? "0";
    check(
      checks,
      "SettlementModule.route.selector",
      routeUnset ? "0" : manifest.chains.celo.ccipSelector,
      route.destinationChainSelector,
    );
    check(
      checks,
      "SettlementModule.route.executor",
      routeUnset ? ZeroAddress : executor,
      route.destinationExecutor,
      true,
    );
    check(checks, "SettlementModule.route.previous", ZeroAddress, route.previousDestinationExecutor, true);
    check(checks, "SettlementModule.route.grace", "0", route.previousPeerExpiresAt);
    check(checks, "SettlementModule.route.gas", routeUnset ? "0" : frozenGas, route.destinationGasLimit);
    check(
      checks,
      "SettlementModule.route.version",
      routeUnset ? "0" : String(manifest.chains.celo.protocolVersion),
      route.protocolVersion,
    );
    check(checks, "SettlementModule.batchSizeLimit-before-value-authority", "0", await contract.batchSizeLimit());
    check(checks, "SettlementModule.dispatcher-before-activation", ZeroAddress, await contract.dispatcher(), true);
    check(checks, "SettlementModule.feeReserveMinimum-before-activation", "0", await contract.feeReserveMinimum());
  } else {
    const expected = manifest.chains.celo;
    const contract = new Contract(
      address,
      [
        "function CCIP_ROUTER() view returns (address)",
        "function G_DOLLAR_TOKEN() view returns (address)",
        "function LOCAL_CHAIN_SELECTOR() view returns (uint64)",
        "function SOURCE_EVM_CHAIN_ID() view returns (uint64)",
        "function sourcePeer() view returns (tuple(uint64 sourceChainSelector,address sourceSettlementModule,address previousSourceSettlementModule,uint64 previousPeerExpiresAt,uint8 protocolVersion))",
        "function maxBatchSize() view returns (uint16)",
        "function maxTransferAmount() view returns (uint256)",
        "function maxBatchAmount() view returns (uint256)",
        "function maxFeeBps() view returns (uint16)",
        "function maxFeeAmount() view returns (uint256)",
        "function periodDuration() view returns (uint64)",
        "function maxPeriodAmount() view returns (uint256)",
        "function acknowledgmentFeeReserveMinimum() view returns (uint256)",
      ],
      provider,
    );
    check(checks, "CeloExecutor.CCIP_ROUTER", expected.router, await contract.CCIP_ROUTER(), true);
    check(checks, "CeloExecutor.G_DOLLAR_TOKEN", expected.gDollar, await contract.G_DOLLAR_TOKEN(), true);
    check(checks, "CeloExecutor.LOCAL_CHAIN_SELECTOR", expected.ccipSelector, await contract.LOCAL_CHAIN_SELECTOR());
    check(
      checks,
      "CeloExecutor.SOURCE_EVM_CHAIN_ID",
      manifest.chains.arbitrum.evmChainId,
      await contract.SOURCE_EVM_CHAIN_ID(),
    );
    const peer = await contract.sourcePeer();
    check(checks, "CeloExecutor.sourcePeer.selector", manifest.chains.arbitrum.ccipSelector, peer.sourceChainSelector);
    check(
      checks,
      "CeloExecutor.sourcePeer.module",
      buildReleaseLock().identities.find((item) => item.name === "SettlementModule" && item.kind === "proxy")?.address,
      peer.sourceSettlementModule,
      true,
    );
    check(checks, "CeloExecutor.sourcePeer.previous", ZeroAddress, peer.previousSourceSettlementModule, true);
    check(checks, "CeloExecutor.sourcePeer.grace", "0", peer.previousPeerExpiresAt);
    check(checks, "CeloExecutor.sourcePeer.version", String(expected.protocolVersion), peer.protocolVersion);
    for (const [label, getter] of [
      ["maxBatchSize", "maxBatchSize"],
      ["maxTransferAmount", "maxTransferAmount"],
      ["maxBatchAmount", "maxBatchAmount"],
      ["maxFeeBps", "maxFeeBps"],
      ["maxFeeAmount", "maxFeeAmount"],
      ["periodDuration", "periodDuration"],
      ["maxPeriodAmount", "maxPeriodAmount"],
      ["acknowledgmentFeeReserveMinimum", "acknowledgmentFeeReserveMinimum"],
    ] as const) {
      check(checks, `CeloExecutor.${label}-before-value-authority`, "0", await contract[getter]());
    }
  }
}

function deploymentFor(chainId: string): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(CONTRACTS_ROOT, "deployments", `${chainId}-latest.json`), "utf8"),
  ) as Record<string, unknown>;
}

function releaseProxy(lock: ReturnType<typeof buildReleaseLock>, name: string): string {
  const address = lock.identities.find((item) => item.kind === "proxy" && item.name === name)?.address;
  if (!address) throw new Error(`Missing release proxy ${name}`);
  return address;
}

async function verifyCreditBinding(
  provider: JsonRpcProvider,
  lock: ReturnType<typeof buildReleaseLock>,
  checks: Check[],
) {
  const settlementAddress = releaseProxy(lock, "SettlementModule");
  const creditAddress = releaseProxy(lock, "CreditRegistry");
  const settlement = new Contract(
    settlementAddress,
    ["function creditRegistry() view returns (address)", "function paused() view returns (bool)"],
    provider,
  );
  const credit = new Contract(
    creditAddress,
    [
      "function owner() view returns (address)",
      "function hatsModule() view returns (address)",
      "function commitmentPoolingModule() view returns (address)",
      "function settlementModule() view returns (address)",
      "function nextLoanId() view returns (uint256)",
      "function activeReservationCount() view returns (uint256)",
      "function paused() view returns (bool)",
    ],
    provider,
  );
  const manifest = loadReleaseManifest();
  check(checks, "SettlementModule.creditRegistry", creditAddress, await settlement.creditRegistry(), true);
  check(checks, "CreditRegistry.settlementModule", settlementAddress, await credit.settlementModule(), true);
  check(checks, "CreditRegistry.hatsModule", manifest.chains.arbitrum.hatsModule, await credit.hatsModule(), true);
  check(
    checks,
    "CreditRegistry.commitmentPoolingModule",
    releaseProxy(lock, "CommitmentPoolingModule"),
    await credit.commitmentPoolingModule(),
    true,
  );
  check(checks, "CreditRegistry.nextLoanId", "1", await credit.nextLoanId());
  check(checks, "CreditRegistry.activeReservationCount", "0", await credit.activeReservationCount());
  check(checks, "SettlementModule.paused-after-credit-binding", true, await settlement.paused());
  check(checks, "CreditRegistry.paused-after-credit-binding", true, await credit.paused());
}

async function verifyConfigurationBoundary(
  provider: JsonRpcProvider,
  boundary: ReleaseTransactionBoundary,
  manifest: ReturnType<typeof loadReleaseManifest>,
  lock: ReturnType<typeof buildReleaseLock>,
  deployment: Record<string, unknown>,
  expectedOwner: string,
  checks: Check[],
) {
  if (boundary.stage === "credit-registry") {
    await verifyCreditBinding(provider, lock, checks);
    return;
  }
  if (boundary.stage !== "pooling") throw new Error(`No configuration verifier for ${boundary.stage}`);
  if (boundary.label === "set Assessment v3 schema UID") {
    const schemas = (deployment.schemas ?? {}) as Record<string, unknown>;
    const v3 =
      schemas.assessmentV3SchemaUID ?? manifest.schemas.find((schema) => schema.identity === "assessment-v3")?.uid;
    const assessment = new Contract(
      boundary.to,
      [
        "function owner() view returns (address)",
        "function schemaUID() view returns (bytes32)",
        "function assessmentV3SchemaUID() view returns (bytes32)",
      ],
      provider,
    );
    check(checks, "AssessmentResolver.owner-after-boundary", expectedOwner, await assessment.owner(), true);
    check(checks, "AssessmentResolver.schemaUID", schemas.assessmentSchemaUID, await assessment.schemaUID(), true);
    check(checks, "AssessmentResolver.assessmentV3SchemaUID", v3, await assessment.assessmentV3SchemaUID(), true);
    return;
  }
  const module = new Contract(
    releaseProxy(lock, "CommitmentPoolingModule"),
    [
      "function owner() view returns (address)",
      "function paused() view returns (bool)",
      "function gardenToken() view returns (address)",
      "function hatsModule() view returns (address)",
      "function actionRegistry() view returns (address)",
      "function commitmentRegistry() view returns (address)",
      "function workApprovalResolver() view returns (address)",
      "function eas() view returns (address)",
      "function workSchemaUID() view returns (bytes32)",
      "function workApprovalSchemaUID() view returns (bytes32)",
      "function legacyAssessmentSchemaUID() view returns (bytes32)",
      "function assessmentV3SchemaUID() view returns (bytes32)",
    ],
    provider,
  );
  const schemas = (deployment.schemas ?? {}) as Record<string, unknown>;
  const eas = (deployment.eas ?? {}) as Record<string, unknown>;
  const single: Record<string, { getter: string; expected: unknown; hex?: boolean }> = {
    "set garden token": { getter: "gardenToken", expected: deployment.gardenToken, hex: true },
    "set Hats module": { getter: "hatsModule", expected: deployment.hatsModule, hex: true },
    "set action registry": { getter: "actionRegistry", expected: deployment.actionRegistry, hex: true },
    "set commitment registry": {
      getter: "commitmentRegistry",
      expected: releaseProxy(lock, "CommitmentRegistry"),
      hex: true,
    },
    "set work-approval resolver": {
      getter: "workApprovalResolver",
      expected: deployment.workApprovalResolver,
      hex: true,
    },
    "set EAS": { getter: "eas", expected: eas.address, hex: true },
  };
  const exact = single[boundary.label];
  if (exact) {
    check(checks, `CommitmentPoolingModule.${exact.getter}`, exact.expected, await module[exact.getter](), exact.hex);
  } else if (boundary.label === "set four pairwise-distinct schema UIDs") {
    for (const [getter, key] of [
      ["workSchemaUID", "workSchemaUID"],
      ["workApprovalSchemaUID", "workApprovalSchemaUID"],
      ["legacyAssessmentSchemaUID", "assessmentSchemaUID"],
      ["assessmentV3SchemaUID", "assessmentV3SchemaUID"],
    ] as const) {
      const expected =
        key === "assessmentV3SchemaUID"
          ? (schemas[key] ?? manifest.schemas.find((schema) => schema.identity === "assessment-v3")?.uid)
          : schemas[key];
      check(checks, `CommitmentPoolingModule.${getter}`, expected, await module[getter](), true);
    }
  } else {
    throw new Error(`Unknown pooling configuration boundary ${boundary.label}`);
  }
  check(checks, "CommitmentPoolingModule.owner-after-boundary", expectedOwner, await module.owner(), true);
  check(checks, "CommitmentPoolingModule.paused-after-boundary", true, await module.paused());
}

async function main() {
  const args = parseArgs(process.argv);
  const manifest = loadReleaseManifest();
  assertManifestMatchesNetworkDirectory(manifest);
  const baseSalt = args.baseSalt ?? `${manifest.create2.domain}:${manifest.create2.version}`;
  const lock = buildReleaseLock(manifest, baseSalt);
  const chain = manifest.chains[args.network];
  const expectedOwner =
    args.ownerPhase === "safe" ? manifest.ownership.protocolSafe : manifest.ownership.deploymentSender;
  const { artifactPath, value: artifact } = loadArtifact(args.artifactPath, chain.evmChainId);
  const deployment = deploymentFor(chain.evmChainId);
  let boundary: ReleaseTransactionBoundary | undefined;
  if (args.stage) {
    const expectedNetwork = args.stage === "settlement-executor" ? "celo" : "arbitrum";
    if (expectedNetwork !== args.network)
      throw new Error(`${args.stage} belongs to ${expectedNetwork}, not ${args.network}`);
    if (args.boundaryIndex !== undefined) {
      const plan = buildStageTransactionPlan(manifest, lock, args.stage, deployment, baseSalt);
      boundary = plan.transactions[args.boundaryIndex - 1];
      if (!boundary) throw new Error(`${args.stage} has no boundary ${args.boundaryIndex}`);
    }
  }
  let identities = lock.identities.filter(
    (identity) => identity.network === args.network && (!args.stage || identity.stage === args.stage),
  );
  if (boundary) {
    identities =
      boundary.kind === "create2"
        ? identities.filter((identity) => identity.address.toLowerCase() === boundary?.expectedAddress?.toLowerCase())
        : [];
    if (boundary.kind === "create2" && identities.length !== 1) {
      throw new Error(`Boundary ${boundary.index} does not resolve to exactly one deterministic identity`);
    }
  }
  const checks: Check[] = [];

  check(checks, "manifest.network.chain-id-string", chain.evmChainId, BigInt(chain.evmChainId).toString());
  check(checks, "manifest.network.selector-string", chain.ccipSelector, BigInt(chain.ccipSelector).toString());
  check(checks, "manifest.safe-authority-disabled", false, manifest.safeAuthority.enabled);
  check(checks, "manifest.indexer-activation-disabled", false, manifest.indexer.activationAuthorized);
  check(
    checks,
    "indexer-config-hash-recorded",
    manifest.indexer.configHash,
    keccak256(toUtf8Bytes(fs.readFileSync(path.join(CONTRACTS_ROOT, "../indexer/config.yaml"), "utf8"))),
    true,
  );

  if (args.pureSimulation) {
    for (const identity of identities) {
      const key = artifactKey(identity);
      const current =
        identity.kind === "library"
          ? (artifact[key.split(".")[0]] as Record<string, unknown> | undefined)?.[identity.name]
          : artifact[key];
      const ok =
        current === undefined ||
        current === null ||
        current === "" ||
        String(current).toLowerCase() === identity.address.toLowerCase();
      checks.push({
        label: `pre-broadcast-artifact.${key}`,
        ok,
        expected: `absent/null or ${identity.address}`,
        actual: String(current),
      });
    }
  } else {
    const networkManager = new NetworkManager();
    const provider = new JsonRpcProvider(networkManager.getRpcUrl(args.network), Number(chain.evmChainId), {
      staticNetwork: true,
    });
    const liveNetwork = await provider.getNetwork();
    check(checks, "rpc.chain-id", chain.evmChainId, liveNetwork.chainId);
    if (args.network === "celo") {
      // Foundry's static chain table still labels chain 42220 as pre-Shanghai and emits an
      // EIP-3855 warning. The live Celo L2 enabled Shanghai and Cancun at migration, so execute a
      // minimal PUSH0 creation call against the selected RPC instead of trusting that stale table.
      check(checks, "rpc.eip-3855-push0", "0x", await provider.call({ data: "0x5f00" }), true);
    }
    for (const identity of identities) await verifyCode(provider, identity, artifact, checks);
    for (const proxy of identities.filter((item) => item.kind === "proxy")) {
      const implementation = identities.find((item) => item.kind === "implementation" && item.name === proxy.name);
      if (!implementation) throw new Error(`Missing implementation for ${proxy.name}`);
      await verifyProxy(provider, proxy, implementation, expectedOwner, checks);
      if (proxy.name === "CommitmentRegistry") {
        const registry = new Contract(proxy.address, ["function module() view returns (address)"], provider);
        check(
          checks,
          "CommitmentRegistry.module",
          releaseProxy(lock, "CommitmentPoolingModule"),
          await registry.module(),
          true,
        );
      }
    }
    if (boundary?.kind === "configuration") {
      await verifyConfigurationBoundary(provider, boundary, manifest, lock, deployment, expectedOwner, checks);
    } else {
      const settlementName = args.network === "arbitrum" ? "SettlementModule" : "CeloSettlementExecutor";
      const settlementProxy = identities.find((item) => item.name === settlementName && item.kind === "proxy");
      if (settlementProxy) await verifySettlement(provider, settlementProxy.address, args.network, lock, checks);
      if (args.stage === "credit-registry" && !boundary) await verifyCreditBinding(provider, lock, checks);
      if (args.stage === "pooling" && !boundary) {
        const plan = buildStageTransactionPlan(manifest, lock, args.stage, deployment, baseSalt);
        for (const transaction of plan.transactions.filter((item) => item.kind === "configuration")) {
          await verifyConfigurationBoundary(provider, transaction, manifest, lock, deployment, expectedOwner, checks);
        }
      }
    }
  }

  const failures = checks.filter((item) => !item.ok);
  console.log(
    `Release verification: ${args.network}${args.stage ? ` / ${args.stage}` : ""}${args.boundaryIndex ? ` / boundary ${args.boundaryIndex}` : ""}`,
  );
  console.log(`Artifact: ${artifactPath}`);
  for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"} ${item.label}: ${item.actual}`);
  if (failures.length > 0) {
    console.error(`\n${failures.length} release verification check(s) failed:`);
    for (const failure of failures)
      console.error(`- ${failure.label}: expected ${failure.expected}, got ${failure.actual}`);
    process.exit(1);
  }
  console.log(`\nAll ${checks.length} release verification checks passed.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
