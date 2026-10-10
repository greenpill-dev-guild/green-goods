import { describe, expect, it } from "vitest";
import vercelConfig from "../../../vercel.json";

describe("client Vercel public social shell routing", () => {
  const spaFallbackRewrite = {
    source: "/:path((?!assets/).*)",
    destination: "/index.html",
  };
  const noStoreHeader = {
    key: "Cache-Control",
    value: "no-cache, no-store, must-revalidate",
  };

  it("serves generated editorial shells and the ceremony proxy before the catch-all SPA rewrite", () => {
    const rewrites = vercelConfig.rewrites;
    const catchAllIndex = rewrites.findIndex(
      (rewrite) => rewrite.source === spaFallbackRewrite.source
    );

    expect(catchAllIndex).toBeGreaterThan(0);
    expect(rewrites.slice(0, catchAllIndex)).toEqual([
      { source: "/fund", destination: "/fund/index.html" },
      { source: "/impact", destination: "/impact/index.html" },
      { source: "/actions", destination: "/actions/index.html" },
      { source: "/gardens", destination: "/gardens/index.html" },
      { source: "/gardens/:path*", destination: "/gardens/index.html" },
      { source: "/cookies", destination: "/cookies/index.html" },
      {
        source: "/api/messaging/:path*",
        destination: "https://agent.greengoods.app/messaging/:path*",
      },
    ]);
  });

  it("keeps reporting ceremony pages and their API private to the browser that opened them", () => {
    const privateHeaders = [
      { key: "Cache-Control", value: "no-store" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ];
    expect(vercelConfig.headers).toContainEqual({
      source: "/agent/reporting/:path*",
      headers: privateHeaders,
    });
    expect(vercelConfig.headers).toContainEqual({
      source: "/api/messaging/:path*",
      headers: privateHeaders,
    });
  });

  it("keeps PWA routes on the SPA fallback path", () => {
    const rewriteSources = vercelConfig.rewrites.map((rewrite) => rewrite.source);

    expect(rewriteSources).not.toContain("/home");
    expect(rewriteSources).not.toContain("/home/:path*");
    expect(vercelConfig.rewrites.at(-1)).toEqual(spaFallbackRewrite);
  });

  it("does not rewrite missing hashed assets to index.html", () => {
    expect(vercelConfig.rewrites.at(-1)).toEqual(spaFallbackRewrite);
    expect(spaFallbackRewrite.source).toContain("(?!assets/)");
  });

  it("serves the cookie jar editorial shell without route-level browser caching", () => {
    expect(vercelConfig.headers).toContainEqual({
      source: "/cookies",
      headers: [noStoreHeader],
    });
  });
});
