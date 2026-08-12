import * as fs from "node:fs";
import * as path from "node:path";
import {
  AbiCoder,
  concat,
  getAddress,
  getCreate2Address,
  Interface,
  type InterfaceAbi,
  isAddress,
  keccak256,
  toUtf8Bytes,
  ZeroAddress,
} from "ethers";

export const CONTRACTS_ROOT = path.join(__dirname, "../..");
export const RELEASE_MANIFEST_PATH = path.join(CONTRACTS_ROOT, "config/commitment-pooling-release.json");
export const PRODUCTION_ARTIFACT_ROOT = path.join(CONTRACTS_ROOT, ".generated/foundry/out/production");

export type ReleaseNetwork = "arbitrum" | "celo";
export type ReleaseStage = "pooling" | "settlement-module" | "credit-registry" | "settlement-executor";

interface ChainManifest {
  evmChainId: string;
  ccipSelector: string;
  router: string;
  peerNetwork: ReleaseNetwork;
  peerSelector: string;
  protocolVersion: number;
  paused: boolean;
  destinationGasLimit?: string;
  destinationGasMeasurement?: {
    fixture: string;
    batchSize: string;
    gasUsed: string;
    includesAcknowledgmentAttempt: boolean;
    liveSafeZodiacMeasured: boolean;
    measuredOn: string;
    status: "local-hard-max-green-live-authority-pending" | "final-live-authority-green";
  };
  protocolGarden?: string;
  hatsModule?: string;
  eas?: string;
  schemaRegistry?: string;
  gDollar?: string;
}

export interface ReleaseManifest {
  schemaVersion: number;
  releaseId: string;
  sourceCommit: string;
  build: Record<string, unknown>;
  create2: { factory: string; domain: string; version: string };
  ownership: {
    releaseOwner: string;
    deploymentSender: string;
    deploymentKeystore: string;
    protocolSafe: string;
    protocolSafeConfiguration: {
      threshold: string;
      owners: string[];
      ownerDecisionDate: string;
      contractsGuideMinimumThreshold: string;
      contractsGuideMinimumOwnerCount: string;
      guidePolicyStatus: "satisfied";
    };
    rollbackOwnerBeforeTransfer: string;
    rollbackOwnerAfterTransfer: string;
    gardenRecoveryOwner: string;
    timelockWaivedForRelease: boolean;
  };
  ceremony: {
    endState: "paused-deployer-owned";
    ownershipTransferIncluded: false;
    poolBackfillIncluded: false;
    unpauseIncluded: false;
    followUpIssueRequired: true;
  };
  batching: {
    hardMaxBatchSize: string;
    releaseBatchSizeLimit: string;
    activationIncluded: false;
    sourceAcknowledgmentGasLimit: string;
    sourceAcknowledgmentMeasurement: {
      acceptedFixture: string;
      firstRejectedFixture: string;
      hardMaxFixture: string;
      acceptedBatchSize: string;
      acceptedGasUsed: string;
      firstRejectedBatchSize: string;
      firstRejectedGasUsed: string;
      distinctFundedPlans: true;
      coldDependencyPath: true;
      commitmentPoolingReadFree: true;
      measuredOn: string;
      status: "local-cold-state-green";
    };
  };
  chains: Record<ReleaseNetwork, ChainManifest>;
  schemas: Array<{ identity: string; uid: string; resolver: string; moduleRelationship: string }>;
  schemaPreparation: {
    network: "arbitrum";
    name: "TestimonyResolver";
    implementationArtifact: string;
    proxyArtifact: string;
    owner: string;
    initializer: string;
    constructorEAS: string;
    create2: {
      factory: string;
      saltNamespace: string;
      version: string;
      implementationSalt: string;
      proxySalt: string;
    };
    expected: {
      implementation: string;
      proxy: string;
      implementationCreationCodeHash: string;
      implementationRuntimeTemplateHash: string;
      proxyCreationCodeHash: string;
      proxyRuntimeTemplateHash: string;
    };
  };
  existingProxyUpgrades: Array<{
    name: string;
    stage: string;
    proxy: string;
    currentImplementation: string;
    currentImplementationCodeHash: string;
    currentOwner: string;
    currentCeremonyEndOwner: string;
    finalArtifact: string;
    constructorArguments: string[];
    expectedImplementationCreationCodeHash: string;
    implementationAddressPolicy: string;
    initializerPolicy: string;
    linkedLibraries: Record<string, string>;
  }>;
  targets: Array<{
    name: string;
    stage: ReleaseStage;
    network: ReleaseNetwork;
    artifact: string;
    proxy: boolean;
    initializer: string;
    owner: string;
    paused?: boolean;
  }>;
  safeAuthority: {
    enabled: boolean;
    safeSingleton: string;
    safeFactory: string;
    gardenSafes: unknown[];
    zodiacRoles: Record<string, unknown>;
    caps: Record<string, unknown>;
    feePolicy: Record<string, unknown>;
  };
  indexer: {
    activationAuthorized: boolean;
    configHash: string;
    ownerLane: "PRD-722";
    handoffOnly: true;
    networks: unknown[];
    reindex: string;
    cutover: string;
    readBack: string;
  };
}

