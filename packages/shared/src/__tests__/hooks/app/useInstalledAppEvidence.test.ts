/** @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useInstalledAppEvidence } from "../../../hooks/app/useInstalledAppEvidence";

const originalRelatedApps = Object.getOwnPropertyDescriptor(navigator, "getInstalledRelatedApps");

function stubRelatedApps(result: Array<{ platform: string; url?: string }>) {
  const getInstalledRelatedApps = vi.fn().mockResolvedValue(result);
  Object.defineProperty(navigator, "getInstalledRelatedApps", {
    configurable: true,
    value: getInstalledRelatedApps,
  });
  return getInstalledRelatedApps;
}

afterEach(() => {
  vi.restoreAllMocks();
  if (originalRelatedApps) {
    Object.defineProperty(navigator, "getInstalledRelatedApps", originalRelatedApps);
  } else {
    Reflect.deleteProperty(navigator, "getInstalledRelatedApps");
  }
});

describe("useInstalledAppEvidence", () => {
  it("confirms an installed WebAPK from the related-app query", async () => {
    stubRelatedApps([
      { platform: "webapp", url: "https://beta.greengoods.app/manifest.webmanifest" },
    ]);

    const { result } = renderHook(() =>
      useInstalledAppEvidence({
        platform: "android",
        isStandalone: false,
        wasInstalled: false,
      })
    );

    expect(result.current).toEqual({ status: "checking", source: "related-app" });
    await waitFor(() =>
      expect(result.current).toEqual({ status: "installed", source: "related-app" })
    );
  });

  it("keeps a remembered install when the related-app query comes back empty", async () => {
    // Chromium answers empty for a WebAPK bound to another host's manifest, for a
    // home-screen shortcut, and for a missing asset-link association, so an empty
    // list must fall back to history instead of overriding it.
    stubRelatedApps([]);

    const { result } = renderHook(() =>
      useInstalledAppEvidence({
        platform: "android",
        isStandalone: false,
        wasInstalled: true,
      })
    );

    expect(result.current).toEqual({ status: "checking", source: "related-app" });
    await waitFor(() => expect(result.current).toEqual({ status: "unknown", source: "history" }));
  });

  it("reports nothing to go on when the query is empty and nothing was ever installed", async () => {
    stubRelatedApps([]);

    const { result } = renderHook(() =>
      useInstalledAppEvidence({
        platform: "android",
        isStandalone: false,
        wasInstalled: false,
      })
    );

    await waitFor(() =>
      expect(result.current).toEqual({ status: "unknown", source: "unsupported" })
    );
  });

  it("uses historical state only when the installed-app API is unsupported", () => {
    const { result } = renderHook(() =>
      useInstalledAppEvidence({
        platform: "android",
        isStandalone: false,
        wasInstalled: true,
      })
    );

    expect(result.current).toEqual({ status: "unknown", source: "history" });
  });

  it("treats an observed install prompt as proof the app is absent, over history and the query", () => {
    const getInstalledRelatedApps = stubRelatedApps([]);

    const { result, rerender } = renderHook(
      ({ installPromptObserved }) =>
        useInstalledAppEvidence({
          platform: "android",
          isStandalone: false,
          wasInstalled: true,
          installPromptObserved,
        }),
      { initialProps: { installPromptObserved: true } }
    );

    expect(result.current).toEqual({ status: "not-installed", source: "install-prompt" });
    expect(getInstalledRelatedApps).not.toHaveBeenCalled();

    // Dismissing the prompt does not change the verdict; only appinstalled does.
    rerender({ installPromptObserved: true });
    expect(result.current).toEqual({ status: "not-installed", source: "install-prompt" });
  });

  it("lets a confirmed install retire an earlier prompt", () => {
    stubRelatedApps([]);

    const { result, rerender } = renderHook(
      ({ installConfirmed }) =>
        useInstalledAppEvidence({
          platform: "android",
          isStandalone: false,
          wasInstalled: true,
          installConfirmed,
          installPromptObserved: !installConfirmed,
        }),
      { initialProps: { installConfirmed: false } }
    );

    expect(result.current).toEqual({ status: "not-installed", source: "install-prompt" });

    rerender({ installConfirmed: true });
    expect(result.current).toEqual({ status: "installed", source: "appinstalled" });
  });

  it("prefers standalone evidence without querying related apps", () => {
    const getInstalledRelatedApps = stubRelatedApps([]);

    const { result } = renderHook(() =>
      useInstalledAppEvidence({
        platform: "android",
        isStandalone: true,
        wasInstalled: false,
      })
    );

    expect(result.current).toEqual({ status: "installed", source: "standalone" });
    expect(getInstalledRelatedApps).not.toHaveBeenCalled();
  });
});
