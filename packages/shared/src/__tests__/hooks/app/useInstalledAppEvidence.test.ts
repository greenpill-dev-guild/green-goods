/** @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useInstalledAppEvidence } from "../../../hooks/app/useInstalledAppEvidence";

const originalRelatedApps = Object.getOwnPropertyDescriptor(navigator, "getInstalledRelatedApps");

afterEach(() => {
  vi.restoreAllMocks();
  if (originalRelatedApps) {
    Object.defineProperty(navigator, "getInstalledRelatedApps", originalRelatedApps);
  } else {
    Reflect.deleteProperty(navigator, "getInstalledRelatedApps");
  }
});

describe("useInstalledAppEvidence", () => {
  it("lets verified negative WebAPK evidence override stale history", async () => {
    Object.defineProperty(navigator, "getInstalledRelatedApps", {
      configurable: true,
      value: vi.fn().mockResolvedValue([]),
    });

    const { result } = renderHook(() =>
      useInstalledAppEvidence({
        platform: "android",
        isStandalone: false,
        wasInstalled: true,
      })
    );

    expect(result.current).toEqual({ status: "checking", source: "related-app" });
    await waitFor(() =>
      expect(result.current).toEqual({ status: "not-installed", source: "related-app" })
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

  it("prefers standalone evidence without querying related apps", () => {
    const getInstalledRelatedApps = vi.fn().mockResolvedValue([]);
    Object.defineProperty(navigator, "getInstalledRelatedApps", {
      configurable: true,
      value: getInstalledRelatedApps,
    });

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