interface FoundryArtifact {
  abi: InterfaceAbi;
  bytecode: { object: string; linkReferences?: LinkReferences };
  deployedBytecode: { object: string; linkReferences?: LinkReferences; immutableReferences?: Record<string, unknown> };
}

type LinkReferences = Record<string, Record<string, Array<{ start: number; length: number }>>>;

export interface ReleaseIdentity {
  name: string;
  kind: "library" | "implementation" | "proxy";
  network: ReleaseNetwork;
  stage: ReleaseStage;
  salt: string;
  address: string;
  artifact: string;
  creationCodeHash: string;
  runtimeTemplateHash: string;
  immutableRuntime: boolean;
  libraries: Record<string, string>;
}

export interface ReleaseLock {
  schemaVersion: 1;
  releaseId: string;
  sourceCommit: string;
  manifestHash: string;
  build: Record<string, unknown>;
  create2: ReleaseManifest["create2"];
  owner: string;
  identities: ReleaseIdentity[];
  libraryMap: Record<string, string>;
}

const EXPECTED_RELEASE_IDENTITY_COUNTS = {
  libraries: 21,
  implementations: 5,
  proxies: 5,
} as const;

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function loadReleaseManifest(filePath = RELEASE_MANIFEST_PATH): ReleaseManifest {
  const manifest = readJson<ReleaseManifest>(filePath);
  validateReleaseManifest(manifest);
  return manifest;
}

function requireAddress(value: unknown, label: string) {
  if (typeof value !== "string" || !isAddress(value) || getAddress(value) === ZeroAddress) {
    throw new Error(`${label} must be a non-zero EVM address`);
  }
}

function requireUintString(value: unknown, label: string, bits = 64) {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/u.test(value)) {
    throw new Error(`${label} must be a base-10 string, never a JavaScript number`);
  }
  const parsed = BigInt(value);
  if (parsed <= 0n || parsed > (1n << BigInt(bits)) - 1n)
    throw new Error(`${label} does not round-trip to uint${bits}`);
}

