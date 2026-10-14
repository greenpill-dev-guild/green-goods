import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createPwaRoutingConfig } from "../../config/pwaRouting";

const HOSTS = [
  "https://www.greengoods.app",
  "https://beta.greengoods.app",
  "https://staging.greengoods.app",
  "https://green-goods-git-fix-preview.vercel.app",
];

describe("PWA routing config", () => {
  it("declares the manifest as its own related application on whichever host serves it", () => {
    // Chromium answers getInstalledRelatedApps() for the page's own WebAPK only when
    // the related application URL equals the manifest URL it fetched. A relative
    // reference resolves to that URL on every host, so beta and preview installs
    // are recognised the same way production installs are.
    const { relatedApplicationManifestUrl } = createPwaRoutingConfig(false);

    expect(relatedApplicationManifestUrl).toBe("/manifest.webmanifest");
    for (const host of HOSTS) {
      const manifestUrl = `${host}/manifest.webmanifest`;
      expect(new URL(relatedApplicationManifestUrl, manifestUrl).href).toBe(manifestUrl);
    }
  });

  it("keeps the related application reference relative for IPFS builds", () => {
    const { relatedApplicationManifestUrl } = createPwaRoutingConfig(true);
    const manifestUrl = "https://gateway.example/ipfs/bafybeigdyrzt/manifest.webmanifest";

    expect(relatedApplicationManifestUrl).toBe("./manifest.webmanifest");
    expect(new URL(relatedApplicationManifestUrl, manifestUrl).href).toBe(manifestUrl);
  });
});

it("allows the supported editorial origins to query the installed WebAPK by manifest URL", () => {
  const associations = JSON.parse(readFileSync("public/.well-known/assetlinks.json", "utf8"));
  expect(associations.map((entry: { target: { site: string } }) => entry.target.site)).toEqual([
    "https://www.greengoods.app/manifest.webmanifest",
    "https://beta.greengoods.app/manifest.webmanifest",
  ]);
});
