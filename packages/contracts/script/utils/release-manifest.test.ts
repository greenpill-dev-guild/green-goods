import { describe, expect, it } from "vitest";
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
      endState: "paused-deployer-owned",
      ownershipTransferIncluded: false,
      poolBackfillIncluded: false,
      unpauseIncluded: false,
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
        gasUsed: "2744354",
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

  it("rejects numeric selectors, duplicate schemas, and prematurely enabled authority", () => {
    const manifest = loadReleaseManifest();
    const numeric = structuredClone(manifest);
    numeric.chains.arbitrum.ccipSelector = Number(numeric.chains.arbitrum.ccipSelector) as unknown as string;
    expect(() => validateReleaseManifest(numeric)).toThrow(/base-10 string/);

    const duplicated = structuredClone(manifest);
    duplicated.schemas[1].identity = duplicated.schemas[0].identity;
    expect(() => validateReleaseManifest(duplicated)).toThrow(/Duplicate schema identity/);

    // The caps are frozen but the Roles module, keys, and condition hash are not, so enabling
    // authority must still fail closed on the unset Zodiac identities.
    const authority = structuredClone(manifest);
    authority.safeAuthority.enabled = true;
    expect(() => validateReleaseManifest(authority)).toThrow(/requires zodiacRoles\./);

    const uncapped = structuredClone(manifest);
    uncapped.safeAuthority.enabled = true;
    uncapped.safeAuthority.caps.maxPeriodAmount = null;
    expect(() => validateReleaseManifest(uncapped)).toThrow(/requires non-zero/);

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

    const ownershipTransfer = structuredClone(manifest);
    ownershipTransfer.ceremony.ownershipTransferIncluded = true as false;
    expect(() => validateReleaseManifest(ownershipTransfer)).toThrow(/paused and deployer-owned/);

    const backfill = structuredClone(manifest);
    backfill.ceremony.poolBackfillIncluded = true as false;
    expect(() => validateReleaseManifest(backfill)).toThrow(/paused and deployer-owned/);

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