export function validateReleaseManifest(manifest: ReleaseManifest): void {
  if (manifest.schemaVersion !== 1) throw new Error(`Unsupported release manifest version ${manifest.schemaVersion}`);
  if (!/^[0-9a-f]{40}$/u.test(manifest.sourceCommit)) throw new Error("sourceCommit must be an exact 40-character SHA");
  requireAddress(manifest.create2.factory, "create2.factory");
  for (const key of [
    "deploymentSender",
    "protocolSafe",
    "rollbackOwnerBeforeTransfer",
    "rollbackOwnerAfterTransfer",
    "gardenRecoveryOwner",
  ] as const) {
    requireAddress(manifest.ownership[key], `ownership.${key}`);
  }
  if (getAddress(manifest.ownership.deploymentSender) !== getAddress(manifest.ownership.rollbackOwnerBeforeTransfer)) {
    throw new Error("The pre-transfer rollback owner must be the exact deployment sender");
  }
  if (getAddress(manifest.ownership.protocolSafe) !== getAddress(manifest.ownership.rollbackOwnerAfterTransfer)) {
    throw new Error("The post-transfer rollback owner must be the protocol Safe");
  }
  const safeConfiguration = manifest.ownership.protocolSafeConfiguration;
  requireUintString(safeConfiguration.threshold, "ownership.protocolSafeConfiguration.threshold", 16);
  requireUintString(
    safeConfiguration.contractsGuideMinimumThreshold,
    "ownership.protocolSafeConfiguration.contractsGuideMinimumThreshold",
    16,
  );
  requireUintString(
    safeConfiguration.contractsGuideMinimumOwnerCount,
    "ownership.protocolSafeConfiguration.contractsGuideMinimumOwnerCount",
    16,
  );
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(safeConfiguration.ownerDecisionDate)) {
    throw new Error("ownership.protocolSafeConfiguration.ownerDecisionDate must be an exact YYYY-MM-DD date");
  }
  if (safeConfiguration.owners.length === 0) {
    throw new Error("ownership.protocolSafeConfiguration.owners must freeze the exact non-empty owner set");
  }
  const safeOwners = new Set<string>();
  for (const [index, owner] of safeConfiguration.owners.entries()) {
    requireAddress(owner, `ownership.protocolSafeConfiguration.owners.${index}`);
    const normalized = getAddress(owner).toLowerCase();
    if (safeOwners.has(normalized)) throw new Error(`Duplicate protocol Safe owner: ${owner}`);
    safeOwners.add(normalized);
  }
  if (BigInt(safeConfiguration.threshold) > BigInt(safeConfiguration.owners.length)) {
    throw new Error("Protocol Safe threshold exceeds the frozen owner count");
  }
  const guideMinimum = BigInt(safeConfiguration.contractsGuideMinimumThreshold);
  const guideMinimumOwners = BigInt(safeConfiguration.contractsGuideMinimumOwnerCount);
  const targetThreshold = BigInt(safeConfiguration.threshold);
  const targetOwnerCount = BigInt(safeConfiguration.owners.length);
  if (targetThreshold < guideMinimum || targetOwnerCount < guideMinimumOwners) {
    throw new Error(`Protocol Safe must have threshold >= ${guideMinimum} and owner count >= ${guideMinimumOwners}`);
  }
  if (safeConfiguration.guidePolicyStatus !== "satisfied") {
    throw new Error("Protocol Safe guide policy status must be satisfied");
  }
  if (
    manifest.ceremony?.endState !== "paused-deployer-owned" ||
    manifest.ceremony.ownershipTransferIncluded !== false ||
    manifest.ceremony.poolBackfillIncluded !== false ||
    manifest.ceremony.unpauseIncluded !== false ||
    manifest.ceremony.followUpIssueRequired !== true
  ) {
    throw new Error(
      "The current ceremony must end paused and deployer-owned; ownership transfer, pool backfill, and unpause require a later issue",
    );
  }

  const batching = manifest.batching;
  requireUintString(batching.hardMaxBatchSize, "batching.hardMaxBatchSize", 16);
  requireUintString(batching.releaseBatchSizeLimit, "batching.releaseBatchSizeLimit", 16);
  requireUintString(batching.sourceAcknowledgmentGasLimit, "batching.sourceAcknowledgmentGasLimit", 32);
  if (batching.hardMaxBatchSize !== "24") {
    throw new Error("batching.hardMaxBatchSize must match the compile-time ceiling of 24");
  }
  if (BigInt(batching.releaseBatchSizeLimit) > BigInt(batching.hardMaxBatchSize)) {
    throw new Error("batching.releaseBatchSizeLimit exceeds the compile-time ceiling");
  }
  if (batching.activationIncluded !== false) {
    throw new Error("The paused deployer-owned ceremony may freeze but not activate batching");
  }
  const sourceMeasurement = batching.sourceAcknowledgmentMeasurement;
  requireUintString(sourceMeasurement.acceptedBatchSize, "batching.acceptedBatchSize", 16);
  requireUintString(sourceMeasurement.acceptedGasUsed, "batching.acceptedGasUsed", 32);
  requireUintString(sourceMeasurement.firstRejectedBatchSize, "batching.firstRejectedBatchSize", 16);
  requireUintString(sourceMeasurement.firstRejectedGasUsed, "batching.firstRejectedGasUsed", 32);
  if (
    !sourceMeasurement.acceptedFixture.trim() ||
    !sourceMeasurement.firstRejectedFixture.trim() ||
    !sourceMeasurement.hardMaxFixture.trim()
  ) {
    throw new Error("batching source-acknowledgment fixtures must name all three measured entrypoints");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(sourceMeasurement.measuredOn)) {
    throw new Error("batching.sourceAcknowledgmentMeasurement.measuredOn must be an exact YYYY-MM-DD date");
  }
  if (
    sourceMeasurement.status !== "local-cold-state-green" ||
    !sourceMeasurement.distinctFundedPlans ||
    !sourceMeasurement.coldDependencyPath ||
    !sourceMeasurement.commitmentPoolingReadFree
  ) {
    throw new Error("batching source-acknowledgment measurement must freeze the reviewed cold local path");
  }
  if (
    sourceMeasurement.acceptedBatchSize !== batching.releaseBatchSizeLimit ||
    BigInt(sourceMeasurement.firstRejectedBatchSize) !== BigInt(batching.releaseBatchSizeLimit) + 1n
  ) {
    throw new Error("batching measurement must prove the frozen limit and its first rejected size");
  }
  if (
    BigInt(sourceMeasurement.acceptedGasUsed) > BigInt(batching.sourceAcknowledgmentGasLimit) ||
    BigInt(sourceMeasurement.firstRejectedGasUsed) <= BigInt(batching.sourceAcknowledgmentGasLimit)
  ) {
    throw new Error("batching source-acknowledgment gas boundary is not proven");
  }

  for (const [network, chain] of Object.entries(manifest.chains) as Array<[ReleaseNetwork, ChainManifest]>) {
    requireUintString(chain.evmChainId, `${network}.evmChainId`);
    requireUintString(chain.ccipSelector, `${network}.ccipSelector`);
    requireUintString(chain.peerSelector, `${network}.peerSelector`);
    requireAddress(chain.router, `${network}.router`);
    if (!chain.paused) throw new Error(`${network} candidate must initialize paused`);
    if (chain.destinationGasLimit !== undefined) {
      if (typeof chain.destinationGasLimit !== "string" || !/^(0|[1-9][0-9]*)$/u.test(chain.destinationGasLimit)) {
        throw new Error(`${network}.destinationGasLimit must be a base-10 string, never a JavaScript number`);
      }
      if (BigInt(chain.destinationGasLimit) > (1n << 32n) - 1n) {
        throw new Error(`${network}.destinationGasLimit does not round-trip to uint32`);
      }
    }
    if (chain.destinationGasMeasurement !== undefined) {
      requireUintString(
        chain.destinationGasMeasurement.batchSize,
        `${network}.destinationGasMeasurement.batchSize`,
        16,
      );
      requireUintString(chain.destinationGasMeasurement.gasUsed, `${network}.destinationGasMeasurement.gasUsed`, 32);
      if (!/^\d{4}-\d{2}-\d{2}$/u.test(chain.destinationGasMeasurement.measuredOn)) {
        throw new Error(`${network}.destinationGasMeasurement.measuredOn must be an exact YYYY-MM-DD date`);
      }
      if (!chain.destinationGasMeasurement.fixture.trim()) {
        throw new Error(`${network}.destinationGasMeasurement.fixture must name the exact measured entrypoint`);
      }
      if (chain.destinationGasMeasurement.batchSize !== "24") {
        throw new Error(`${network}.destinationGasMeasurement must exercise the compile-time hard maximum of 24`);
      }
      if (!chain.destinationGasMeasurement.includesAcknowledgmentAttempt) {
        throw new Error(`${network}.destinationGasMeasurement must include the acknowledgment attempt`);
      }
      const finalMeasurement = chain.destinationGasMeasurement.status === "final-live-authority-green";
      if (chain.destinationGasMeasurement.liveSafeZodiacMeasured !== finalMeasurement) {
        throw new Error(`${network}.destinationGasMeasurement status does not match live Safe/Zodiac proof`);
      }
      if (!finalMeasurement && chain.destinationGasLimit !== "0") {
        throw new Error(`${network}.destinationGasLimit must remain zero until live Safe/Zodiac measurement is green`);
      }
      if (
        finalMeasurement &&
        (chain.destinationGasLimit === undefined ||
          BigInt(chain.destinationGasLimit) < BigInt(chain.destinationGasMeasurement.gasUsed))
      ) {
        throw new Error(`${network}.destinationGasLimit must cover the final live-authority measurement`);
      }
    }
    const peer = manifest.chains[chain.peerNetwork];
    if (!peer || peer.ccipSelector !== chain.peerSelector || peer.peerSelector !== chain.ccipSelector) {
      throw new Error(`${network} does not describe the exact bidirectional CCIP route`);
    }
  }
  requireAddress(manifest.chains.celo.gDollar, "celo.gDollar");

  const identities = new Set<string>();
  const exactUids = new Set<string>();
  for (const schema of manifest.schemas) {
    if (identities.has(schema.identity)) throw new Error(`Duplicate schema identity: ${schema.identity}`);
    identities.add(schema.identity);
    if (/^0x[0-9a-f]{64}$/iu.test(schema.uid)) {
      const normalized = schema.uid.toLowerCase();
      if (exactUids.has(normalized)) throw new Error(`Duplicate exact schema UID: ${schema.uid}`);
      exactUids.add(normalized);
    } else if (!schema.uid.startsWith("deployment:")) {
      throw new Error(`Schema ${schema.identity} must pin an exact UID or an exact deployment artifact path`);
    }
    if (/^0x[0-9a-f]{40}$/iu.test(schema.resolver)) {
      requireAddress(schema.resolver, `schemas.${schema.identity}.resolver`);
    } else if (!schema.resolver.startsWith("deployment:")) {
      throw new Error(`Schema ${schema.identity} must pin an exact resolver or an exact deployment artifact path`);
    }
  }

  const preparation = manifest.schemaPreparation;
  requireAddress(preparation.owner, "schemaPreparation.owner");
  requireAddress(preparation.constructorEAS, "schemaPreparation.constructorEAS");
  requireAddress(preparation.create2.factory, "schemaPreparation.create2.factory");
  requireAddress(preparation.expected.implementation, "schemaPreparation.expected.implementation");
  requireAddress(preparation.expected.proxy, "schemaPreparation.expected.proxy");
  if (getAddress(preparation.owner) !== getAddress(manifest.ownership.deploymentSender)) {
    throw new Error("TestimonyResolver owner must be the exact deployment sender");
  }
  if (getAddress(preparation.constructorEAS) !== getAddress(manifest.chains.arbitrum.eas!)) {
    throw new Error("TestimonyResolver constructor EAS must match the frozen Arbitrum EAS");
  }
  if (getAddress(preparation.create2.factory) !== getAddress(manifest.create2.factory)) {
    throw new Error("TestimonyResolver factory must match the frozen CREATE2 factory");
  }
  for (const [label, value] of Object.entries({
    implementationSalt: preparation.create2.implementationSalt,
    proxySalt: preparation.create2.proxySalt,
    implementationCreationCodeHash: preparation.expected.implementationCreationCodeHash,
    implementationRuntimeTemplateHash: preparation.expected.implementationRuntimeTemplateHash,
    proxyCreationCodeHash: preparation.expected.proxyCreationCodeHash,
    proxyRuntimeTemplateHash: preparation.expected.proxyRuntimeTemplateHash,
  })) {
    if (!/^0x[0-9a-f]{64}$/iu.test(value)) throw new Error(`schemaPreparation.${label} must be an exact bytes32`);
  }
  const testimonySchema = manifest.schemas.find((schema) => schema.identity === "community-testimony-v1");
  if (!testimonySchema || !/^0x[0-9a-f]{64}$/iu.test(testimonySchema.uid)) {
    throw new Error("Community Testimony must pin its exact precomputed UID");
  }
  if (
    !isAddress(testimonySchema.resolver) ||
    getAddress(testimonySchema.resolver) !== getAddress(preparation.expected.proxy)
  ) {
    throw new Error("Community Testimony resolver must be the exact predicted TestimonyResolver proxy");
  }

  const upgradeNames = new Set<string>();
  for (const upgrade of manifest.existingProxyUpgrades) {
    if (upgradeNames.has(upgrade.name)) throw new Error(`Duplicate existing proxy upgrade: ${upgrade.name}`);
    upgradeNames.add(upgrade.name);
    requireAddress(upgrade.proxy, `existingProxyUpgrades.${upgrade.name}.proxy`);
    requireAddress(upgrade.currentImplementation, `existingProxyUpgrades.${upgrade.name}.currentImplementation`);
    requireAddress(upgrade.currentOwner, `existingProxyUpgrades.${upgrade.name}.currentOwner`);
    requireAddress(upgrade.currentCeremonyEndOwner, `existingProxyUpgrades.${upgrade.name}.currentCeremonyEndOwner`);
    if (getAddress(upgrade.currentCeremonyEndOwner) !== getAddress(manifest.ownership.deploymentSender)) {
      throw new Error(`Existing proxy upgrade ${upgrade.name} must remain owned by the deployment sender`);
    }
    for (const [label, value] of Object.entries({
      currentImplementationCodeHash: upgrade.currentImplementationCodeHash,
      expectedImplementationCreationCodeHash: upgrade.expectedImplementationCreationCodeHash,
    })) {
      if (!/^0x[0-9a-f]{64}$/iu.test(value)) {
        throw new Error(`existingProxyUpgrades.${upgrade.name}.${label} must be an exact bytes32`);
      }
    }
    if (upgrade.implementationAddressPolicy !== "sender-and-stage-nonce-bound-transaction-plan") {
      throw new Error(`Existing proxy upgrade ${upgrade.name} must fail closed on a pinned stage nonce`);
    }
    if (upgrade.initializerPolicy !== "preserve-existing-initializer-state") {
      throw new Error(`Existing proxy upgrade ${upgrade.name} may not re-run its initializer`);
    }
    for (const [library, address] of Object.entries(upgrade.linkedLibraries)) {
      requireAddress(address, `existingProxyUpgrades.${upgrade.name}.linkedLibraries.${library}`);
    }
    upgrade.constructorArguments.forEach((argument, index) =>
      requireAddress(argument, `existingProxyUpgrades.${upgrade.name}.constructorArguments.${index}`),
    );
  }
  for (const required of ["AssessmentResolver", "GardenToken", "WorkApprovalResolver"]) {
    if (!upgradeNames.has(required)) throw new Error(`Missing existing proxy upgrade manifest for ${required}`);
  }

  if (manifest.safeAuthority.enabled) {
    for (const [key, value] of Object.entries(manifest.safeAuthority.caps)) {
      if (value === null || BigInt(String(value)) <= 0n)
        throw new Error(`Enabled Safe authority requires non-zero ${key}`);
    }
    for (const key of ["module", "roleKey", "conditionsHash", "allowanceKey"]) {
      if (manifest.safeAuthority.zodiacRoles[key] === null)
        throw new Error(`Enabled Safe authority requires zodiacRoles.${key}`);
    }
  } else if (manifest.safeAuthority.gardenSafes.length !== 0) {
    throw new Error("Disabled Safe authority may not pre-authorize garden Safes");
  }
  if (manifest.indexer.activationAuthorized) throw new Error("Phase A manifest may not authorize indexer activation");
  if (!/^0x[0-9a-f]{64}$/iu.test(manifest.indexer.configHash)) {
    throw new Error("indexer.configHash must freeze the exact packages/indexer/config.yaml hash");
  }
  if (manifest.indexer.ownerLane !== "PRD-722" || manifest.indexer.handoffOnly !== true) {
    throw new Error("Indexer release scope must remain a PRD-722 handoff with no hosted deployment action");
  }
}

