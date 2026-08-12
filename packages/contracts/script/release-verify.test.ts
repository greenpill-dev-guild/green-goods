import { describe, expect, it } from "vitest";
import { implementationForProxy, releaseProxy } from "./release-verify";
import { buildReleaseLock, loadReleaseManifest } from "./utils/release-manifest";

describe("release verifier identity resolution", () => {
  it("resolves a proxy implementation from the full lock for a one-identity boundary", () => {
    const lock = buildReleaseLock();
    const proxy = lock.identities.find(
      (identity) => identity.kind === "proxy" && identity.name === "CommitmentPoolingModule",
    );
    expect(proxy).toBeDefined();

    const implementation = implementationForProxy(lock, proxy!);
    expect(implementation.kind).toBe("implementation");
    expect(implementation.name).toBe(proxy!.name);
    expect(implementation.network).toBe(proxy!.network);
  });

  it("uses the selected release salt when resolving the Celo source peer", () => {
    const manifest = loadReleaseManifest();
    const defaultLock = buildReleaseLock(manifest);
    const selectedLock = buildReleaseLock(manifest, `${manifest.create2.domain}:review-salt-regression`);

    expect(releaseProxy(selectedLock, "SettlementModule")).not.toBe(releaseProxy(defaultLock, "SettlementModule"));
    expect(releaseProxy(selectedLock, "SettlementModule")).toBe(
      selectedLock.identities.find((identity) => identity.kind === "proxy" && identity.name === "SettlementModule")
        ?.address,
    );
  });
});
