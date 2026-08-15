import { describe, expect, it } from "vitest";
import { expectedProxyPaused, implementationForProxy, releaseProxy } from "./release-verify";
import { buildReleaseLock, loadReleaseManifest } from "./utils/release-manifest";

describe("release verifier identity resolution", () => {
  it("resolves a proxy implementation from the full lock for a one-identity boundary", () => {
    const lock = buildReleaseLock();
    const proxy = lock.identities.find(
      (identity) => identity.kind === "proxy" && identity.name === "CommitmentPoolingModule",
    );
    if (!proxy) throw new Error("CommitmentPoolingModule proxy is missing from the release lock");

    const implementation = implementationForProxy(lock, proxy);
    expect(implementation.kind).toBe("implementation");
    expect(implementation.name).toBe(proxy.name);
    expect(implementation.network).toBe(proxy.network);
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

  it("uses the recorded current Pooling pause state without weakening historical or value-lane checks", () => {
    const current = { commitmentPoolingModulePaused: false };
    expect(expectedProxyPaused("CommitmentPoolingModule", current, false)).toBe(false);
    expect(expectedProxyPaused("CommitmentPoolingModule", {}, true)).toBe(true);
    expect(expectedProxyPaused("SettlementModule", current, false)).toBe(true);
    expect(expectedProxyPaused("CreditRegistry", current, false)).toBe(true);
    expect(expectedProxyPaused("CeloSettlementExecutor", current, false)).toBe(true);
    expect(expectedProxyPaused("CommitmentRegistry", current, false)).toBeUndefined();
    expect(() => expectedProxyPaused("CommitmentPoolingModule", {}, false)).toThrow(
      /must record commitmentPoolingModulePaused/,
    );
  });
});