function artifactPath(relativePath: string): string {
  return path.join(PRODUCTION_ARTIFACT_ROOT, relativePath);
}

function loadArtifact(relativePath: string): FoundryArtifact {
  const filePath = artifactPath(relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`Production artifact missing: ${filePath}; run bun run build:full`);
  return readJson<FoundryArtifact>(filePath);
}

function assertSchemaPreparationIdentity(manifest: ReleaseManifest): void {
  const preparation = manifest.schemaPreparation;
  const implementationArtifact = loadArtifact(preparation.implementationArtifact);
  const proxyArtifact = loadArtifact(preparation.proxyArtifact);
  const implementationSalt = keccak256(
    toUtf8Bytes(`${preparation.create2.saltNamespace}${preparation.create2.version}TestimonyResolverImpl`),
  );
  const proxySalt = keccak256(
    toUtf8Bytes(`${preparation.create2.saltNamespace}${preparation.create2.version}TestimonyResolverProxy`),
  );
  const implementationCreation = concat([
    implementationArtifact.bytecode.object,
    AbiCoder.defaultAbiCoder().encode(["address"], [preparation.constructorEAS]),
  ]);
  const implementationCreationCodeHash = keccak256(implementationCreation);
  const implementation = getCreate2Address(
    preparation.create2.factory,
    implementationSalt,
    implementationCreationCodeHash,
  );
  const initializer = new Interface(implementationArtifact.abi).encodeFunctionData("initialize", [preparation.owner]);
  const proxyCreation = concat([
    proxyArtifact.bytecode.object,
    AbiCoder.defaultAbiCoder().encode(["address", "bytes"], [implementation, initializer]),
  ]);
  const computed = {
    implementationSalt,
    proxySalt,
    implementation,
    proxy: getCreate2Address(preparation.create2.factory, proxySalt, keccak256(proxyCreation)),
    implementationCreationCodeHash,
    implementationRuntimeTemplateHash: keccak256(implementationArtifact.deployedBytecode.object),
    proxyCreationCodeHash: keccak256(proxyCreation),
    proxyRuntimeTemplateHash: keccak256(proxyArtifact.deployedBytecode.object),
  };
  const expected = {
    implementationSalt: preparation.create2.implementationSalt,
    proxySalt: preparation.create2.proxySalt,
    ...preparation.expected,
  };

  for (const [key, actual] of Object.entries(computed)) {
    const frozen = expected[key as keyof typeof expected];
    if (typeof frozen !== "string" || actual.toLowerCase() !== frozen.toLowerCase()) {
      throw new Error(`TestimonyResolver ${key} drift: manifest=${String(frozen)} computed=${actual}`);
    }
  }
}

