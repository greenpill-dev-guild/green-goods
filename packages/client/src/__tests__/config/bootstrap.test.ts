/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";

vi.mock("../../bootstrapPublic", () => ({ default: () => null }));
vi.mock("../../bootstrapPwa", () => ({ default: () => null }));

import { getBootPresentation, loadClientBootstrap } from "../../config/bootstrap";

describe("client bootstrap selection", () => {
  it("selects the installed bootstrap only for the PWA detector value", () => {
    const root = document.createElement("html");
    root.dataset.bootPresentation = "pwa";
    expect(getBootPresentation(root)).toBe("pwa");

    root.dataset.bootPresentation = "website";
    expect(getBootPresentation(root)).toBe("public");
  });

  it("loads only the selected presentation module", async () => {
    const publicBootstrap = await loadClientBootstrap("public");
    const pwaBootstrap = await loadClientBootstrap("pwa");

    expect(publicBootstrap.default).not.toBe(pwaBootstrap.default);
  });
});
