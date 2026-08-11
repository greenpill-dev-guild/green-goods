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

    expect(libraries).toHaveLength(20);
    expect(implementations).toHaveLength(5);
    expect(proxies).toHaveLength(5);
    expect(new Set(lock.identities.map((identity) => identity.address)).size).toBe(lock.identities.length);
    expect(Object.keys(lock.libraryMap)).toHaveLength(20);
    expect(libraries.find((identity) => identity.name === "SettlementLifecycleLib")?.libraries).toHaveProperty(
      "src/lib/Settlement/CommandLib.sol:SettlementCommandLib",
    );
    expect(implementations.find((identity) => identity.name === "CommitmentPoolingModule")?.libraries).toHaveProperty(
      "src/lib/CommitmentPooling/ClaimsLib.sol:CommitmentPoolingClaimsLib",
    );
  });
});