function libraryArtifact(source: string, libraryName: string): string {
  return `${path.basename(source)}/${libraryName}.json`;
}

function versionedSalt(manifest: ReleaseManifest, label: string, baseSalt?: string): string {
  return keccak256(toUtf8Bytes(`${baseSalt ?? `${manifest.create2.domain}:${manifest.create2.version}`}:${label}`));
}

function linkBytecode(
  object: string,
  references: LinkReferences | undefined,
  addresses: Record<string, string>,
): string {
  let bytecode = object.startsWith("0x") ? object.slice(2) : object;
  for (const [source, libraries] of Object.entries(references ?? {})) {
    for (const [name, offsets] of Object.entries(libraries)) {
      const key = `${source}:${name}`;
      const address = addresses[key];
      if (!address) throw new Error(`Missing exact linked-library address for ${key}`);
      const replacement = getAddress(address).slice(2).toLowerCase();
      for (const offset of offsets) {
        if (offset.length !== 20) throw new Error(`Unexpected link width for ${key}: ${offset.length}`);
        const start = offset.start * 2;
        bytecode = `${bytecode.slice(0, start)}${replacement}${bytecode.slice(start + offset.length * 2)}`;
      }
    }
  }
  if (bytecode.includes("__$")) throw new Error("Unresolved library placeholder remains after linking");
  return `0x${bytecode}`;
}

