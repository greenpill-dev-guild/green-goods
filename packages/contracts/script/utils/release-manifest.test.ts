import { describe, expect, it } from "vitest";
import {
  assertManifestMatchesNetworkDirectory,
  buildReleaseLock,
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
      releaseBatchSizeLimit: "3",
      activationIncluded: false,
      sourceAcknowledgmentGasLimit: "300000",
      sourceAcknowledgmentMeasurement: {
        acceptedBatchSize: "3",
        firstRejectedBatchSize: "4",
        distinctFundedPlans: true,
        coldDependencyPath: true,
        commitmentPoolingReadFree: true,
        status: "local-cold-state-green",
      },
    });
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

    const authority = structuredClone(manifest);
    authority.safeAuthority.enabled = true;
    expect(() => validateReleaseManifest(authority)).toThrow(/requires non-zero/);

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

    const prematureGasFreeze = structuredClone(manifest);
    prematureGasFreeze.chains.arbitrum.destinationGasLimit = "2000000";
    expect(() => validateReleaseManifest(prematureGasFreeze)).toThrow(/must remain zero/);

    const missingAcknowledgment = structuredClone(manifest);
    missingAcknowledgment.chains.arbitrum.destinationGasMeasurement!.includesAcknowledgmentAttempt = false;
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
  });

  it("refuses peer wiring until measured gas is frozen and then rejects environment drift", async () => {
    const { buildPeerTransactionPlan } = await import("./release-plan");
    const manifest = loadReleaseManifest();
    const lock = buildReleaseLock(manifest);
    expect(() => buildPeerTransactionPlan(manifest, lock, 750_000n)).toThrow(/frozen in the release manifest/);

    const frozen = structuredClone(manifest);
    frozen.chains.arbitrum.destinationGasLimit = "750000";
    expect(() => buildPeerTransactionPlan(frozen, lock, 750_001n)).toThrow(/differs from the frozen manifest/);
    expect(buildPeerTransactionPlan(frozen, lock, 750_000n).transactions).toHaveLength(1);
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
    expect(libraries.find((identity) => identity.name === "SettlementFundingLib")).toBeDefined();
    expect(libraries.find((identity) => identity.name === "SettlementLifecycleLib")?.libraries).toHaveProperty(
      "src/lib/Settlement/CommandLib.sol:SettlementCommandLib",
    );
    expect(implementations.find((identity) => identity.name === "CommitmentPoolingModule")?.libraries).toHaveProperty(
      "src/lib/CommitmentPooling/ClaimsLib.sol:CommitmentPoolingClaimsLib",
    );
  });
});
