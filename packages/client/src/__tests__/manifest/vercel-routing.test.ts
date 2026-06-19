import { describe, expect, it } from "vitest";
import vercelConfig from "../../../vercel.json";

describe("client Vercel public social shell routing", () => {
  const noStoreHeader = {
    key: "Cache-Control",
    value: "no-cache, no-store, must-revalidate",
  };

  it("serves generated editorial shells before the catch-all SPA rewrite", () => {
    const rewrites = vercelConfig.rewrites;
    const catchAllIndex = rewrites.findIndex((rewrite) => rewrite.source === "/(.*)");

    expect(catchAllIndex).toBeGreaterThan(0);
    expect(rewrites.slice(0, catchAllIndex)).toEqual([
      { source: "/fund", destination: "/fund/index.html" },
      { source: "/impact", destination: "/impact/index.html" },
      { source: "/actions", destination: "/actions/index.html" },
      { source: "/gardens", destination: "/gardens/index.html" },
      { source: "/gardens/:path*", destination: "/gardens/index.html" },
      { source: "/cookies", destination: "/cookies/index.html" },
      { source: "/api/agent/:path*", destination: "https://agent.greengoods.app/:path*" },
    ]);
  });

  it("keeps PWA routes on the SPA fallback path", () => {
    const rewriteSources = vercelConfig.rewrites.map((rewrite) => rewrite.source);

    expect(rewriteSources).not.toContain("/home");
    expect(rewriteSources).not.toContain("/home/:path*");
    expect(vercelConfig.rewrites.at(-1)).toEqual({
      source: "/(.*)",
      destination: "/index.html",
    });
  });

  it("serves the cookie jar editorial shell without route-level browser caching", () => {
    expect(vercelConfig.headers).toContainEqual({
      source: "/cookies",
      headers: [noStoreHeader],
    });
  });
});