function directLibraryReferences(artifact: FoundryArtifact): Array<{ source: string; name: string; artifact: string }> {
  return Object.entries(artifact.bytecode.linkReferences ?? {}).flatMap(([source, libraries]) =>
    Object.keys(libraries).map((name) => ({ source, name, artifact: libraryArtifact(source, name) })),
  );
}

function assertExistingUpgradeArtifacts(manifest: ReleaseManifest): void {
  for (const upgrade of manifest.existingProxyUpgrades) {
    const artifact = loadArtifact(upgrade.finalArtifact);
    const linkedCreation = linkBytecode(
      artifact.bytecode.object,
      artifact.bytecode.linkReferences,
      upgrade.linkedLibraries,
    );
    const constructorTypes = upgrade.constructorArguments.map(() => "address");
    const creation = concat([
      linkedCreation,
      AbiCoder.defaultAbiCoder().encode(constructorTypes, upgrade.constructorArguments),
    ]);
    const actual = keccak256(creation);
    if (actual.toLowerCase() !== upgrade.expectedImplementationCreationCodeHash.toLowerCase()) {
      throw new Error(
        `${upgrade.name} creation-code drift: manifest=${upgrade.expectedImplementationCreationCodeHash} computed=${actual}`,
      );
    }
  }
}

function collectLibraries(rootArtifacts: string[]): Array<{ source: string; name: string; artifact: string }> {
  const collected = new Map<string, { source: string; name: string; artifact: string }>();
  const visit = (relativePath: string) => {
    for (const library of directLibraryReferences(loadArtifact(relativePath))) {
      const key = `${library.source}:${library.name}`;
      if (collected.has(key)) continue;
      collected.set(key, library);
      visit(library.artifact);
    }
  };
  rootArtifacts.forEach(visit);
  return [...collected.values()].sort((a, b) => `${a.source}:${a.name}`.localeCompare(`${b.source}:${b.name}`));
}

