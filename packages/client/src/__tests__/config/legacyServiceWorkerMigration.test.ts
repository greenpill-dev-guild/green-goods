import { describe, expect, it, vi } from "vitest";
import {
  isLegacyRootServiceWorker,
  restartPublicPageWithoutLegacyRootWorker,
  type LegacyServiceWorkerMigrationRuntime,
} from "../../config/legacyServiceWorkerMigration";

type Registrations = Awaited<ReturnType<LegacyServiceWorkerMigrationRuntime["getRegistrations"]>>;

function runtimeWith(registrations: Registrations) {
  const replace = vi.fn();
  return {
    replace,
    runtime: {
      getRegistrations: vi.fn().mockResolvedValue(registrations),
      href: "https://beta.greengoods.app/cookies?presentation=website",
      origin: "https://beta.greengoods.app",
      replace,
    } satisfies LegacyServiceWorkerMigrationRuntime,
  };
}

describe("legacy service worker migration", () => {
  it("recognizes only the same-origin root scope as legacy", () => {
    expect(
      isLegacyRootServiceWorker("https://beta.greengoods.app/", "https://beta.greengoods.app")
    ).toBe(true);
    expect(
      isLegacyRootServiceWorker("https://beta.greengoods.app/home/", "https://beta.greengoods.app")
    ).toBe(false);
    expect(isLegacyRootServiceWorker("https://example.com/", "https://beta.greengoods.app")).toBe(
      false
    );
  });

  it("unregisters the legacy root worker and restarts before public chunks load", async () => {
    const rootWorker = {
      scope: "https://beta.greengoods.app/",
      unregister: vi.fn().mockResolvedValue(true),
    };
    const appWorker = {
      scope: "https://beta.greengoods.app/home/",
      unregister: vi.fn().mockResolvedValue(true),
    };
    const { replace, runtime } = runtimeWith([rootWorker, appWorker]);

    await expect(
      restartPublicPageWithoutLegacyRootWorker("public", "e4f05561e8be", runtime)
    ).resolves.toBe(true);

    expect(rootWorker.unregister).toHaveBeenCalledTimes(1);
    expect(appWorker.unregister).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith(
      "https://beta.greengoods.app/cookies?presentation=website&gg_sw_retired=e4f05561e8be"
    );
  });

  it("does not touch service workers for the installed PWA bootstrap", async () => {
    const { replace, runtime } = runtimeWith([]);

    await expect(
      restartPublicPageWithoutLegacyRootWorker("pwa", "e4f05561e8be", runtime)
    ).resolves.toBe(false);

    expect(runtime.getRegistrations).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("continues startup when no legacy worker can be removed", async () => {
    const rootWorker = {
      scope: "https://beta.greengoods.app/",
      unregister: vi.fn().mockResolvedValue(false),
    };
    const { replace, runtime } = runtimeWith([rootWorker]);

    await expect(
      restartPublicPageWithoutLegacyRootWorker("public", "e4f05561e8be", runtime)
    ).resolves.toBe(false);

    expect(replace).not.toHaveBeenCalled();
  });
});
