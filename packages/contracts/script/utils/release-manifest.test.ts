import * as fs from "node:fs";
import * as path from "node:path";
import { getCreate2Address, keccak256, zeroPadValue } from "ethers";
import { describe, expect, it } from "vitest";
import { buildTransferConditions, encodeConditions, permissionsConfigHash } from "../deploy/garden-roles";
import {
  assertManifestMatchesNetworkDirectory,
  buildReleaseLock,
  CONTRACTS_ROOT,
  commitmentPoolingImplementationRuntimeHash,
  loadReleaseManifest,
  PRODUCTION_ARTIFACT_ROOT,
  type ReleaseIdentity,
  type ReleaseLock,
  validateReleaseManifest,
} from "./release-manifest";

interface ArtifactBytes {
  object: string;
  linkReferences?: Record<string, Record<string, Array<{ start: number; length: number }>>>;
  immutableReferences?: Record<string, Array<{ start: number; length: number }>>;
}

function currentArtifact(identity: ReleaseIdentity): { bytecode: ArtifactBytes; deployedBytecode: ArtifactBytes } {
  return JSON.parse(fs.readFileSync(path.join(PRODUCTION_ARTIFACT_ROOT, identity.artifact), "utf8"));
}

// Independent byte binding for these tests: use the artifact's byte offsets and ethers' hash/
// CREATE2 primitives, rather than recording a new candidate hash in historical release data.
function linkedArtifact(bytes: ArtifactBytes, identity: ReleaseIdentity): string {
  let code = bytes.object.replace(/^0x/u, "");
  for (const [source, libraries] of Object.entries(bytes.linkReferences ?? {})) {
    for (const [name, references] of Object.entries(libraries)) {
      const address = identity.libraries[`${source}:${name}`];
      expect(address).toMatch(/^0x[0-9a-f]{40}$/iu);
      for (const reference of references) {
        expect(reference.length).toBe(20);
        const start = reference.start * 2;
        code = code.slice(0, start) + address.slice(2).toLowerCase() + code.slice(start + 40);
      }
    }
  }
  expect(code).toMatch(/^[0-9a-f]+$/iu);
  return `0x${code}`;
}

function materializedRuntime(bytes: ArtifactBytes, identity: ReleaseIdentity): string {
  let code = linkedArtifact(bytes, identity).slice(2);
  for (const references of Object.values(bytes.immutableReferences ?? {})) {
    for (const reference of references) {
      expect(reference.length).toBe(32);
      const start = reference.start * 2;
      code = code.slice(0, start) + zeroPadValue(identity.address, 32).slice(2).toLowerCase() + code.slice(start + 64);
    }
  }
  return `0x${code}`;
}