function constructorArgs(manifest: ReleaseManifest, target: string): string {
  const arbitrum = manifest.chains.arbitrum;
  const celo = manifest.chains.celo;
  if (target === "SettlementModule") {
    return AbiCoder.defaultAbiCoder().encode(
      ["address", "uint64", "uint64"],
      [arbitrum.router, BigInt(arbitrum.ccipSelector), BigInt(celo.evmChainId)],
    );
  }
  if (target === "CeloSettlementExecutor") {
    return AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint64", "uint64"],
      [celo.router, celo.gDollar, BigInt(celo.ccipSelector), BigInt(arbitrum.evmChainId)],
    );
  }
  return "0x";
}

function initializerData(
  manifest: ReleaseManifest,
  target: string,
  artifact: FoundryArtifact,
  proxies: Record<string, string>,
): string {
  const owner = manifest.ownership.deploymentSender;
  const arbitrum = manifest.chains.arbitrum;
  const celo = manifest.chains.celo;
  const iface = new Interface(artifact.abi);
  switch (target) {
    case "CommitmentPoolingModule":
      return iface.encodeFunctionData("initialize", [owner, arbitrum.protocolGarden]);
    case "CommitmentRegistry":
      return iface.encodeFunctionData("initialize", [owner, proxies.CommitmentPoolingModule]);
    case "SettlementModule":
      return iface.encodeFunctionData("initialize", [
        owner,
        arbitrum.hatsModule,
        proxies.CommitmentPoolingModule,
        arbitrum.protocolGarden,
        celo.gDollar,
      ]);
    case "CreditRegistry":
      return iface.encodeFunctionData("initialize", [
        owner,
        arbitrum.hatsModule,
        proxies.CommitmentPoolingModule,
        proxies.SettlementModule,
      ]);
    case "CeloSettlementExecutor":
      return iface.encodeFunctionData("initialize", [
        owner,
        BigInt(arbitrum.ccipSelector),
        proxies.SettlementModule,
        celo.protocolVersion,
      ]);
    default:
      throw new Error(`Unsupported release target ${target}`);
  }
}

function plannedIdentity(
  manifest: ReleaseManifest,
  input: Omit<ReleaseIdentity, "salt" | "address" | "creationCodeHash" | "runtimeTemplateHash"> & {
    creationCode: string;
    runtimeCode: string;
  },
  baseSalt?: string,
): ReleaseIdentity {
  const label = `${input.kind}:${input.name}`;
  const salt = versionedSalt(manifest, label, baseSalt);
  const creationCodeHash = keccak256(input.creationCode);
  return {
    name: input.name,
    kind: input.kind,
    network: input.network,
    stage: input.stage,
    artifact: input.artifact,
    salt,
    address: getCreate2Address(manifest.create2.factory, salt, creationCodeHash),
    creationCodeHash,
    runtimeTemplateHash: keccak256(input.runtimeCode),
    immutableRuntime: input.immutableRuntime,
    libraries: input.libraries,
  };
}

