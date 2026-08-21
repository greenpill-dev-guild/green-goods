import { keccak256 } from "ethers";
import { describe, expect, it } from "vitest";
import { buildTransferConditions, encodeConditions, permissionsConfigHash } from "../deploy/garden-roles";
import {
  assertManifestMatchesNetworkDirectory,
  buildReleaseLock,
  commitmentPoolingImplementationRuntimeHash,
  loadReleaseManifest,
  validateReleaseManifest,
} from "./release-manifest";

describe("combined commitment release manifest", () => {
  it("round-trips selectors and freezes the current supported route", () => {
    const manifest = loadReleaseManifest();
    expect(() => assertManifestMatchesNetworkDirectory(manifest)).not.toThrow();
    expect(BigInt(manifest.chains.arbitrum.ccipSelector).toString()).toBe(manifest.chains.arbitrum.ccipSelector);
    expect(BigInt(manifest.chains.celo.ccipSelector).toString()).toBe(manifest.chains.celo.ccipSelector);
    expect(manifest.ownership.protocolSafeConfiguration).toMatchObject({
      threshold: "2",
      contractsGuideMinimumThreshold: "2",
      contractsGuideMinimumOwnerCount: "3",
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

    const belowMinimumOwners = structuredClone(manifest);
    belowMinimumOwners.ownership.protocolSafeConfiguration.owners =
      belowMinimumOwners.ownership.protocolSafeConfiguration.owners.slice(0, 2);
    expect(() => validateReleaseManifest(belowMinimumOwners)).toThrow(/owner count >= 3/);

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
    expect(libraries.find((identity) => identity.name === "CommitmentPoolingClaimsLib")?.runtimeTemplateHash).toBe(
      "0x9226b8fc80593906cb6f851c4b129a34ed48fb6bb7422bc84def33d011c7c7da",
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
    expect(commitmentPoolingImplementationRuntimeHash(poolingImplementation)).toBe(
      "0x3f4e55e1632bde5ef29aadf5224e5a07498b529c27e82d850829583a75fce27f",
    );
  });
});