describe("combined commitment release manifest", () => {
  it("round-trips selectors and freezes the current supported route", () => {
    const manifest = loadReleaseManifest();
    expect(() => assertManifestMatchesNetworkDirectory(manifest)).not.toThrow();
    expect(BigInt(manifest.chains.arbitrum.ccipSelector).toString()).toBe(manifest.chains.arbitrum.ccipSelector);
    expect(BigInt(manifest.chains.celo.ccipSelector).toString()).toBe(manifest.chains.celo.ccipSelector);
    expect(manifest.ownership.protocolSafeConfiguration).toMatchObject({
      threshold: "2",
      contractsGuideMinimumThreshold: "2",
      guidePolicyStatus: "satisfied",
    });
    expect(manifest.ownership.protocolSafeConfiguration.owners).toHaveLength(6);
    expect(manifest.indexer).toMatchObject({ ownerLane: "PRD-722", handoffOnly: true });
    expect(manifest.indexer).not.toHaveProperty("cloud");
    expect(manifest.ceremony).toEqual({
      endState: "paused-safe-owned",
      ownershipTransferIncluded: true,
      poolBackfillIncluded: false,
      unpauseIncluded: false,
      peerWiringIncluded: true,
      followUpIssueRequired: true,
    });
    expect(manifest.batching).toMatchObject({
      hardMaxBatchSize: "24",
      releaseBatchSizeLimit: "2",
      activationIncluded: false,
      sourceAcknowledgmentGasLimit: "300000",
      sourceAcknowledgmentMeasurement: {
        acceptedBatchSize: "2",
        firstRejectedBatchSize: "3",
        profile: "production",
        executionMode: "isolated-per-call-transactions",
        distinctFundedPlans: true,
        coldDependencyPath: true,
        commitmentPoolingReadFree: true,
        status: "local-cold-state-green",
      },
    });
    expect(manifest.chains.arbitrum).toMatchObject({
      destinationGasLimit: "3000000",
      destinationGasMeasurement: {
        fixture: "CeloGardenRolesPermissionForkTest.testFork_measureDeliverableDestinationGasCeiling",
        batchSize: "6",
        gasUsed: "2744378",
        ccipPerMessageGasLimitCeiling: "3000000",
        includesAcknowledgmentAttempt: true,
        liveSafeZodiacMeasured: true,
        measuredOn: "2026-08-19",
        status: "final-live-authority-green",
      },
    });
    expect(manifest.safeAuthority.caps).toMatchObject({ maxBatchSize: "2" });
    expect(manifest.existingProxyUpgrades.map((upgrade) => upgrade.currentCeremonyEndOwner)).toEqual([
      manifest.ownership.deploymentSender,
      manifest.ownership.deploymentSender,
      manifest.ownership.deploymentSender,
    ]);
  });

  it("freezes the completed Safe/Zodiac ceremony with a derived condition hash", () => {
    const manifest = loadReleaseManifest();
    const authority = manifest.safeAuthority;
    expect(authority.enabled).toBe(true);
    expect(() => validateReleaseManifest(manifest)).not.toThrow();

    // The condition hash is proven against the exact tree the ceremony scoped, never transcribed.
    expect(authority.zodiacRoles.conditionsHash).toBe(keccak256(encodeConditions(buildTransferConditions())));

    // One entry per Garden, and every row's permission hash is recomputed from its own Safe and
    // modifier against the exact condition tree, so a substituted Safe fails on its own row rather
    // than hiding behind a correct count.
    const gardenSafes = authority.gardenSafes;
    expect(gardenSafes).toHaveLength(18);
    expect(gardenSafes.map((entry) => entry.tokenId)).toEqual([...Array(18).keys()]);
    const conditions = buildTransferConditions();
    for (const row of gardenSafes) {
      expect(permissionsConfigHash(row.safe, row.modifier, conditions)).toBe(row.permissionsConfigHash);
    }

    // `module` is the shared Roles v2 mastercopy; the per-Garden proxies live in `gardenSafes`.
    expect(authority.zodiacRoles.module).toBe("0x9646fDAD06d3e24444381f44362a3B0eB343D337");

    // Substituting one Safe for another syntactically valid one must be rejected structurally too.
    const swapped = structuredClone(manifest);
    swapped.safeAuthority.gardenSafes[3].safe = swapped.safeAuthority.gardenSafes[4].safe;
    expect(() => validateReleaseManifest(swapped)).toThrow(/gardenSafes\[4\]\.safe is duplicated/);
    const mastercopy = structuredClone(manifest);
    mastercopy.safeAuthority.gardenSafes[0].modifier = String(mastercopy.safeAuthority.zodiacRoles.module);
    expect(() => validateReleaseManifest(mastercopy)).toThrow(/must be a proxy, not the Roles mastercopy/);
    const reordered = structuredClone(manifest);
    reordered.safeAuthority.gardenSafes[0].tokenId = 5;
    expect(() => validateReleaseManifest(reordered)).toThrow(/must have tokenId 0/);

    // Swapping two Gardens between rows keeps every permission hash valid, because the hash covers
    // only the Safe and modifier. The receipt-backed deployment artifact is what catches it.
    const swappedGardens = structuredClone(manifest);
    const [rowA, rowB] = [swappedGardens.safeAuthority.gardenSafes[1], swappedGardens.safeAuthority.gardenSafes[2]];
    [rowA.garden, rowB.garden] = [rowB.garden, rowA.garden];
    for (const row of [rowA, rowB]) {
      expect(permissionsConfigHash(row.safe, row.modifier, conditions)).toBe(row.permissionsConfigHash);
    }
    expect(() => validateReleaseManifest(swappedGardens)).toThrow(
      /gardenSafes\[1\]\.garden differs from the deployment artifact/,
    );
  });

  it("records the Celo protocol Safe while gating only on threshold", () => {
    const manifest = loadReleaseManifest();
    const celo = manifest.ownership.celoProtocolSafeConfiguration;
    expect(celo.threshold).toBe("2");
    expect(celo.owners).toHaveLength(5);
    expect(celo.owners).toContain("0x04D60647836bcA09c37B379550038BdaaFD82503");
    expect(celo.liveThresholdAtFreeze).toBe("2");
    expect(celo.guidePolicyStatus).toBe("satisfied");

    const independentSigner = structuredClone(manifest);
    independentSigner.ownership.celoProtocolSafeConfiguration.owners[0] = "0x000000000000000000000000000000000000dEaD";
    expect(() => validateReleaseManifest(independentSigner)).not.toThrow();

    const belowFloor = structuredClone(manifest);
    belowFloor.ownership.celoProtocolSafeConfiguration.threshold = "1";
    expect(() => validateReleaseManifest(belowFloor)).toThrow(/Celo protocol Safe must have threshold >= 2/);
  });

  it("rejects numeric selectors, duplicate schemas, and half-configured authority", () => {
    const manifest = loadReleaseManifest();
    const numeric = structuredClone(manifest);
    numeric.chains.arbitrum.ccipSelector = Number(numeric.chains.arbitrum.ccipSelector) as unknown as string;
    expect(() => validateReleaseManifest(numeric)).toThrow(/base-10 string/);

    const duplicated = structuredClone(manifest);
    duplicated.schemas[1].identity = duplicated.schemas[0].identity;
    expect(() => validateReleaseManifest(duplicated)).toThrow(/Duplicate schema identity/);

    // Authority is enabled against the completed ceremony, so the fail-closed proof is that
    // clearing any one Zodiac identity still rejects the manifest.
    for (const key of ["module", "roleKey", "conditionsHash", "allowanceKey"] as const) {
      const cleared = structuredClone(manifest);
      cleared.safeAuthority.zodiacRoles[key] = null;
      expect(() => validateReleaseManifest(cleared)).toThrow(/requires zodiacRoles\./);
    }

    const uncapped = structuredClone(manifest);
    uncapped.safeAuthority.caps.maxPeriodAmount = null;
    expect(() => validateReleaseManifest(uncapped)).toThrow(/requires non-zero/);

    // Authority may never be switched off while the ceremony's garden Safes stay pre-authorized.
    const halfDisabled = structuredClone(manifest);
    halfDisabled.safeAuthority.enabled = false;
    expect(() => validateReleaseManifest(halfDisabled)).toThrow(/may not pre-authorize garden Safes/);

    // Both inclusion flags must be stated explicitly.
    const implicitPeerWiring = structuredClone(manifest);
    (implicitPeerWiring.ceremony as { peerWiringIncluded?: unknown }).peerWiringIncluded = undefined;
    expect(() => validateReleaseManifest(implicitPeerWiring)).toThrow(/must be explicit booleans/);

    // The ceremony always ends paused: backfill and unpause stay behind a later issue.
    for (const key of ["poolBackfillIncluded", "unpauseIncluded"] as const) {
      const widened = structuredClone(manifest);
      widened.ceremony[key] = true as never;
      expect(() => validateReleaseManifest(widened)).toThrow(/must end paused/);
    }

    // endState and ownershipTransferIncluded are one decision stated twice and may not disagree.
    const disagree = structuredClone(manifest);
    disagree.ceremony.ownershipTransferIncluded = false;
    expect(() => validateReleaseManifest(disagree)).toThrow(/must agree with ceremony.endState/);

    // Peer wiring is tier 3, so a deployer-owned ceremony cannot authorize it.
    const deployerPeerWiring = structuredClone(manifest);
    deployerPeerWiring.ceremony.endState = "paused-deployer-owned";
    deployerPeerWiring.ceremony.ownershipTransferIncluded = false;
    expect(() => validateReleaseManifest(deployerPeerWiring)).toThrow(/peer wiring is a tier-3 boundary/);

    const numericGas = structuredClone(manifest);
    numericGas.chains.arbitrum.destinationGasLimit = 750_000 as unknown as string;
    expect(() => validateReleaseManifest(numericGas)).toThrow(/destinationGasLimit must be a base-10 string/);

    const missingIndexerHash = structuredClone(manifest);
    missingIndexerHash.indexer.configHash = "";
    expect(() => validateReleaseManifest(missingIndexerHash)).toThrow(/indexer.configHash/);

    const indexerDeploymentScope = structuredClone(manifest);
    indexerDeploymentScope.indexer.handoffOnly = false as true;
    expect(() => validateReleaseManifest(indexerDeploymentScope)).toThrow(/PRD-722 handoff/);

    const duplicateSafeOwner = structuredClone(manifest);
    duplicateSafeOwner.ownership.protocolSafeConfiguration.owners[1] =
      duplicateSafeOwner.ownership.protocolSafeConfiguration.owners[0];
    expect(() => validateReleaseManifest(duplicateSafeOwner)).toThrow(/Duplicate protocol Safe owner/);

    const belowMinimumThreshold = structuredClone(manifest);
    belowMinimumThreshold.ownership.protocolSafeConfiguration.threshold = "1";
    expect(() => validateReleaseManifest(belowMinimumThreshold)).toThrow(/threshold >= 2/);

    const statusMismatch = structuredClone(manifest);
    const statusMismatchMeasurement = statusMismatch.chains.arbitrum.destinationGasMeasurement;
    if (!statusMismatchMeasurement) throw new Error("Fixture must include the frozen destination gas measurement");
    statusMismatchMeasurement.status = "local-hard-max-green-live-authority-pending";
    expect(() => validateReleaseManifest(statusMismatch)).toThrow(/status does not match live Safe\/Zodiac proof/);

    const prematureGasFreeze = structuredClone(statusMismatch);
    const prematureMeasurement = prematureGasFreeze.chains.arbitrum.destinationGasMeasurement;
    if (!prematureMeasurement) throw new Error("Fixture must include the frozen destination gas measurement");
    prematureMeasurement.liveSafeZodiacMeasured = false;
    expect(() => validateReleaseManifest(prematureGasFreeze)).toThrow(/must remain zero/);

    const transportCeilingExceeded = structuredClone(manifest);
    const ceilingMeasurement = transportCeilingExceeded.chains.arbitrum.destinationGasMeasurement;
    if (!ceilingMeasurement) throw new Error("Fixture must include the frozen destination gas measurement");
    ceilingMeasurement.ccipPerMessageGasLimitCeiling = "2999999";
    expect(() => validateReleaseManifest(transportCeilingExceeded)).toThrow(
      /exceeds the recorded CCIP per-message ceiling/,
    );

    const transportCeilingDrift = structuredClone(manifest);
    const driftedCeilingMeasurement = transportCeilingDrift.chains.arbitrum.destinationGasMeasurement;
    if (!driftedCeilingMeasurement) throw new Error("Fixture must include the frozen destination gas measurement");
    driftedCeilingMeasurement.ccipPerMessageGasLimitCeiling = "3000001";
    expect(() => validateReleaseManifest(transportCeilingDrift)).toThrow(
      /must equal the pinned arbitrum->celo ceiling/,
    );

    const missingMeasurementWithOversizedLimit = structuredClone(manifest);
    delete missingMeasurementWithOversizedLimit.chains.arbitrum.destinationGasMeasurement;
    missingMeasurementWithOversizedLimit.chains.arbitrum.destinationGasLimit = "3000001";
    expect(() => validateReleaseManifest(missingMeasurementWithOversizedLimit)).toThrow(
      /destinationGasLimit exceeds the pinned CCIP per-message ceiling/,
    );

    const unmeasuredAuthorityBatch = structuredClone(manifest);
    unmeasuredAuthorityBatch.safeAuthority.caps.maxBatchSize = "7";
    expect(() => validateReleaseManifest(unmeasuredAuthorityBatch)).toThrow(
      /Safe authority maxBatchSize exceeds the measured deliverable maximum/,
    );

    const missingAcknowledgment = structuredClone(manifest);
    const gasMeasurement = missingAcknowledgment.chains.arbitrum.destinationGasMeasurement;
    if (!gasMeasurement) throw new Error("Fixture must include the frozen destination gas measurement");
    gasMeasurement.includesAcknowledgmentAttempt = false;
    expect(() => validateReleaseManifest(missingAcknowledgment)).toThrow(/include the acknowledgment attempt/);

    // Ownership transfer is included, but it may only hand off to a Safe-owned paused end state.
    const deployerOwnedTransfer = structuredClone(manifest);
    deployerOwnedTransfer.ceremony.endState = "paused-deployer-owned";
    expect(() => validateReleaseManifest(deployerOwnedTransfer)).toThrow(/must agree with ceremony.endState/);

    const backfill = structuredClone(manifest);
    backfill.ceremony.poolBackfillIncluded = true as false;
    expect(() => validateReleaseManifest(backfill)).toThrow(/must end paused/);

    const batchActivation = structuredClone(manifest);
    batchActivation.batching.activationIncluded = true as false;
    expect(() => validateReleaseManifest(batchActivation)).toThrow(/may freeze but not activate batching/);

    const oversizedBatchLimit = structuredClone(manifest);
    oversizedBatchLimit.batching.releaseBatchSizeLimit = "4";
    expect(() => validateReleaseManifest(oversizedBatchLimit)).toThrow(/prove the frozen limit/);

    const unprovenBatchGas = structuredClone(manifest);
    unprovenBatchGas.batching.sourceAcknowledgmentMeasurement.firstRejectedGasUsed = "300000";
    expect(() => validateReleaseManifest(unprovenBatchGas)).toThrow(/gas boundary is not proven/);

    const wrongMeasurementProfile = structuredClone(manifest);
    wrongMeasurementProfile.batching.sourceAcknowledgmentMeasurement.profile = "ci";
    expect(() => validateReleaseManifest(wrongMeasurementProfile)).toThrow(/exact release build profile/);

    const unisolatedMeasurement = structuredClone(manifest);
    unisolatedMeasurement.batching.sourceAcknowledgmentMeasurement.executionMode =
      "vm-cool" as "isolated-per-call-transactions";
    expect(() => validateReleaseManifest(unisolatedMeasurement)).toThrow(/per-call transaction isolation/);
  });

  it("builds peer wiring only at the measured gas frozen in the manifest", async () => {
    const { buildPeerTransactionPlan } = await import("./release-plan");
    const manifest = loadReleaseManifest();
    const lock = buildReleaseLock(manifest);
    expect(() => buildPeerTransactionPlan(manifest, lock, 3_000_001n)).toThrow(/differs from the frozen manifest/);
    expect(buildPeerTransactionPlan(manifest, lock, 3_000_000n).transactions).toHaveLength(1);
  });

  it("derives one deterministic library map for build, CREATE2, and verification", () => {
    const lock = buildReleaseLock();
    const libraries = lock.identities.filter((identity) => identity.kind === "library");
    const implementations = lock.identities.filter((identity) => identity.kind === "implementation");
    const proxies = lock.identities.filter((identity) => identity.kind === "proxy");

    expect(libraries).toHaveLength(21);
    expect(implementations).toHaveLength(5);
    expect(proxies).toHaveLength(5);
    expect(new Set(lock.identities.map((identity) => identity.address)).size).toBe(lock.identities.length);
    expect(Object.keys(lock.libraryMap)).toHaveLength(21);
    expect(buildReleaseLock()).toEqual(lock);
    const claimsLibrary = libraries.find((identity) => identity.name === "CommitmentPoolingClaimsLib");
    if (!claimsLibrary) throw new Error("Release lock must include the Claims library");
    const claimsArtifact = currentArtifact(claimsLibrary);
    expect(claimsLibrary.creationCodeHash).toBe(keccak256(linkedArtifact(claimsArtifact.bytecode, claimsLibrary)));
    expect(claimsLibrary.runtimeTemplateHash).toBe(
      keccak256(materializedRuntime(claimsArtifact.deployedBytecode, claimsLibrary)),
    );
    expect(claimsLibrary.address).toBe(
      getCreate2Address(lock.create2.factory, claimsLibrary.salt, claimsLibrary.creationCodeHash),
    );
    expect(libraries.find((identity) => identity.name === "SettlementFundingLib")).toBeDefined();
    expect(libraries.find((identity) => identity.name === "SettlementLifecycleLib")?.libraries).toHaveProperty(
      "src/lib/Settlement/CommandLib.sol:SettlementCommandLib",
    );
    const poolingImplementation = implementations.find((identity) => identity.name === "CommitmentPoolingModule");
    if (!poolingImplementation) throw new Error("Release lock must include the Commitment Pooling implementation");
    expect(poolingImplementation?.libraries).toHaveProperty(
      "src/lib/CommitmentPooling/ClaimsLib.sol:CommitmentPoolingClaimsLib",
    );
    const poolingArtifact = currentArtifact(poolingImplementation);
    expect(poolingImplementation.creationCodeHash).toBe(
      keccak256(linkedArtifact(poolingArtifact.bytecode, poolingImplementation)),
    );
    expect(poolingImplementation.runtimeTemplateHash).toBe(
      keccak256(linkedArtifact(poolingArtifact.deployedBytecode, poolingImplementation)),
    );
    expect(poolingImplementation.address).toBe(
      getCreate2Address(lock.create2.factory, poolingImplementation.salt, poolingImplementation.creationCodeHash),
    );
    expect(Object.keys(poolingArtifact.deployedBytecode.immutableReferences ?? {})).toHaveLength(1);
    expect(commitmentPoolingImplementationRuntimeHash(poolingImplementation)).toBe(
      keccak256(materializedRuntime(poolingArtifact.deployedBytecode, poolingImplementation)),
    );
  });

  it("preserves historical release bytecode pins independently of current candidate artifacts", () => {
    const historical = JSON.parse(
      fs.readFileSync(path.join(CONTRACTS_ROOT, "config/commitment-pooling-release.lock.json"), "utf8"),
    ) as ReleaseLock;
    expect(
      historical.identities.find((identity) => identity.name === "CommitmentPoolingClaimsLib")?.runtimeTemplateHash,
    ).toBe("0x9226b8fc80593906cb6f851c4b129a34ed48fb6bb7422bc84def33d011c7c7da");
    const pooling = historical.identities.find(
      (identity) => identity.kind === "implementation" && identity.name === "CommitmentPoolingModule",
    );
    if (!pooling) throw new Error("Historical release lock must preserve the Pooling implementation");
    expect(pooling).toMatchObject({
      address: "0x6268ec974bb217De39E7756d75c8D523b9A79218",
      creationCodeHash: "0x8043fb53315f35159c842befb679b7f78d1dd6f2d0b790b540028092e3abebfd",
      runtimeTemplateHash: "0x5703805856d97bc71b449e1cdb7838d621b38815d192e6039482bbf4dfae312a",
      immutableRuntime: true,
    });
    expect(pooling.address).toBe(getCreate2Address(historical.create2.factory, pooling.salt, pooling.creationCodeHash));
    // Historical materialized UUPS runtime pin from this test before the service-access slice:
    // 0x3f4e55e1632bde5ef29aadf5224e5a07498b529c27e82d850829583a75fce27f.
    // The lock stores its template hash, not materialized bytecode; current candidate materialization
    // is independently verified above rather than claiming this unavailable historical binary is rebuilt.
  });
});