export function buildReleaseLock(manifest = loadReleaseManifest(), baseSalt?: string): ReleaseLock {
  assertSchemaPreparationIdentity(manifest);
  assertExistingUpgradeArtifacts(manifest);
  const targetArtifacts = manifest.targets.map((target) => target.artifact);
  const libraries = collectLibraries(targetArtifacts);
  const identities: ReleaseIdentity[] = [];
  const libraryMap: Record<string, string> = {};

  // The only transitive link is SettlementLifecycleLib -> SettlementCommandLib. A bounded
  // fixed-point makes that dependency explicit and rejects any cycle rather than guessing.
  const remaining = new Map(libraries.map((library) => [`${library.source}:${library.name}`, library]));
  while (remaining.size > 0) {
    let progressed = false;
    for (const [key, library] of remaining) {
      const artifact = loadArtifact(library.artifact);
      const refs = directLibraryReferences(artifact);
      if (refs.some((ref) => !libraryMap[`${ref.source}:${ref.name}`])) continue;
      const creationCode = linkBytecode(artifact.bytecode.object, artifact.bytecode.linkReferences, libraryMap);
      const runtimeCode = linkBytecode(
        artifact.deployedBytecode.object,
        artifact.deployedBytecode.linkReferences,
        libraryMap,
      );
      const identity = plannedIdentity(
        manifest,
        {
          name: library.name,
          kind: "library",
          network: "arbitrum",
          stage: library.source.includes("Settlement/") ? "settlement-module" : "pooling",
          artifact: library.artifact,
          creationCode,
          runtimeCode,
          immutableRuntime: false,
          libraries: Object.fromEntries(
            refs.map((ref) => [`${ref.source}:${ref.name}`, libraryMap[`${ref.source}:${ref.name}`]]),
          ),
        },
        baseSalt,
      );
      identities.push(identity);
      libraryMap[key] = identity.address;
      remaining.delete(key);
      progressed = true;
    }
    if (!progressed) throw new Error(`Cyclic or unresolved library graph: ${[...remaining.keys()].join(", ")}`);
  }

  const proxies: Record<string, string> = {};
  const proxyArtifact = loadArtifact("ERC1967Proxy.sol/ERC1967Proxy.json");
  for (const target of manifest.targets) {
    const artifact = loadArtifact(target.artifact);
    const linkedCreation = linkBytecode(artifact.bytecode.object, artifact.bytecode.linkReferences, libraryMap);
    const linkedRuntime = linkBytecode(
      artifact.deployedBytecode.object,
      artifact.deployedBytecode.linkReferences,
      libraryMap,
    );
    const implementationCreation = concat([linkedCreation, constructorArgs(manifest, target.name)]);
    const implementation = plannedIdentity(
      manifest,
      {
        name: target.name,
        kind: "implementation",
        network: target.network,
        stage: target.stage,
        artifact: target.artifact,
        creationCode: implementationCreation,
        runtimeCode: linkedRuntime,
        immutableRuntime: Object.keys(artifact.deployedBytecode.immutableReferences ?? {}).length > 0,
        libraries: Object.fromEntries(
          directLibraryReferences(artifact).map((ref) => [
            `${ref.source}:${ref.name}`,
            libraryMap[`${ref.source}:${ref.name}`],
          ]),
        ),
      },
      baseSalt,
    );
    identities.push(implementation);

    // Proxy identities depend on other proxy identities through initializer calldata. Manifest
    // order is therefore a release invariant: pooling -> settlement -> credit/executor.
    const data = initializerData(manifest, target.name, artifact, proxies);
    const proxyConstructor = AbiCoder.defaultAbiCoder().encode(["address", "bytes"], [implementation.address, data]);
    const proxy = plannedIdentity(
      manifest,
      {
        name: target.name,
        kind: "proxy",
        network: target.network,
        stage: target.stage,
        artifact: "ERC1967Proxy.sol/ERC1967Proxy.json",
        creationCode: concat([proxyArtifact.bytecode.object, proxyConstructor]),
        runtimeCode: proxyArtifact.deployedBytecode.object,
        immutableRuntime: false,
        libraries: {},
      },
      baseSalt,
    );
    identities.push(proxy);
    proxies[target.name] = proxy.address;
  }

  const actualCounts = {
    libraries: identities.filter((identity) => identity.kind === "library").length,
    implementations: identities.filter((identity) => identity.kind === "implementation").length,
    proxies: identities.filter((identity) => identity.kind === "proxy").length,
  };
  const expectedTotal = Object.values(EXPECTED_RELEASE_IDENTITY_COUNTS).reduce((sum, count) => sum + count, 0);
  const uniqueAddresses = new Set(identities.map((identity) => getAddress(identity.address))).size;
  const complete =
    actualCounts.libraries === EXPECTED_RELEASE_IDENTITY_COUNTS.libraries &&
    actualCounts.implementations === EXPECTED_RELEASE_IDENTITY_COUNTS.implementations &&
    actualCounts.proxies === EXPECTED_RELEASE_IDENTITY_COUNTS.proxies &&
    Object.keys(libraryMap).length === EXPECTED_RELEASE_IDENTITY_COUNTS.libraries &&
    identities.length === expectedTotal &&
    uniqueAddresses === expectedTotal;

  if (!complete) {
    throw new Error(
      "Incomplete release identity graph: expected 21 libraries, 5 implementations, 5 proxies, " +
        `and 31 unique addresses; found ${actualCounts.libraries} libraries, ` +
        `${actualCounts.implementations} implementations, ${actualCounts.proxies} proxies, ` +
        `${Object.keys(libraryMap).length} library-map entries, and ${uniqueAddresses} unique addresses. ` +
        "Production artifacts may already contain linked bytecode; restore them with " +
        "FOUNDRY_PROFILE=production bun run build:fast before regenerating the release lock.",
    );
  }

  return {
    schemaVersion: 1,
    releaseId: manifest.releaseId,
    sourceCommit: manifest.sourceCommit,
    manifestHash: keccak256(toUtf8Bytes(JSON.stringify(manifest))),
    build: manifest.build,
    create2: manifest.create2,
    owner: manifest.ownership.deploymentSender,
    identities,
    libraryMap,
  };
}

export function assertManifestMatchesNetworkDirectory(manifest = loadReleaseManifest()): void {
  const networks = readJson<{
    networks: Record<string, { chainId: number; ccipChainSelector: string; contracts: { ccipRouter: string } }>;
  }>(path.join(CONTRACTS_ROOT, "deployments/networks.json"));
  for (const network of ["arbitrum", "celo"] as const) {
    const expected = manifest.chains[network];
    const configured = networks.networks[network];
    if (!configured) throw new Error(`Unsupported release network ${network}`);
    if (String(configured.chainId) !== expected.evmChainId) throw new Error(`${network} chain ID drift`);
    if (configured.ccipChainSelector !== expected.ccipSelector) throw new Error(`${network} selector drift`);
    if (getAddress(configured.contracts.ccipRouter) !== getAddress(expected.router))
      throw new Error(`${network} router drift`);
  }
  for (const forbidden of ["arbitrum-sepolia", "celo-sepolia"]) {
    if (networks.networks[forbidden]) throw new Error(`Unsupported withdrawn network record present: ${forbidden}`);
  }
}

export function exactForgeLibraryArguments(lock: ReleaseLock): string[] {
  return Object.entries(lock.libraryMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([qualifiedName, address]) => ["--libraries", `${qualifiedName}:${address}`]);
}
